/**
 * Cliente de la API de Signaframe (https://signaframe.namirial.com/api/swagger).
 *
 * Sin dependencias: usa fetch, así anda en Node (MCP) y en el navegador.
 * Autenticación Bearer (JWT):
 *   - `token`: un accessToken ya obtenido;
 *   - `email` + `password`: hace login solo y renueva con el refreshToken cuando vence.
 * Casi todas las respuestas vienen como { data: … }: `call` devuelve directamente `data`.
 *
 * Solo lo que usan las herramientas de SE Tools: plantillas, formularios, listas
 * predefinidas, procesos (lectura y alta de prueba) y relleno de PDF. No borra nada.
 */

export const DEFAULT_URL = 'https://signaframe.namirial.com';

export class SignaframeError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name = 'SignaframeError';
        this.status = status;
        this.body = body;
    }
}

const qs = (params = {}) => {
    const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return p.length ? '?' + p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
};

/**
 * @param {{url?: string, token?: string, email?: string, password?: string, fetch?: Function}} cfg
 */
export function createClient(cfg = {}) {
    const base = String(cfg.url || DEFAULT_URL).replace(/\/+$/, '');
    const doFetch = cfg.fetch || globalThis.fetch;
    let accessToken = cfg.token || null;
    let refreshToken = null;

    async function login() {
        if (!cfg.email || !cfg.password) return false;
        const r = await raw('POST', '/api/auth/login', { email: cfg.email, password: cfg.password }, false);
        accessToken = r?.data?.accessToken || null;
        refreshToken = r?.data?.refreshToken || null;
        return !!accessToken;
    }

    async function refresh() {
        if (!refreshToken) return false;
        try {
            const r = await raw('POST', '/api/auth/refresh', { refreshToken }, false);
            accessToken = r?.data?.accessToken || null;
            refreshToken = r?.data?.refreshToken || refreshToken;
            return !!accessToken;
        } catch { return false; }
    }

    async function raw(method, path, body, auth = true) {
        const headers = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await doFetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        if (!res.ok) {
            const msg = json?.message || json?.title || json?.error || (text && text.slice(0, 200)) || res.statusText;
            throw new SignaframeError(`Signaframe respondió ${res.status} en ${method} ${path}: ${msg}`, res.status, json ?? text);
        }
        return json;
    }

    /** Llama a la API, con login/renovación automáticos ante un 401. Devuelve `data` si viene envuelto. */
    async function call(method, path, body) {
        if (!accessToken && !(await login())) {
            throw new SignaframeError('No hay credenciales de Signaframe: falta SIGNAFRAME_TOKEN o SIGNAFRAME_EMAIL + SIGNAFRAME_PASSWORD en la config.', 401);
        }
        try {
            const r = await raw(method, path, body);
            return r && typeof r === 'object' && 'data' in r ? r.data : r;
        } catch (e) {
            if (e.status === 401 && ((await refresh()) || (await login()))) {
                const r = await raw(method, path, body);
                return r && typeof r === 'object' && 'data' in r ? r.data : r;
            }
            throw e;
        }
    }

    return {
        base,
        call,
        // Conexión
        version: () => raw('GET', '/api/version', undefined, false),
        me: () => call('GET', '/api/auth/me'),
        // Plantillas
        listTemplates: (p = {}) => call('GET', `/api/templates${qs({ size: 50, ...p })}`),
        getTemplate: (id) => call('GET', `/api/templates/${encodeURIComponent(id)}`),
        updateTemplate: (id, body) => call('PUT', `/api/templates/${encodeURIComponent(id)}`, { id, ...body }),
        publishTemplate: (id) => call('PATCH', `/api/templates/${encodeURIComponent(id)}/publish`),
        unpublishTemplate: (id) => call('POST', `/api/templates/${encodeURIComponent(id)}/unpublish`),
        fillTemplatePdf: (id, fieldValues) => call('POST', `/api/templates/${encodeURIComponent(id)}/pdf-fill`, { fieldValues }),
        // Formularios (agrupan plantillas)
        listFormularios: (p = {}) => call('GET', `/api/formularios${qs({ size: 50, ...p })}`),
        getFormulario: (id) => call('GET', `/api/formularios/${encodeURIComponent(id)}`),
        // Listas predefinidas (catálogos)
        listPresetLists: (p = {}) => call('GET', `/api/preset-lists${qs({ size: 50, ...p })}`),
        getPresetList: (id) => call('GET', `/api/preset-lists/${encodeURIComponent(id)}`),
        // Procesos
        listProcesses: (p = {}) => call('GET', `/api/processes${qs({ size: 20, ...p })}`),
        getProcess: (id) => call('GET', `/api/processes/${encodeURIComponent(id)}`),
        processAudit: (id) => call('GET', `/api/processes/${encodeURIComponent(id)}/audit-events`),
        processCallbacks: (id) => call('GET', `/api/processes/${encodeURIComponent(id)}/callbacks`),
        createProcess: (payload) => call('POST', '/api/processes', payload),
    };
}

/** El form-def de una plantilla: `jsonDefinition` viene serializado como string. */
export function templateFormDef(tpl) {
    const j = tpl?.jsonDefinition;
    if (!j) return null;
    if (typeof j === 'object') return j;
    try { return JSON.parse(j); } catch { return null; }
}
