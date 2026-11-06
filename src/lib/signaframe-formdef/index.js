/**
 * JSON del formulario (form-def de Signaframe) desde la matriz interna.
 * Ver build.js. Acá: leer el Excel de la matriz y revisar el resultado.
 */
import * as XLSX from 'xlsx';
import { buildFormDef, matrixFromRows, allFields, mainFields } from './build.js';

export { buildFormDef, matrixFromRows, allFields, mainFields };

const HOJA = /formulario\s+signaframe/i;

/** Filas de una hoja como objetos, usando la primera fila que tenga todas las columnas pedidas. */
function sheetObjects(ws, mustHave) {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const h = raw.findIndex((r) => mustHave.every((c) => r.some((x) => String(x).trim() === c)));
    if (h < 0) return null;
    const head = raw[h].map((x) => String(x).trim());
    return raw.slice(h + 1).map((r) => {
        const o = {};
        head.forEach((k, i) => { if (k && o[k] === undefined) o[k] = r[i]; });
        return o;
    });
}

/**
 * Lee el Excel de la matriz interna (hojas «Formulario Signaframe» y «Opciones»).
 * @returns {{steps, warn}} o lanza un Error si no es una matriz interna.
 */
export function readMatrixXlsx(bytes) {
    const wb = XLSX.read(bytes, { type: 'array' });
    const name = wb.SheetNames.find((n) => HOJA.test(n));
    if (!name) throw new Error('No es una matriz interna: falta la hoja «Formulario Signaframe».');
    const rows = sheetObjects(wb.Sheets[name], ['Nivel', 'id', 'Tipo']);
    if (!rows) throw new Error('La hoja «Formulario Signaframe» no tiene las columnas Nivel, id y Tipo.');
    const optName = wb.SheetNames.find((n) => /^opciones$/i.test(n.trim()));
    const opts = optName ? sheetObjects(wb.Sheets[optName], ['id del campo', 'Etiqueta']) || [] : [];
    return matrixFromRows(rows, opts);
}

/** Matriz interna (Excel) + main → form-def. */
export function formDefFromMatrixXlsx(bytes, main, opts = {}) {
    return buildFormDef(readMatrixXlsx(bytes), main, opts);
}
