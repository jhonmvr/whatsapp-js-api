import { Router } from 'express';
import { renderTemplate } from '../utils/templates.js';
import { getTemplates } from '../config.js';

export default function messagesRouter(sessionManager) {
  const router = Router();

  // Middleware para obtener sessionId (query param, body, o header)
  function getSessionId(req) {
    return req.query.sessionId || req.body.sessionId || req.headers['x-session-id'];
  }

  // Middleware para validar sesión
  function validateSession(req, res, next) {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId es requerido (query param, body, o header X-Session-Id)' });
    }
    const wapp = sessionManager.getSession(sessionId);
    if (!wapp) {
      return res.status(404).json({ error: `Sesión ${sessionId} no encontrada` });
    }
    req.wapp = wapp;
    req.sessionId = sessionId;
    next();
  }

  router.post('/text', validateSession, async (req, res) => {
    const { from, to, message } = req.body || {};
    const { wapp } = req;
    console.log("request body:", req.body);
    if (!to || !message) return res.status(400).json({ error: 'to y message son requeridos' });
    try {
      const id = await wapp.sendText({ from, to: String(to).replace('+',''), message });
      res.json({ id });
    } catch (err) {
      const status = err.message === 'CLIENT_NOT_READY' ? 503 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  router.post('/template', validateSession, async (req, res) => {
    const { from, to, templateId, parameters } = req.body || {};
    const { wapp } = req;
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
