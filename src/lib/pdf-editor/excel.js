// Importar y exportar nombres de campos en Excel.
// Formato de ida y vuelta: columnas «AcroForm Actual» y «AcroForm Propuesto» (el de la matriz de 22 columnas).
import * as XLSX from 'xlsx';
import { typeLabel, isRenamed } from './model.js';

const clean = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Hoja preferida: la que se llama «formulario…»; si no, la más larga. (Igual que name-resolver.js)
function findMatrixSheet(wb) {
  const preferred = wb.SheetNames.find((n) => /formulario\s*digital/i.test(n) || /formulario/i.test(n));
  if (preferred) return preferred;
  let biggest = wb.SheetNames[0]; let maxRows = 0;
  for (const n of wb.SheetNames) {
    const range = XLSX.utils.decode_range(wb.Sheets[n]['!ref'] || 'A1');
    const rows = range.e.r - range.s.r + 1;
    if (rows > maxRows) { maxRows = rows; biggest = n; }
  }
  return biggest;
}

// Lee el Excel. Si encuentra «AcroForm Actual» / «AcroForm Propuesto» devuelve las filas listas;
// si no, devuelve los encabezados para que la persona elija las columnas.
export function readNamesExcel(bytes) {
  const wb = XLSX.read(bytes, { type: 'array' });
  const sheetName = findMatrixSheet(wb);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] || [];
    let a = -1; let p = -1;
    row.forEach((cell, j) => {
      const c = clean(cell).toLowerCase();
      if (/acroform\s*actual/.test(c)) a = j;
      if (/acroform\s*propuesto/.test(c)) p = j;
    });
    if (a >= 0 && p >= 0) {
      const entries = rows.slice(i + 1)
        .map((r) => ({ oldName: clean(r[a]), newName: clean(r[p]) }))
        .filter((e) => e.oldName)
        .map((e) => ({ ...e, newName: e.newName || e.oldName }));
      return { format: 'matriz', sheetName, entries };
    }
  }
  if (rows.length < 2) throw new Error('El Excel está vacío.');
  const headers = rows[0].map((h, i) => clean(h) || `Columna ${i + 1}`);
  return { format: 'columnas', sheetName, headers, rows: rows.slice(1) };
}

export function entriesFromColumns(rows, colOld, colNew) {
  return rows
    .map((r) => ({ oldName: clean(r[colOld]), newName: clean(r[colNew]) }))
    .filter((e) => e.oldName)
    .map((e) => ({ ...e, newName: e.newName || e.oldName }));
}

// Excel de campos: sirve de lista (Detector) y de mapeo para volver a importar (Convertir PDF).
export function fieldsToExcel(fields) {
  const head = ['AcroForm Actual', 'AcroForm Propuesto', 'Tipo', 'Página', 'Estado', 'X', 'Y', 'Ancho', 'Alto', 'Fuente'];
  const data = fields.map((f) => [
    f.isNew ? '' : f.orig.name,
    f.deleted ? '' : f.name,
    typeLabel(f.type),
    f.page,
    f.isNew ? 'Nuevo' : f.deleted ? 'Borrado' : isRenamed(f) ? 'Renombrado' : 'Sin cambios',
    f.x, f.y, f.width, f.height,
    f.fontSize === 0 ? 'Auto' : f.fontSize ?? '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([head, ...data]);
  ws['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Campos');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}
