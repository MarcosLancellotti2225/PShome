// El «trabajo» de Signaframe Studio: los archivos de UN formulario, compartidos por todas las pestañas.
// Cada archivo se carga una vez y lo usan Crear formulario, Plantilla y JSON y Probar.
// Se guarda solo en este navegador (IndexedDB) para retomarlo al volver; nunca sale de la compu.
// Las herramientas clásicas lo usan con window.SeTrabajo.guardar(tipo, nombre, datos).
import { useSyncExternalStore } from 'react';

const DB = 'se-tools-studio';
const STORE = 'trabajo';
const KEY = 'actual';
export const TRABAJO_TIPO = 'se-tools/signaframe-trabajo';

/** Archivos que puede tener un trabajo. kind: json (objeto) o bytes (Uint8Array). */
export const ARCHIVOS = {
  pdfOriginal: { label: 'PDF del cliente', desc: 'Tal como lo mandó el cliente', accept: '.pdf', kind: 'bytes' },
  matrizIns: { label: 'Matriz del INS', desc: 'La ficha en Excel que arma el INS (opcional)', accept: '.xlsx', kind: 'bytes' },
  pdf: { label: 'PDF renombrado', desc: 'El PDF con los casilleros renombrados', accept: '.pdf', kind: 'bytes' },
  formDef: { label: 'JSON del formulario', desc: 'El form-def de Signaframe', accept: '.json', kind: 'json' },
  clienteJson: { label: 'JSON del cliente', desc: 'El JSON que el cliente espera recibir', accept: '.json', kind: 'json' },
  payload: { label: 'Datos de prellenado', desc: 'Payload del alta: encabezado + datosFormulario', accept: '.json', kind: 'json' },
  jsonGenerado: { label: 'JSON que generamos', desc: 'Opcional: un JSON ya generado, en vez de simularlo', accept: '.json', kind: 'json' },
  main: { label: 'Main de Signaframe', desc: 'El JSON que devuelve Signaframe al subir el PDF', accept: '.json', kind: 'json' },
  ficha: { label: 'Ficha', desc: 'La ficha que baja Crear formulario', accept: '.xlsx', kind: 'bytes' },
  matriz: { label: 'Matriz interna', desc: 'La matriz que baja Plantilla y JSON', accept: '.xlsx', kind: 'bytes' },
};

const empty = () => ({ nombre: '', archivos: {}, edits: {}, ui: {}, updatedAt: 0 });
let state = empty();
let loaded = false;
const listeners = new Set();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }

// ── IndexedDB (si el navegador no deja, el trabajo vive solo en memoria) ──
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}
let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { idb('readwrite', (s) => s.put(state, KEY)).catch(() => {}); }, 300);
}

function set(next) {
  state = { ...next, updatedAt: Date.now() };
  emit();
  persist();
}

if (typeof indexedDB !== 'undefined') {
  idb('readonly', (s) => s.get(KEY))
    .then((saved) => {
      // Si algo se cargó mientras se leía lo guardado, gana lo nuevo.
      if (saved && !state.updatedAt) state = { ...empty(), ...saved };
    })
    .catch(() => {})
    .finally(() => { loaded = true; emit(); });
} else {
  loaded = true;
}

const sinExtension = (name) => String(name || '').replace(/\.[^.]+$/, '').replace(/_(renombrado|ficha|matriz_interna|form-def_v\d+|original)$/i, '').replace(/ \(ejemplo\)$/, '');

// ── API ──
export const getTrabajo = () => state;
export const isLoaded = () => loaded;

/** Guarda un archivo en el trabajo. data: objeto (json) o Uint8Array (bytes). */
export function guardarArchivo(tipo, name, data) {
  if (!ARCHIVOS[tipo]) throw new Error(`Tipo de archivo desconocido: ${tipo}`);
  const size = data instanceof Uint8Array ? data.byteLength : JSON.stringify(data ?? null).length;
  const archivos = { ...state.archivos, [tipo]: { name, size, data, at: Date.now() } };
  const edits = tipo === 'formDef' || tipo === 'payload' ? {} : state.edits;
  set({ ...state, nombre: state.nombre || sinExtension(name), archivos, edits });
}

