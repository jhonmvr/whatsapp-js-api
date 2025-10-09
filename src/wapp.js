import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import logger from './logger.js';
import { getConfig } from './db.js';
import { getActiveTargetsWithHeaders } from './db.js';
import { deliverWebhook } from './utils/delivery.js';
import { buildSignature } from './utils/signer.js';

export class WApp {
  constructor(options = {}) {
    const {
      clientId = process.env.WWEBJS_CLIENT_ID || 'default',
      headless = (process.env.PUPPETEER_HEADLESS || 'true') === 'true',
      dataDir = process.env.DATA_DIR || '/data',
    } = options;

    this._qr = null;
    this._ready = false;

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId,
        dataPath: `${dataDir}/wwebjs_auth`
      }),
      puppeteer: {
        headless,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote'
        ]
      }
    });

    this.client.on('qr', async (qr) => {
      this._qr = await QRCode.toDataURL(qr);
      this._ready = false;
      logger.warn('QR generado: escanéalo para iniciar sesión');
    });

    this.client.on('ready', () => {
      this._ready = true;
      this._qr = null;
      logger.info('Cliente WhatsApp listo ✅');
    });

    this.client.on('authenticated', () => logger.info('Autenticado'));
    this.client.on('auth_failure', (m) => logger.error({ m }, 'Fallo de auth'));
    this.client.on('disconnected', (r) => {
      logger.warn({ r }, 'Desconectado, reintentando');
      this._ready = false;
      this.client.initialize();
    });

    // Inbound messages -> deliver webhooks
    this.client.on('message', async (msg) => {
      try {
        const payload = toMetaLikePayload(msg);
        const bodyStr = JSON.stringify(payload);
        const targets = await getActiveTargetsWithHeaders();
        const webhookCfg = (await getConfig('webhook')) || { signatureHeader: 'X-WApp-Signature-256', signEnabled: true };
        const secret = ((await getConfig('webhookSecret')) || {}).secret || process.env.WEBHOOK_SECRET || '';
        const signature = (webhookCfg.signEnabled && secret) ? buildSignature(secret, bodyStr) : null;
        for (const t of targets) {
          await deliverWebhook(t, bodyStr, signature, webhookCfg.signatureHeader || 'X-WApp-Signature-256');
          logger.info({ url: t.url, msgId: msg.id.id }, 'Webhook entregado');
        }
      } catch (err) {
        logger.error({ err }, 'Fallo entregando webhook');
      }
    });
  }

  async initialize() { await this.client.initialize(); }
  status() { return { ready: this._ready, hasQr: !!this._qr }; }
  qr() { return this._qr; }

  async sendText({ from, to, message }) {
    if (!this._ready) throw new Error('CLIENT_NOT_READY');
    const chatId = normalizeToJid(to);
    const sent = await this.client.sendMessage(chatId, message);
    return sent.id.id;
  }

  async sendRendered({ from, to, text }) {
    if (!this._ready) throw new Error('CLIENT_NOT_READY');
    const chatId = normalizeToJid(to);
    const sent = await this.client.sendMessage(chatId, text);
    return sent.id.id;
  }
}

function normalizeToJid(e164) {
  const n = String(e164).replace(/^\+/, '');
  return `${n}@c.us`;
}

function toMetaLikePayload(msg) {
  const from = msg.from.replace('@c.us','');
  const to = (msg.to || '').replace('@c.us','');
  const isText = msg.type === 'chat' || msg.type === 'text';
  return {
    object: 'whatsapp_webjs',
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: to || 'unknown',
            phone_number_id: 'local-wwebjs'
          },
          messages: [{
            from,
            id: msg.id.id,
            timestamp: String(Math.floor(Date.now()/1000)),
            type: isText ? 'text' : (msg.type || 'unknown'),
            text: isText ? { body: msg.body } : undefined
          }]
        }
      }]
    }]
  };
}
