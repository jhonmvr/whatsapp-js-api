import { Router } from 'express';

export default function sessionRouter(wapp) {
  const router = Router();

  router.get('/health', (_req, res) => res.json({ status: 'ok', ...wapp.status() }));

  router.get('/qr', (_req, res) => {
    const qr = wapp.qr();
    if (!qr) return res.status(204).end();
    res.json({ qr });
  });

  router.post('/reinit', async (_req, res) => {
    await wapp.initialize();
    res.json({ ok: true });
  });

  return router;
}