export function quitarArchivo(tipo) {
  const archivos = { ...state.archivos };
  delete archivos[tipo];
  set({ ...state, archivos });
}

export function setEdits(edits) { set({ ...state, edits }); }
/** Estado de pantalla que conviene recordar (ej. en qué paso de Crear formulario quedaste). */
export function setUi(patch) { set({ ...state, ui: { ...(state.ui || {}), ...patch } }); }
export function renombrar(nombre) { set({ ...state, nombre }); }
export function nuevoTrabajo() { set(empty()); }

/** Lee un archivo elegido por la persona y lo guarda. Tira error si no es lo que se espera. */
export async function cargarArchivo(tipo, file) {
  const spec = ARCHIVOS[tipo];
  const buf = new Uint8Array(await file.arrayBuffer());
  let data = buf;
  if (spec.kind === 'json') {
    try { data = JSON.parse(new TextDecoder().decode(buf)); } catch { throw new Error(`${spec.label}: «${file.name}» no es un JSON válido.`); }
  }
  guardarArchivo(tipo, file.name, data);
}

// ── Exportar / abrir (.json) ──
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

/**
 * El trabajo como .json. `entrada` es el mismo formato que arma el MCP (mcp/server.mjs),
 * así Claude lo puede abrir; `archivos` lleva además el PDF y los Excel.
 */
export function exportarTrabajo(extra = {}) {
  const a = state.archivos;
  const archivos = {};
  for (const [k, v] of Object.entries(a)) {
    archivos[k] = { name: v.name, ...(ARCHIVOS[k].kind === 'bytes' ? { base64: toB64(v.data) } : { json: v.data }) };
  }
  return {
    tipo: TRABAJO_TIPO,
    version: 2,
    nombre: state.nombre || 'formulario',
    creado: new Date().toISOString(),
    entrada: {
      formDefinition: a.formDef?.data ?? null,
      payload: a.payload?.data ?? null,
      edits: state.edits,
      expectedJson: a.clienteJson?.data ?? null,
    },
    archivos,
    ...extra,
  };
}

/** Abre un trabajo exportado (de la app o del MCP). Reemplaza el actual. */
export function abrirTrabajo(t) {
  if (t?.tipo !== TRABAJO_TIPO) throw new Error('Este archivo no es un trabajo de Signaframe Studio.');
  const archivos = {};
  const now = Date.now();
  for (const [k, v] of Object.entries(t.archivos || {})) {
    if (!ARCHIVOS[k]) continue;
    const data = ARCHIVOS[k].kind === 'bytes' ? fromB64(v.base64 || '') : v.json;
    archivos[k] = { name: v.name, size: v.base64 ? Math.round(v.base64.length * 0.75) : JSON.stringify(data).length, data, at: now };
  }
  const e = t.entrada || {};
  const put = (k, data, name) => { if (data && !archivos[k]) archivos[k] = { name, size: JSON.stringify(data).length, data, at: now }; };
  put('formDef', e.formDefinition, `${t.nombre}_form-def.json`);
  put('payload', e.payload, `${t.nombre}_payload.json`);
  put('clienteJson', e.expectedJson, `${t.nombre}_cliente.json`);
  set({ nombre: t.nombre || '', archivos, edits: e.edits || {}, ui: {} });
}

/** El trabajo en un componente de React: se vuelve a dibujar cuando cambia. */
export function useTrabajo() {
  return useSyncExternalStore(subscribe, getTrabajo, getTrabajo);
}
export function useTrabajoListo() {
  return useSyncExternalStore(subscribe, isLoaded, isLoaded);
}

if (typeof window !== 'undefined') {
  window.SeTrabajo = {
    guardar: (tipo, name, data) => { try { guardarArchivo(tipo, name, data); return true; } catch { return false; } },
    leer: (tipo) => state.archivos[tipo] || null,
  };
}
