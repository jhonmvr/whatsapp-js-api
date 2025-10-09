import 'dotenv/config';
import logger from './logger.js';
import { migrate } from './db.js';
import { WApp } from './wapp.js';
import { createServer } from './server.js';

async function main() {
  await migrate();

  const wapp = new WApp({});
  await wapp.initialize();

  const app = createServer(wapp);
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => logger.info({ port }, 'HTTP server listening'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
