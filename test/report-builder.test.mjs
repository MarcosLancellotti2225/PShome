// Pruebas de Reportes (src/lib/report-builder). Datos sintéticos: no hay datos de clientes.
// Caso principal: reporte de contactos por cuenta de los CSM.
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  readWorkbook, parseDelimited, parsePasted, emptyStats, fillDown, mapColumn, filterRowsByMatch,
  crossSheets, summarize, accountDetail, parseDate, formatDate, detectDateCol, filterByDate,
  buildCsv, buildJson, buildTsv, buildXlsx, buildReportHtml, MATCH_COLS,
} from '../src/lib/report-builder/index.js';

const xlsxBytes = (aoa) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Hoja1');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
};

// ── Lectura: export de Salesforce con metadatos arriba y grupos en la primera fila ──
const cuentasAoa = [
  ['Customer Success Accounts'],
  ['Filtered By: Account Record Type equals Customer'],
  [],
  ['Customer Success Manager', 'Parent Account', 'Account Name', 'Active MRR'],
  ['Ana Pérez', 'Grupo Alfa', 'Alfa SA', '1000'],
  ['', '', 'Alfa Servicios', '500'],
  ['', 'Beta Corp', 'Beta Corp', '2000'],
  ['Luis Gómez', 'Gamma', 'Gamma SRL', '300'],
  ['', 'Delta', 'Delta SA', '700'],
  ['', 'Épsilon', '', '50'],
];
const [cuentas] = readWorkbook(xlsxBytes(cuentasAoa), 'cuentas.xlsx');
assert.deepEqual(cuentas.headers, ['Customer Success Manager', 'Parent Account', 'Account Name', 'Active MRR']);
assert.equal(cuentas.data.length, 6, 'saltea metadatos y filas vacías');

// Rellenar vacíos: recomienda las columnas agrupadas.
const stats = emptyStats(cuentas.data, cuentas.headers);
const rec = stats.filter((s) => s.recommended).map((s) => s.col);
assert.deepEqual(rec, ['Customer Success Manager', 'Parent Account', 'Account Name']);
const filled = fillDown(cuentas.data, ['Customer Success Manager', 'Parent Account']);
assert.equal(filled.changes.length, 5);
assert.equal(filled.rows[5]['Customer Success Manager'], 'Luis Gómez');
assert.equal(filled.rows[1]['Parent Account'], 'Grupo Alfa');
assert.equal(cuentas.data[1]['Parent Account'], '', 'no toca las filas originales');

// Mapear: Account Name vacío ← Parent Account (misma fila).
const mapped = mapColumn(filled.rows, 'Account Name', 'Parent Account', 'same-row');
assert.equal(mapped.changes.length, 1);
assert.equal(mapped.rows[5]['Account Name'], 'Épsilon');
assert.equal(mapped.remaining, 0);
// Lookup cruzado: aprende de las otras filas.
const lk = mapColumn([{ a: 'x', b: '1' }, { a: 'x', b: '' }, { a: 'y', b: '' }], 'b', 'a', 'lookup');
assert.equal(lk.rows[1].b, '1');
assert.deepEqual(lk.unmapped, [{ value: 'y', count: 1 }]);
assert.throws(() => mapColumn([{ a: 'x', b: '' }], 'b', 'a', 'lookup'));

// ── Actividades (CSV con metadatos) ──
const actividadesCsv = [
  'Activities report',
  'As of 01/10/2026',
  'Account Name;Customer Success Manager: Full Name;Owner Name;Date',
  'Alfa SA;Ana Pérez;Ana Pérez;05/09/2026',
  'alfa sa;Ana Pérez;Ana Pérez;20/09/2026',
  'Alfa SA;Ana Pérez;Otro Vendedor;25/09/2026',
  'Gamma SRL;Luis Gómez;Luis Gómez;2026-08-15',
  'Delta SA;Luis Gómez;Luis Gómez;01/01/2025',
].join('\n');
const act = parseDelimited(actividadesCsv);
assert.equal(act.headers.length, 4);
assert.equal(act.data.length, 5);
assert.equal(detectDateCol(act.headers, act.data), 'Date');

// Filtrar filas: solo las del CSM dueño.
const own = filterRowsByMatch(act.data, { colA: 'Customer Success Manager: Full Name', colB: 'Owner Name', mode: 'neq' });
assert.equal(own.removed, 1);
assert.equal(own.rows.length, 4);

