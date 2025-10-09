import { Router } from 'express';
import { listWebhookTargets, replaceWebhookTargets, getConfig, setConfig } from '../db.js';

export default function webhooksRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const targets = await listWebhookTargets();
    const webhookCfg = await getConfig('webhook');
    res.json({ targets, webhook: webhookCfg || {} });
  });

  router.put('/', async (req, res) => {
    const { targets, webhook } = req.body || {};
    if (!Array.isArray(targets)) return res.status(400).json({ error: 'targets debe ser array' });
    await replaceWebhookTargets(targets);
    if (webhook) await setConfig('webhook', webhook);
    const out = await listWebhookTargets();
    res.json({ ok: true, targets: out, webhook });
  });

  router.put('/secret', async (req, res) => {
    const { secret } = req.body || {};
    await setConfig('webhookSecret', { secret: secret || '' });
    res.json({ ok: true });
  });

  return router;
}
