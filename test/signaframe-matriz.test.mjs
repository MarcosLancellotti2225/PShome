// Matriz interna (src/lib/signaframe-matriz): ficha cerrada + main → matriz interna → JSON del formulario.
// La lógica es copia tal cual de legacy-src/ficha-formulario/interno.html; se comparó contra el original
// en el navegador (window.miRun) con la misma ficha y el mismo main: celdas idénticas.
//   node test/signaframe-matriz.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { matrizInterna } from '../src/lib/signaframe-matriz/index.js';
import { formDefFromMatrixXlsx } from '../src/lib/signaframe-formdef/index.js';

const cat = JSON.parse(fs.readFileSync(new URL('../public/apps/ficha-formulario/docs/catalogo_cr.json', import.meta.url), 'utf8'));

// Ficha sintética, con el formato que baja «Crear formulario».
const wb = new ExcelJS.Workbook();
const f = wb.addWorksheet('Formulario');
f.addRow(['ID', 'Sección', 'Subsección', 'Pregunta', 'Tipo de respuesta', 'Obligatoria', 'Origen', 'Se repite', 'Se arma con / parte de', 'Se muestra si', 'Opciones', 'Reglas / formato', 'Valor o cálculo', 'Casilleros del PDF', 'Estado PDF', 'Ruta JSON', 'Estado JSON', 'Trazabilidad']);
const q = (id, sec, sub, label, tipo, boxes, ruta, opts = '') => f.addRow([id, sec, sub, label, tipo, 'Sí', 'Ficha', 'No', '', '', opts, '', '', boxes, 'Asignado', ruta, 'Confirmado', '']);
q('P-001', 'Datos del cliente', 'Identificación', 'Primer nombre', 'Texto', 'cliente_nombre', 'cliente.primerNombre');
q('P-002', 'Datos del cliente', 'Identificación', 'Fecha de nacimiento', 'Fecha', 'cliente_nac_dia (día)\ncliente_nac_mes (mes)\ncliente_nac_ano (año)', 'cliente.fechaNacimiento');
q('P-003', 'Datos del cliente', 'Identificación', 'Tipo de identificación', 'Una opción de una lista', 'cliente_tipo_dni\ncliente_tipo_pasaporte', 'cliente.tipoIdentificacion', 'DNI = DNI\nPasaporte = PAS');
const o = wb.addWorksheet('Opciones');
o.addRow(['ID', 'Orden', 'Opción (como se ve)', 'Código', 'Casilla del PDF']);
o.addRow(['P-003', 1, 'DNI', 'DNI', 'cliente_tipo_dni']);
o.addRow(['P-003', 2, 'Pasaporte', 'PAS', 'cliente_tipo_pasaporte']);
const j = wb.addWorksheet('JSON del cliente');
j.addRow(['Ruta', 'Ejemplo']);
['cliente.primerNombre', 'cliente.fechaNacimiento', 'cliente.tipoIdentificacion'].forEach((r) => j.addRow([r, 'x']));
const fichaBuf = await wb.xlsx.writeBuffer();

const names = ['cliente_nombre', 'cliente_nac_dia', 'cliente_nac_mes', 'cliente_nac_ano', 'cliente_tipo_dni', 'cliente_tipo_pasaporte', 'uso_interno'];
const main = {
  sections: [{ id: 's', subsections: [], fields: names.map((n, i) => ({
    id: `field_${n}`, type: /tipo_/.test(n) ? 'checkbox' : 'text', label: n,
    sourceMeta: { sourceName: n, page: 1, rect: { x: 10, y: 10 + i * 20, width: 100, height: 14 } },
  })) }],
  _sourcePdf: { fileName: 'x.pdf', pageCount: 1 },
};

const { M, buf } = await matrizInterna({ ExcelJS, fichaBuf, main, cat });
assert.ok(M.counts.campo >= 3, 'arma campos');
const { formDef } = formDefFromMatrixXlsx(new Uint8Array(buf), main, { version: 'v1' });
const ids = [];
const walk = (list) => (list || []).forEach((x) => { ids.push(x.sourceMeta?.sourceName); walk(x.fields); });
formDef.sections.forEach((s) => { walk(s.fields); (s.subsections || []).forEach((x) => walk(x.fields)); });
// La fecha usa sus tres casilleros, el tipo una casilla por opción, y lo que no se usa queda en el form-def igual.
for (const n of names) assert.ok(ids.includes(n), `el form-def usa el casillero ${n}`);

console.log('signaframe-matriz: todas las pruebas OK');

// ── Reconocer archivos (src/lib/signaframe-trabajo/detect.js) ──
{
  const { detectFile } = await import('../src/lib/signaframe-trabajo/detect.js');
  const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
  assert.equal(detectFile('a.pdf', new Uint8Array([1])).tipo, 'pdfOriginal');
  assert.equal(detectFile('m.json', enc(main)).tipo, 'main');
  assert.equal(detectFile('f.json', enc(formDef)).tipo, 'formDef');
  assert.equal(detectFile('c.json', enc({ cliente: { nombre: 'x' } })).tipo, 'clienteJson');
  assert.equal(detectFile('t.json', enc({ tipo: 'se-tools/signaframe-trabajo' })).tipo, 'trabajo');
  assert.equal(detectFile('ficha.xlsx', new Uint8Array(fichaBuf)).tipo, 'ficha');
  assert.equal(detectFile('mi.xlsx', new Uint8Array(buf)).tipo, 'matriz');
  const ins = new ExcelJS.Workbook();
  const s = ins.addWorksheet('Ficha');
  s.addRow(['Título del INS']);
  s.addRow(['Pasos Formulario', 'Sección', 'Nombre en PDF']);
  assert.equal(detectFile('ins.xlsx', new Uint8Array(await ins.xlsx.writeBuffer())).tipo, 'matrizIns');
  assert.equal(detectFile('x.json', new TextEncoder().encode('{mal')).tipo, null);
  console.log('detect: todas las pruebas OK');
}
