// Exportar en Reportes: CSV, TSV (copiar), JSON y Excel con formato.
// Igual que el original (Datos / Resumen / ambos); el Excel usa ExcelJS para que los
// colores salgan de verdad (la versión gratuita de SheetJS no escribe estilos).

const BRAND = { head: 'FF047C76', headText: 'FFFFFFFF', total: 'FFDEFFFB', border: 'FFCDDBDB' };
const PCT = {
  bad: { font: 'FFAD4546', fill: 'FFF9E3E3' },
  warn: { font: 'FF8C6410', fill: 'FFFCEFD2' },
  good: { font: 'FF198446', fill: 'FFE3F5EA' },
};

export const pctTone = (pct) => (pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad');

function cell(v, sep) {
  const s = String(v ?? '');
  if (s.includes(sep) || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toDelimited(headers, rows, sep = ',') {
  return [headers.map((h) => cell(h, sep)).join(sep), ...rows.map((r) => headers.map((h) => cell(r[h], sep)).join(sep))].join('\n');
}

/** exp = { data?, dataHeaders, summary?, sumHeaders } */
export function buildCsv(exp) {
  const parts = [];
  if (exp.data) parts.push(toDelimited(exp.dataHeaders, exp.data));
  if (exp.summary) {
    if (parts.length) parts.push('\n--- RESUMEN ---');
    parts.push(toDelimited(exp.sumHeaders, exp.summary));
  }
  return parts.join('\n');
}

export function buildJson(exp) {
  if (exp.data && !exp.summary) return JSON.stringify(exp.data, null, 2);
  const out = {};
  if (exp.data) out.datos = exp.data;
  if (exp.summary) out.resumen = exp.summary;
  return JSON.stringify(out, null, 2);
}

/** Para pegar en Excel o Sheets: el resumen si hay, si no los datos. */
export function buildTsv(exp) {
  const rows = exp.summary || exp.data || [];
  const headers = exp.summary ? exp.sumHeaders : exp.dataHeaders;
  return `${headers.join('\t')}\n${rows.map((r) => headers.map((h) => String(r[h] ?? '')).join('\t')).join('\n')}\n`;
}

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: BRAND.headText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.head } };
    c.alignment = { vertical: 'middle' };
  });
  row.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const asCellValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'number') return v;
  const s = String(v);
  return /^-?\d+(\.\d+)?$/.test(s.trim()) && s.trim().length < 15 ? Number(s) : s;
};

/**
 * Excel con formato: hoja «Datos» y/o «Resumen» (encabezado teal, % coloreado, fila TOTAL).
 * @param ExcelJS - el módulo (en el navegador, 'exceljs/dist/exceljs.min.js'; en Node, 'exceljs').
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildXlsx(ExcelJS, exp) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SE Tools';
  if (exp.data) {
    const ws = wb.addWorksheet('Datos');
    ws.addRow(exp.dataHeaders);
    exp.data.forEach((r) => ws.addRow(exp.dataHeaders.map((h) => asCellValue(r[h]))));
    ws.columns.forEach((col, i) => {
      const h = exp.dataHeaders[i];
      let max = Math.max(String(h).length, 10);
      exp.data.slice(0, 50).forEach((r) => { max = Math.max(max, String(r[h] ?? '').length); });
      col.width = Math.min(max + 2, 40);
    });
    styleHeader(ws);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: exp.dataHeaders.length } };
  }
  if (exp.summary) {
    const ws = wb.addWorksheet('Resumen');
    ws.addRow(exp.sumHeaders);
    const pctIdx = exp.sumHeaders.indexOf('% Contactadas');
    exp.summary.forEach((r) => {
      ws.addRow(exp.sumHeaders.map((h, i) => {
        const v = r[h];
        if (i === pctIdx && typeof v === 'string' && v.includes('%')) { const n = parseFloat(v); if (!Number.isNaN(n)) return n / 100; }
        return asCellValue(v);
      }));
    });
    ws.columns.forEach((col, i) => { col.width = Math.max(String(exp.sumHeaders[i]).length + 2, 18); });
    styleHeader(ws);
    const last = exp.summary.length + 1;
    for (let r = 2; r <= last; r++) {
      const row = ws.getRow(r);
      if (pctIdx !== -1) {
        const c = row.getCell(pctIdx + 1);
        if (typeof c.value === 'number') {
          c.numFmt = '0.0%';
          const tone = PCT[pctTone(c.value * 100)];
          c.font = { bold: true, color: { argb: tone.font } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.fill } };
        }
      }
      const isTotal = String(row.getCell(1).value) === 'TOTAL' && r === last;
      if (isTotal) {
        row.eachCell((c) => {
          c.font = { ...(c.font || {}), bold: true };
          if (exp.sumHeaders[Number(c.col) - 1] !== '% Contactadas') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.total } };
          c.border = { top: { style: 'medium', color: { argb: BRAND.head } } };
        });
      }
    }
  }
  return wb.xlsx.writeBuffer();
}