// Cruzar: contar contactos por cuenta (solo CSM = Owner) y fechas.
const cross = crossSheets(mapped.rows, act.data, {
  keyA: 'Account Name', keyB: 'Account Name',
  sameA: 'Customer Success Manager: Full Name', sameB: 'Owner Name',
  count: true, last: true, first: true, dateCol: 'Date',
});
assert.deepEqual(cross.newCols, [MATCH_COLS.count, MATCH_COLS.last, MATCH_COLS.first]);
assert.equal(cross.matched, 3);
const alfa = cross.rows.find((r) => r['Account Name'] === 'Alfa SA');
assert.equal(alfa[MATCH_COLS.count], 2, 'sin importar mayúsculas y sin el contacto de otro dueño');
assert.equal(alfa[MATCH_COLS.last], '20/09/2026');
assert.equal(alfa[MATCH_COLS.first], '05/09/2026');
// Con rango de fechas: el contacto de 2025 no cuenta.
const cross26 = crossSheets(mapped.rows, act.data, { keyA: 'Account Name', keyB: 'Account Name', dateCol: 'Date', from: '2026-01-01', to: '2026-12-31' });
assert.equal(cross26.rows.find((r) => r['Account Name'] === 'Delta SA')[MATCH_COLS.count], 0);

// ── Resumen por CSM ──
const sum = summarize(cross.rows, {
  groupBy: 'Customer Success Manager', countCol: 'Parent Account',
  contactCol: MATCH_COLS.count, threshold: 1, sumCol: 'Active MRR',
});
const ana = sum.groups.find((g) => g.key === 'Ana Pérez');
assert.deepEqual([ana.total, ana.contacted, ana.pending, ana.pct, ana.sum], [2, 1, 1, 50, 3500]);
const luis = sum.groups.find((g) => g.key === 'Luis Gómez');
assert.deepEqual([luis.total, luis.contacted, luis.pending, luis.pct, luis.sum], [3, 2, 1, 66.7, 1050]);
assert.deepEqual([sum.totals.total, sum.totals.contacted, sum.totals.pct], [5, 3, 60]);
const totalRow = sum.table[sum.table.length - 1];
assert.equal(totalRow['Customer Success Manager'], 'TOTAL');
assert.equal(totalRow['% Contactadas'], '60%');
assert.deepEqual(sum.columns, ['Customer Success Manager', 'Total Parent Account', 'Contactadas (>=1)', 'Sin contactar', '% Contactadas', 'Suma Active MRR', 'Filas']);

const det = accountDetail(sum, { lastCol: MATCH_COLS.last });
const anaDet = det.find((d) => d.key === 'Ana Pérez').accounts;
assert.equal(anaDet[0].name, 'Beta Corp', 'primero las sin contactar');
assert.equal(anaDet[0].contacted, false);
assert.equal(anaDet[1].last, '20/09/2026');

// ── Exportar ──
const exp = { data: cross.rows.slice(0, 2), dataHeaders: ['Account Name', MATCH_COLS.count], summary: sum.table, sumHeaders: sum.columns };
const csv = buildCsv(exp);
assert.ok(csv.includes('--- RESUMEN ---'));
assert.ok(csv.startsWith('Account Name,Contactos'));
assert.deepEqual(Object.keys(JSON.parse(buildJson(exp))), ['datos', 'resumen']);
assert.ok(buildTsv(exp).startsWith('Customer Success Manager\tTotal Parent Account'));
const buf = await buildXlsx(ExcelJS, exp);
const back = new ExcelJS.Workbook();
await back.xlsx.load(buf);
assert.deepEqual(back.worksheets.map((w) => w.name), ['Datos', 'Resumen']);
const pctCell = back.getWorksheet('Resumen').getCell('E2');
assert.equal(pctCell.value, 0.5);
assert.equal(pctCell.numFmt, '0.0%');

// Reporte HTML
const html = buildReportHtml(sum, det, { period: 'Septiembre 2026', groupLabel: 'CSM', countLabel: 'Cuentas', sumLabel: 'MRR' });
assert.ok(html.includes('Reporte de contactos por cuenta'));
assert.ok(html.includes('Cobertura por CSM'));
assert.ok(html.includes('Beta Corp'));
assert.ok(!html.includes('<script'), 'sin scripts');
assert.ok(buildReportHtml(summarize(cross.rows, { groupBy: 'Customer Success Manager', countCol: 'Parent Account' }), null).includes('Reporte resumen'));

// ── Varios ──
assert.equal(formatDate(parseDate('3/4/26')), '03/04/2026', 'día primero');
assert.equal(formatDate(parseDate('04/13/2026')), '13/04/2026', 'mes primero si el segundo pasa de 12');
assert.equal(filterByDate([{ d: '01/01/2026' }, { d: '' }], 'd', '2026-02-01', '').length, 1, 'sin fecha se mantiene');
assert.deepEqual(parsePasted('[{"a":1}]').headers, ['a']);
assert.equal(parsePasted('a\tb\n1\t2').data[0].b, '2');

console.log('report-builder: ok');
