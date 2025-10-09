import { Router } from 'express';
import { renderTemplate } from '../utils/templates.js';
import { getTemplates } from '../config.js';

export default function messagesRouter(wapp) {
  const router = Router();

  router.post('/text', async (req, res) => {
    const { from, to, message } = req.body || {};
    if (!to || !message) return res.status(400).json({ error: 'to y message son requeridos' });
    try {
      const id = await wapp.sendText({ from, to: String(to).replace('+',''), message });
      res.json({ id });
    } catch (err) {
      const status = err.message === 'CLIENT_NOT_READY' ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  router.post('/template', async (req, res) => {
    const { from, to, templateId, parameters } = req.body || {};
    if (!to || !templateId) return res.status(400).json({ error: 'to y templateId son requeridos' });
    const templates = await getTemplates();
    const tpl = templates[templateId];
    if (!tpl) return res.status(404).json({ error: 'template no encontrado' });
    try {
      const text = renderTemplate(tpl, parameters || {});
      const id = await wapp.sendRendered({ from, to: String(to).replace('+',''), text });
      res.json({ id });
    } catch (err) {
      const status = err.message === 'CLIENT_NOT_READY' ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  return router;
}
