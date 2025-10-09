import express from 'express';
import pinoHttp from 'pino-http';
import logger from './logger.js';
import messagesRouter from './routes/messages.js';
import configRouter from './routes/config.js';
import sessionRouter from './routes/session.js';
import webhooksRouter from './routes/webhooks.js';

export function createServer(wapp) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.get('/', (_req, res) => res.json({
    name: 'wwebjs-microservice',
    version: '2.0.0',
    docs: {
      health: '/api/v1/health',
      sendText: '/api/v1/messages/text',
      sendTemplate: '/api/v1/messages/template',
      config: '/api/v1/config',
      qr: '/api/v1/qr',
      webhooks: '/api/v1/webhooks'
    }
  }));

  app.use('/api/v1/messages', messagesRouter(wapp));
  app.use('/api/v1/config', configRouter());
  app.use('/api/v1', sessionRouter(wapp));
  app.use('/api/v1/webhooks', webhooksRouter());

  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', ...wapp.status() }));

  app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Error' });
  });

  return app;
}
