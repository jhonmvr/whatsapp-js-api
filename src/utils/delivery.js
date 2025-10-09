import logger from '../logger.js';
import { logDelivery } from '../db.js';

export async function deliverWebhook(target, bodyStr, signature, signatureHeaderName='X-WApp-Signature-256') {
  const headers = { 'Content-Type': 'application/json' };
  for (const [k,v] of target.headers || []) headers[k] = v;
  if (signature) headers[signatureHeaderName] = signature;

  const maxRetries = 5;
  let attempt = 0;
  let delayMs = 500;

  while (true) {
    try {
      const res = await fetch(target.url, { method: 'POST', headers, body: bodyStr });
      const status = res.status;
      if (status < 200 || status >= 300) {
          throw new Error('Delivery failed')
      }
      if (!res.ok) throw new Error(`HTTP ${status}`);
      await logDelivery(target.id, bodyStr, status, null);
      return;
    } catch (err) {
      attempt++;
      await logDelivery(target.id, bodyStr, null, String(err));
      if (attempt > maxRetries) {
        logger.error({ url: target.url, err: String(err) }, 'Entrega de webhook falló definitivamente');
        throw err;
      }
      logger.warn({ url: target.url, attempt, err: String(err) }, 'Reintentando webhook');
      await new Promise(r => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 8000);
    }
  }
}
