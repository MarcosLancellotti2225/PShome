// Prueba del Editor PDF: el resultado tiene que ser igual al de Convertir PDF (FormConverterExcel).
//   node test/pdf-editor.test.mjs [ruta/a/FormConverterExcel]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';
import { openPdf, applyEdits, validate, matchExcelToFields, parseBulkText, summarize } from '../src/lib/pdf-editor/index.js';
import { detectFields } from '../src/lib/pdf-detect/index.js';

async function samplePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const form = doc.getForm();
  ['Text1', 'Text2', 'Text3', 'Fecha nac', 'correo'].forEach((n, i) => form.createTextField(n).addToPage(page, { x: 50, y: 780 - i * 40, width: 200, height: 20 }));
  ['Check Box1', 'Check Box2'].forEach((n, i) => form.createCheckBox(n).addToPage(page, { x: 300 + i * 40, y: 780, width: 12, height: 12 }));
  const rg = form.createRadioGroup('Sexo');
  rg.addOptionToPage('M', page, { x: 300, y: 700, width: 12, height: 12 });
  rg.addOptionToPage('F', page, { x: 340, y: 700, width: 12, height: 12 });
  return new Uint8Array(await doc.save());
}

const bytes = await samplePdf();
const fields = await openPdf(bytes);
assert.equal(fields.length, 9, 'detecta 9 widgets');
const byOrig = (n) => fields.find((f) => f.orig.name === n);

// Edición
byOrig('Text1').name = 'cliente_nombre';
byOrig('Text2').name = 'cliente_apellidos';
Object.assign(byOrig('Text3'), { x: 60, y: 690, width: 250 });
byOrig('Fecha nac').deleted = true;
byOrig('correo').fontSize = 0;          // auto
byOrig('Check Box1').name = 'acepta_terminos';
fields.push({ key: '__n1', group: 0, isNew: true, deleted: false, orig: {}, name: 'campo_nuevo_1', type: 'text', page: 1, x: 50, y: 500, width: 150, height: 18, fontSize: 9, comb: false, multiline: null, ft: null });

assert.deepEqual(summarize(fields), { total: 9, renamed: 3, deleted: 1, added: 1, moved: 1, props: 1 });
assert.equal(validate(fields).size, 0, 'sin problemas de nombres');

const { pdfBytes, report } = await applyEdits(bytes, fields);
const out = (await detectFields(pdfBytes)).fields;
const names = out.map((f) => f.name).sort();
assert.deepEqual(names, ['Check Box2', 'Sexo', 'Sexo', 'Text3', 'acepta_terminos', 'campo_nuevo_1', 'cliente_apellidos', 'cliente_nombre', 'correo'].sort());
const t3 = out.find((f) => f.name === 'Text3');
assert.deepEqual([t3.x, t3.y, t3.width], [60, 690, 250], 'Text3 movido');
assert.equal(report.renamed, 3); assert.equal(report.deleted, 1); assert.equal(report.added, 1);

// Validación
const dup = await openPdf(bytes);
dup[0].name = dup[1].name;
dup[2].name = 'con espacio';
const probs = validate(dup);
assert.ok(probs.get(dup[0].key).includes('Nombre repetido con otro campo'));
assert.ok(probs.get(dup[2].key).includes('Tiene espacios'));
assert.ok(!probs.has(dup.find((f) => f.orig.name === 'Sexo').key), 'los radios comparten nombre sin problema');

// Cruce Excel (exacto, normalizado, parecido) y texto en bloque
const m = matchExcelToFields([{ oldName: 'Text1', newName: 'a' }, { oldName: 'fecha_nac', newName: 'b' }, { oldName: 'Corre0', newName: 'c' }], dup);
assert.equal(m.get('Text1').matchType, 'exacto');
assert.equal(m.get('Fecha nac').matchType, 'normalizado');
assert.equal(m.get('correo').matchType, 'parecido');
// Una fila del Excel no renombra varios campos, y «Text1» no es «parecido» a «Text2».
const m2 = matchExcelToFields([{ oldName: 'Text1', newName: 'solo_uno' }], dup);
assert.equal(m2.size, 1, 'una fila → un campo');
// Los radios de un mismo grupo se renombran juntos con una sola fila.
const m3 = matchExcelToFields([{ oldName: 'Sexo', newName: 'cliente_sexo' }], dup);
assert.equal(m3.size, 2, 'las dos opciones del radio');
assert.deepEqual(parseBulkText('Text1\tnuevo_1\nText2;nuevo_2\n'), [{ oldName: 'Text1', newName: 'nuevo_1' }, { oldName: 'Text2', newName: 'nuevo_2' }]);

// Mover: el recuadro (widget) queda donde se pidió, aunque sea un único hijo del campo.
{
  const { PDFDocument: D, PDFName } = await import('pdf-lib');
  const doc = await D.load(pdfBytes);
  const field = doc.getForm().getField('Text3');
  const r = field.acroField.getWidgets()[0].getRectangle();
  assert.deepEqual([r.x, r.y, r.width], [60, 690, 250], 'el widget de Text3 se movió');
  assert.ok(!field.acroField.getWidgets()[0].dict.get(PDFName.of('AP')), 'apariencia vieja borrada');
}

// Paridad con el motor original de FormConverterExcel (renombrar, borrar y fuentes)
const fc = process.argv[2];
if (fc) {
  const require = createRequire(import.meta.url);
  const { rewritePdf } = require(`${fc}/src/pdf-converter/pdf-rewriter.js`);
  const fresh = await openPdf(bytes);
  const g = (n) => fresh.find((f) => f.orig.name === n);
  g('Text1').name = 'cliente_nombre'; g('Text2').name = 'cliente_apellidos'; g('Check Box1').name = 'acepta_terminos';
  g('Fecha nac').deleted = true; g('correo').fontSize = 0;
  const renames = [{ oldName: 'Text1', newName: 'cliente_nombre' }, { oldName: 'Text2', newName: 'cliente_apellidos' }, { oldName: 'Check Box1', newName: 'acepta_terminos' }];
  const viejo = await rewritePdf(bytes.slice(), renames, ['Fecha nac'], [], [], [{ fieldName: 'correo', fontSize: 0 }]);
  const nuevo = await applyEdits(bytes, fresh);
  // Se compara el contenido de cada campo (pdf-lib estampa la fecha al guardar, así que los bytes nunca son iguales).
  const { PDFDocument: D, PDFName } = await import('pdf-lib');
  const dump = async (b) => {
    const doc = await D.load(b);
    return doc.getForm().getFields().map((f) => {
      const d = f.acroField.dict;
      const val = (k) => { const v = d.get(PDFName.of(k)); return v ? String(v) : null; };
      return [f.getName(), val('FT'), val('Ff'), val('DA'), f.acroField.getWidgets().map((w) => { const r = w.getRectangle(); return [r.x, r.y, r.width, r.height]; })];
    }).sort((a, b) => a[0].localeCompare(b[0]));
  };
  assert.deepEqual(await dump(nuevo.pdfBytes), await dump(new Uint8Array(viejo.pdfBytes)), 'mismo contenido que Convertir PDF');
  console.log('paridad con FormConverterExcel: OK (nombres, tipos, flags, fuente y posiciones iguales)');
}
console.log('pdf-editor: todas las pruebas OK');
