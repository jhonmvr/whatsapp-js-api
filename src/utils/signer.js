import crypto from 'crypto';
export function buildSignature(secret, bodyStr) {
  const h = crypto.createHmac('sha256', secret).update(bodyStr, 'utf8').digest('hex');
  return `sha256=${h}`;
}
