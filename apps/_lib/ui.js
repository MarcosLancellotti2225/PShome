// Helpers compartidos por las apps construidas con Vite (apps/<id>/).
// Vienen de app.js de FormConverterExcel (sección SHARED) y de src/browser.js.

// Dentro del hub la app corre en un iframe: se oculta su cabecera propia.
if (window.self !== window.top) document.documentElement.classList.add('embedded');

export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function formatSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

// Marca el casillero de archivo como cargado y muestra nombre y tamaño.
export function updateSfFileStatus(elId, file) {
  const el = document.getElementById(elId);
  const slot = el.closest('.file-slot');
  if (file) {
    slot.classList.add('loaded');
    el.textContent = '✓ ' + file.name + ' (' + formatSize(file.size) + ')';
  } else {
    slot.classList.remove('loaded');
    el.textContent = '';
  }
}

export async function fileToText(file) {
  return await file.text();
}

export async function fileToUint8Array(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export function jsonToBlob(json) {
  return new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8' });
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
