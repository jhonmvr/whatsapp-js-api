import 'dotenv/config';
import logger from './logger.js';
import { migrate } from './db.js';
import { SessionManager } from './session-manager.js';
import { createServer } from './server.js';

async function main() {
  await migrate();

  const sessionManager = new SessionManager();
  
  // Cargar sesiones existentes desde BD
  await sessionManager.loadSessions();
  
  logger.info('SessionManager inicializado');

  const app = createServer(sessionManager);
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => logger.info({ port }, 'HTTP server listening'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
