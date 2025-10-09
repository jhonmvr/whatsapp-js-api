import { Router } from 'express';
import { readConfigAll, writeConfigAll, upsertTemplate, deleteTemplate } from '../config.js';

export default function configRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await readConfigAll());
  });

  router.put('/', async (req, res) => {
    const updated = await writeConfigAll(req.body || {});
    res.json(updated);
  });

  router.patch('/templates/:id', async (req, res) => {
    const id = req.params.id;
    const { template } = req.body || {};
    if (!template) return res.status(400).json({ error: 'template requerido' });
    await upsertTemplate(id, template);
    res.json({ ok: true, id });
  });

  router.delete('/templates/:id', async (req, res) => {
    const id = req.params.id;
    const ok = await deleteTemplate(id);
    if (!ok) return res.status(404).json({ error: 'no existe' });
    res.json({ ok: true });
  });

  return router;
}
