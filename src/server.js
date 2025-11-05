import express from 'express';
import pinoHttp from 'pino-http';
import logger from './logger.js';
import messagesRouter from './routes/messages.js';
import configRouter from './routes/config.js';
import sessionRouter from './routes/session.js';
import sessionsRouter from './routes/sessions.js';
import webhooksRouter from './routes/webhooks.js';

export function createServer(sessionManager) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.get('/', (_req, res) => res.json({
    name: 'wwebjs-microservice',
    version: '2.0.0',
    docs: {
      health: '/api/v1/health',
      sessions: '/api/v1/sessions',
      sendText: '/api/v1/messages/text?sessionId=xxx',
      sendTemplate: '/api/v1/messages/template?sessionId=xxx',
      config: '/api/v1/config',
      qr: '/api/v1/sessions/:sessionId/qr (HTML)',
      qrJson: '/api/v1/sessions/:sessionId/qr?format=json (JSON)',
      webhooks: '/api/v1/webhooks'
    }
  }));

  app.use('/api/v1/messages', messagesRouter(sessionManager));
  app.use('/api/v1/config', configRouter());
  app.use('/api/v1/sessions', sessionsRouter(sessionManager));
  app.use('/api/v1', sessionRouter(sessionManager));
  app.use('/api/v1/webhooks', webhooksRouter());

  app.get('/api/v1/health', async (_req, res) => {
    try {
      const sessions = await sessionManager.listSessions();
      res.json({ 
        status: 'ok',
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status?.ready).length
      });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Error' });
  });

  return app;
}
