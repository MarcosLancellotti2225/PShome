/**
 * Editar la matriz interna (.xlsx) campo por campo, sin perder el formato del Excel.
 * La usa el MCP («editar_matriz») para que Claude cambie la matriz y después arme el JSON.
 *
 * Cada cambio apunta a un campo por su `id` y dice qué tocar:
 *   { id, propiedad: 'label' | 'hidden' | 'maxLength' | …, valor }
 *   { id, opciones: [{ label, pdfValue, jsonValue, parentValues }, …] }   ← reemplaza sus opciones
 * Las propiedades que tienen columna propia (label, type, hidden, jsonOutputPath…) van a
 * esa columna; el resto se guarda en «Otras propiedades» (valor null / '' la quita).
 */
import ExcelJS from 'exceljs';

// Propiedad del form-def → columna de la matriz interna (igual que interno.html).
export const COLUMNS = {
    id: 'id', type: 'Tipo', label: 'Etiqueta', radioGroupLabel: 'Pregunta del grupo', hidden: 'Oculto', readOnly: 'Solo lectura',
    required: 'Obligatorio', width: 'Ancho', jsonOutputPath: 'Ruta JSON', prefillKey: 'Prellenado desde', excludeFromJson: 'Excluir del JSON',
    conditionalVisibility: 'Se muestra si', autoFillConcat: 'Se arma con', sourceName: 'Casillero PDF',
};
const BOOL = new Set(['hidden', 'readOnly', 'required', 'excludeFromJson']);
const BY_COLUMN = Object.fromEntries(Object.entries(COLUMNS).map(([k, v]) => [v.toLowerCase(), k]));
const OPT_HEAD = ['id del campo', 'Orden', 'Etiqueta', 'Valor PDF', 'Valor JSON', 'Depende de (parentValues)', 'Otras propiedades'];

const cellText = (c) => {
    const v = c?.value;
    if (v == null) return '';
    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
        if ('result' in v) return String(v.result ?? '');
        if ('text' in v) return String(v.text);
    }
    return String(v);
};

function headerOf(ws, must) {
    for (let r = 1; r <= Math.min(8, ws.rowCount); r++) {
        const map = {};
        ws.getRow(r).eachCell({ includeEmpty: false }, (c, col) => { map[cellText(c).trim()] = col; });
        if (must.every((m) => map[m])) return { row: r, col: map };
    }
    return null;
}

/**
 * @param {Uint8Array|ArrayBuffer} bytes - matriz interna
 * @param {Array} cambios
 * @returns {Promise<{bytes: Uint8Array, aplicados: string[], errores: string[]}>}
 */
export async function editMatrixXlsx(bytes, cambios) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    const ws = wb.worksheets.find((w) => /formulario\s+signaframe/i.test(w.name));
    if (!ws) throw new Error('No es una matriz interna: falta la hoja «Formulario Signaframe».');
    const h = headerOf(ws, ['Nivel', 'id']);
    if (!h) throw new Error('La hoja «Formulario Signaframe» no tiene las columnas Nivel e id.');
    const rowOf = new Map();
    for (let r = h.row + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        if (cellText(row.getCell(h.col.Nivel)).trim().toLowerCase() !== 'campo') continue;
        const id = cellText(row.getCell(h.col.id)).trim();
        if (id && !rowOf.has(id)) rowOf.set(id, r);
    }
    let wo = wb.worksheets.find((w) => /^opciones$/i.test(w.name.trim()));
    const aplicados = [];
    const errores = [];

    for (const c of cambios || []) {
        const r = rowOf.get(String(c.id || '').trim());
        if (!r) { errores.push(`No encuentro el campo ${c.id} en la matriz`); continue; }
        const row = ws.getRow(r);

        if (Array.isArray(c.opciones)) {
            if (!wo) { wo = wb.addWorksheet('Opciones'); wo.addRow(OPT_HEAD); }
            const ho = headerOf(wo, ['id del campo', 'Etiqueta']);
            const idCol = ho.col['id del campo'];
            for (let i = wo.rowCount; i > ho.row; i--) if (cellText(wo.getRow(i).getCell(idCol)).trim() === c.id) wo.spliceRows(i, 1);
            c.opciones.forEach((o, i) => {
                const { label, pdfValue, jsonValue, parentValues, ...rest } = o;
                wo.addRow([c.id, i + 1, label ?? '', pdfValue ?? '', jsonValue ?? '', parentValues === '' ? '(vacío)' : (parentValues ?? ''), Object.keys(rest).length ? JSON.stringify(rest) : '']);
            });
            if (h.col.Opciones) row.getCell(h.col.Opciones).value = c.opciones.length ? `${c.opciones.length} opciones → hoja Opciones` : '';
            aplicados.push(`${c.id}: ${c.opciones.length} opciones`);
            continue;
        }

        const raw = String(c.propiedad || c.columna || '').trim();
        if (!raw) { errores.push(`${c.id}: falta la propiedad a cambiar`); continue; }
        const prop = COLUMNS[raw] ? raw : (BY_COLUMN[raw.toLowerCase()] || raw);
        const col = COLUMNS[prop];
        if (prop === 'id') { errores.push(`${c.id}: el id no se cambia desde acá (regla de oro)`); continue; }
        if (col && h.col[col]) {
            let v = c.valor;
            if (BOOL.has(prop)) v = v === true || /^(s[ií]|true|1)$/i.test(String(v ?? '')) ? 'Sí' : '';
            else if (v != null && typeof v === 'object') v = JSON.stringify(v);
            row.getCell(h.col[col]).value = v == null ? '' : v;
            aplicados.push(`${c.id}: ${col} = ${v === '' ? '(vacío)' : String(v).slice(0, 60)}`);
        } else {
            const oc = h.col['Otras propiedades'];
            if (!oc) { errores.push(`${c.id}: la matriz no tiene la columna «Otras propiedades»`); continue; }
            let extra = {};
            const t = cellText(row.getCell(oc)).trim();
            if (t) { try { extra = JSON.parse(t); } catch { errores.push(`${c.id}: «Otras propiedades» no es un JSON válido; no se tocó`); continue; } }
            if (c.valor === null || c.valor === undefined || c.valor === '') delete extra[prop];
            else extra[prop] = c.valor;
            row.getCell(oc).value = Object.keys(extra).length ? JSON.stringify(extra) : '';
            aplicados.push(`${c.id}: ${prop} = ${c.valor == null || c.valor === '' ? '(quitado)' : JSON.stringify(c.valor).slice(0, 60)}`);
        }
    }
    const out = new Uint8Array(await wb.xlsx.writeBuffer());
    return { bytes: out, aplicados, errores };
}
