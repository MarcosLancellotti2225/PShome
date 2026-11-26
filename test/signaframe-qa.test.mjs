// Pruebas de «Probar» de Signaframe Studio (src/lib/signaframe-qa) con un PDF y un form-def sintéticos.
//   node test/signaframe-qa.test.mjs
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { compareJson, pdfValuesFor, fillFormPdf } from '../src/lib/signaframe-qa/index.js';
import { simulate } from '../src/lib/signaframe-engine/index.js';

// ── Probar JSON ──
{
  const ours = { datos: { nombre: 'Ana', edad: '30', hijos: [{ n: 'Leo' }], extra: true } };
  const client = { datos: { nombre: 'Ana', edad: 30, hijos: [{ n: 'Luz' }], pais: 'CR' } };
  const r = compareJson(ours, client);
  const st = Object.fromEntries(r.rows.map((x) => [x.path, x.status]));
  assert.deepEqual(st, {
    'datos.nombre': 'igual', 'datos.edad': 'tipo', 'datos.hijos.0.n': 'distinto', 'datos.pais': 'falta', 'datos.extra': 'sobra',
  });
  assert.equal(r.identical, false);
  assert.equal(compareJson(client, structuredClone(client)).identical, true);
}

// ── Probar PDF ──
const doc = await PDFDocument.create();
const page = doc.addPage([400, 300]);
const form = doc.getForm();
const t1 = form.createTextField('cliente_nombre'); t1.addToPage(page, { x: 20, y: 240, width: 200, height: 18 });
const t2 = form.createTextField('cliente_corto'); t2.addToPage(page, { x: 20, y: 200, width: 40, height: 18 }); t2.setFontSize(10);
const c1 = form.createCheckBox('acepta'); c1.addToPage(page, { x: 20, y: 160, width: 12, height: 12 });
const t3 = form.createTextField('uso_interno'); t3.addToPage(page, { x: 20, y: 120, width: 100, height: 18 });
const bytes = await doc.save();

const formDef = {
  sections: [{
    id: 's1',
    fields: [
      { id: 'field_nombre', type: 'text', label: 'Nombre', prefillKey: 'datos.nombre', jsonOutputPath: 'datos.nombre', sourceMeta: { sourceName: 'cliente_nombre' } },
      { id: 'field_corto', type: 'text', label: 'Corto', prefillKey: 'datos.corto', sourceMeta: { sourceName: 'cliente_corto' } },
      { id: 'field_acepta', type: 'checkbox', label: 'Acepta', jsonOutputPath: 'datos.acepta', sourceMeta: { sourceName: 'acepta' } },
      { id: 'field_fantasma', type: 'text', label: 'No está en el PDF', sourceMeta: { sourceName: 'no_existe' } },
      { id: 'field_sin_pdf', type: 'text', label: 'Solo JSON', prefillKey: 'datos.otro', jsonOutputPath: 'datos.otro' },
    ],
  }],
};
const sim = simulate({
  formDefinition: formDef,
  payload: { datos: { nombre: 'María Fernanda', corto: 'UN TEXTO MUY LARGO QUE NO ENTRA', otro: 'x' } },
  edits: { field_acepta: 'true' },
});
const { values, referenced, sinCasillero } = pdfValuesFor(formDef, sim.pdf);
assert.equal(values.cliente_nombre, 'María Fernanda');
assert.ok(values.acepta);
assert.ok(sinCasillero.includes('sin_pdf'));
const r = await fillFormPdf(bytes, values, { referenced });
assert.deepEqual(r.pintados.sort(), ['acepta', 'cliente_corto', 'cliente_nombre']);
assert.deepEqual(r.noEsta, ['no_existe']);
assert.deepEqual(r.sinUsar, ['uso_interno']);
assert.deepEqual(r.noEntran.map((x) => x.field), ['cliente_corto']);
assert.equal(r.widgets.length, 4);
const back = (await PDFDocument.load(r.pdfBytes)).getForm();
assert.equal(back.getTextField('cliente_nombre').getText(), 'María Fernanda');
assert.equal(back.getCheckBox('acepta').isChecked(), true);

// Con datos de prueba se completan los vacíos que usa el form-def (no los que no usa).
const d = await fillFormPdf(bytes, {}, { referenced, dummy: true });
assert.deepEqual(d.pintados.sort(), ['acepta', 'cliente_corto', 'cliente_nombre']);

console.log('signaframe-qa: todas las pruebas OK');
