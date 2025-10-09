export function renderTemplate(template, params = {}) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = params[key];
    return v === undefined || v === null ? '' : String(v);
  });
}
