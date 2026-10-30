// Conexión con Signaturit compartida entre herramientas (Multi Send, Email Templates).
// Vive solo en memoria mientras la app está abierta: el token NO se guarda en el navegador
// ni en el repo. Al recargar la página hay que volver a pegarlo.
const state = { env: 'sandbox', token: '' };
const listeners = new Set();

export function getConnection() {
  return { ...state };
}

export function setConnection(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(getConnection()));
}

export function onConnectionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Normaliza cualquier forma de indicar el entorno ('sandbox', URL de sandbox, etc.).
export const envOf = (value) => (/sandbox/i.test(String(value)) ? 'sandbox' : 'production');

// Conecta un par de campos (entorno + token) de una herramienta con la conexión compartida:
// los completa con lo que ya hay y guarda lo que el usuario escribe.
// toFieldValue(env) convierte 'sandbox'/'production' al valor que usa el <select> de esa herramienta.
export function bindConnectionFields({ envEl, tokenEl, toFieldValue }) {
  const fill = () => {
    const c = getConnection();
    if (tokenEl && !tokenEl.value && c.token) tokenEl.value = c.token;
    if (envEl && c.token) envEl.value = toFieldValue(c.env);
  };
  fill();
  const save = () => setConnection({ env: envOf(envEl?.value), token: (tokenEl?.value || '').trim() });
  envEl?.addEventListener('change', save);
  tokenEl?.addEventListener('input', save);
  return fill; // llamalo cuando la herramienta vuelve a mostrarse
}
