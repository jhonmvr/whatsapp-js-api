import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import logger from './logger.js';
import { getConfig } from './db.js';
import { getActiveTargetsWithHeaders } from './db.js';
import { deliverWebhook } from './utils/delivery.js';
import { buildSignature } from './utils/signer.js';

export class WApp {
  constructor(options = {}) {
    const {
      sessionId,
      headless = (process.env.PUPPETEER_HEADLESS || 'true') === 'true',
      dataDir = process.env.DATA_DIR || '/data',
    } = options;

    if (!sessionId) {
      throw new Error('sessionId es requerido para crear una instancia de WApp');
    }

    this.sessionId = sessionId;
    this._qr = null;
    this._ready = false;

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
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
      logger.warn({ sessionId: this.sessionId }, 'QR generado: escanéalo para iniciar sesión');
    });

    this.client.on('ready', async () => {
      this._ready = true;
      this._qr = null;
      logger.info({ sessionId: this.sessionId }, 'Cliente WhatsApp listo ✅');
      
      // Obtener información del número de teléfono
      try {
        const info = await this.client.info;
        if (info && info.wid) {
          const phoneNumber = info.wid.user;
          // Actualizar phone_number en BD si está disponible
          const { updateSession } = await import('./db.js');
          await updateSession(this.sessionId, { phone_number: phoneNumber });
        }
      } catch (err) {
        logger.warn({ err, sessionId: this.sessionId }, 'No se pudo obtener información del cliente');
      }
    });

    this.client.on('authenticated', () => logger.info({ sessionId: this.sessionId }, 'Autenticado'));
    this.client.on('auth_failure', (m) => logger.error({ m, sessionId: this.sessionId }, 'Fallo de auth'));
    this.client.on('disconnected', (r) => {
      logger.warn({ r, sessionId: this.sessionId }, 'Desconectado, reintentando');
      this._ready = false;
      this.client.initialize();
    });

    // Inbound messages -> deliver webhooks
    this.client.on('message', async (msg) => {
      try {
        console.log("Nuevo mensaje recibido:", msg);
        // Filtrar mensajes: solo mensajes directos (no grupos, no self)
        
        // 1. Ignorar mensajes propios (self messages)
        if (msg.fromMe) {
          logger.debug({ msgId: msg.id.id, sessionId: this.sessionId }, 'Ignorando mensaje propio');
          return;
        }

        // 2. Ignorar mensajes de grupos (solo procesar chats individuales)
        if (msg.from && msg.from.includes('@g.us')) {
          logger.debug({ msgId: msg.id.id, from: msg.from, sessionId: this.sessionId }, 'Ignorando mensaje de grupo');
          return;
        }

        // 3. Solo procesar mensajes directos (chats individuales con @c.us)
        if (!msg.from || !msg.from.includes('@c.us')) {
          logger.debug({ msgId: msg.id.id, from: msg.from, sessionId: this.sessionId }, 'Ignorando mensaje que no es chat directo');
          return;
        }

        // Procesar solo mensajes directos válidos
        const payload = toMetaLikePayload(msg, this.sessionId);
        const bodyStr = JSON.stringify(payload);
        const targets = await getActiveTargetsWithHeaders();
        const webhookCfg = (await getConfig('webhook')) || { signatureHeader: 'X-WApp-Signature-256', signEnabled: true };
        const secret = ((await getConfig('webhookSecret')) || {}).secret || process.env.WEBHOOK_SECRET || '';
        const signature = (webhookCfg.signEnabled && secret) ? buildSignature(secret, bodyStr) : null;
        for (const t of targets) {
          await deliverWebhook(t, bodyStr, signature, webhookCfg.signatureHeader || 'X-WApp-Signature-256');
          logger.info({ url: t.url, msgId: msg.id.id, sessionId: this.sessionId }, 'Webhook entregado');
        }
      } catch (err) {
        logger.error({ err, sessionId: this.sessionId }, 'Fallo entregando webhook');
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

function toMetaLikePayload(msg, sessionId) {
  const from = msg.from.replace('@c.us','');
  const to = (msg.to || '').replace('@c.us','');
  const isText = msg.type === 'chat' || msg.type === 'text';
  return {
    object: 'whatsapp_business_account',
    session_id: sessionId,
    entry: [{
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: to || 'Jhon',
            phone_number_id: sessionId
          },
          messages: [{
            from:'+' + from,
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
