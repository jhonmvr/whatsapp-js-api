import pg from 'pg';
import logger from './logger.js';

const {
  DB_HOST='localhost',
  DB_PORT='5432',
  DB_NAME='wappdb',
  DB_USER='wapp',
  DB_PASSWORD='wapp'
} = process.env;

const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: 10
});

export async function migrate() {
  const ddl = `
  CREATE TABLE IF NOT EXISTS service_config (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS webhook_target (
    id bigserial PRIMARY KEY,
    url text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS webhook_header (
    id bigserial PRIMARY KEY,
    target_id bigint REFERENCES webhook_target(id) ON DELETE CASCADE,
    name text NOT NULL,
    value text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
  );

  CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id bigserial PRIMARY KEY,
    target_id bigint REFERENCES webhook_target(id) ON DELETE SET NULL,
    request_body jsonb NOT NULL,
    status_code int,
    error text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  `;
  await pool.query(ddl);

  // Seed default config rows if absent
  const defaults = [
    ['templates', {}],
    ['rateLimit', { enabled: false, rpm: 60 }],
    ['webhook', { signatureHeader: 'X-WApp-Signature-256', signEnabled: !!(process.env.WEBHOOK_SECRET||'') }],
    ['webhookSecret', { secret: process.env.WEBHOOK_SECRET || '' }]
  ];
  for (const [key, value] of defaults) {
    await pool.query(
      `INSERT INTO service_config(key,value) VALUES($1,$2)
       ON CONFLICT (key) DO NOTHING`, [key, value]);
  }
  logger.info('DB migration OK');
}

export async function getConfig(key) {
  const { rows } = await pool.query('SELECT value FROM service_config WHERE key=$1', [key]);
  return rows[0]?.value;
}

export async function setConfig(key, value) {
  const { rows } = await pool.query(
    `INSERT INTO service_config(key,value,updated_at) VALUES($1,$2,now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()
     RETURNING value`, [key, value]);
  return rows[0].value;
}

export async function listWebhookTargets() {
  const { rows } = await pool.query('SELECT id,url,is_active FROM webhook_target ORDER BY id');
  return rows;
}

export async function replaceWebhookTargets(targets) {
  // naive replace: delete all and insert
  await pool.query('DELETE FROM webhook_header');
  await pool.query('DELETE FROM webhook_target');
  for (const t of targets) {
    const { url, is_active=true, headers=[] } = t;
    const ins = await pool.query('INSERT INTO webhook_target(url,is_active) VALUES($1,$2) RETURNING id',[url,is_active]);
    const tid = ins.rows[0].id;
    for (const h of headers) {
      await pool.query('INSERT INTO webhook_header(target_id,name,value,is_active) VALUES($1,$2,$3,$4)',
        [tid, h.name, h.value, h.is_active ?? true]);
    }
  }
  return listWebhookTargets();
}

export async function getActiveTargetsWithHeaders() {
  const { rows } = await pool.query('SELECT id,url FROM webhook_target WHERE is_active=true');
  const headersMap = {};
  const { rows: hdr } = await pool.query('SELECT target_id,name,value FROM webhook_header WHERE is_active=true');
  for (const h of hdr) {
    headersMap[h.target_id] = headersMap[h.target_id] || [];
    headersMap[h.target_id].push([h.name, h.value]);
  }
  return rows.map(r => ({
    id: r.id,
    url: r.url,
    headers: headersMap[r.id] || []
  }));
}

export async function logDelivery(targetId, body, statusCode, error) {
  await pool.query('INSERT INTO webhook_delivery_log(target_id,request_body,status_code,error) VALUES($1,$2,$3,$4)',
    [targetId, body, statusCode, error || null]);
}

export default pool;
