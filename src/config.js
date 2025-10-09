import logger from './logger.js';
import { getConfig, setConfig } from './db.js';

export async function readConfigAll() {
  const [templates, rateLimit, webhook, webhookSecret] = await Promise.all([
    getConfig('templates'), getConfig('rateLimit'), getConfig('webhook'), getConfig('webhookSecret')
  ]);
  return { templates: templates||{}, rateLimit: rateLimit||{}, webhook: webhook||{}, webhookSecret: webhookSecret||{} };
}

export async function writeConfigAll(obj) {
  if (obj.templates !== undefined) await setConfig('templates', obj.templates);
  if (obj.rateLimit !== undefined) await setConfig('rateLimit', obj.rateLimit);
  if (obj.webhook !== undefined) await setConfig('webhook', obj.webhook);
  if (obj.webhookSecret !== undefined) await setConfig('webhookSecret', obj.webhookSecret);
  logger.info('Config updated');
  return readConfigAll();
}

export async function getTemplates() {
  return (await getConfig('templates')) || {};
}

export async function upsertTemplate(id, template) {
  const curr = (await getConfig('templates')) || {};
  curr[id] = template;
  await setConfig('templates', curr);
  return id;
}

export async function deleteTemplate(id) {
  const curr = (await getConfig('templates')) || {};
  if (!curr[id]) return false;
  delete curr[id];
  await setConfig('templates', curr);
  return true;
}
