// Utilidades de archivos compartidas por todas las herramientas.
// Todo se procesa en el navegador: nada se sube a un servidor.

export async function readText(file) {
  return await file.text();
}

export async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export async function readJson(file, what = 'El archivo') {
  const text = await readText(file);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${what} no es un JSON válido: ${e.message}`);
  }
}

export function jsonBlob(data) {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(dataUrl, fileName) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function baseName(file, fallback = 'archivo') {
  return file?.name ? file.name.replace(/\.[^.]+$/, '') : fallback;
}

export function formatSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
