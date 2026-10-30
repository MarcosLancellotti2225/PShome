// Guarda el trabajo en curso en el navegador (IndexedDB) para no perderlo si se recarga la página.
// Solo en esta compu y este navegador. Si el navegador no lo permite, el editor sigue andando igual.
const DB = 'pstools';
const STORE = 'editor-pdf';
const KEY = 'actual';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveWork(work) {
  try { await run('readwrite', (s) => s.put({ ...work, savedAt: Date.now() }, KEY)); } catch { /* sin guardado local */ }
}

export async function loadWork() {
  try { return (await run('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}

export async function clearWork() {
  try { await run('readwrite', (s) => s.delete(KEY)); } catch { /* nada */ }
}
