// Pruebas del armador del JSON del formulario (src/lib/signaframe-formdef).
// Con datos sintéticos. Con la ruta a un form-def real como argumento, hace la
// ida y vuelta form-def → filas de matriz interna → form-def y compara:
//   node test/signaframe-formdef.test.mjs <form-def.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { buildFormDef, matrixFromRows, readMatrixXlsx, allFields } from '../src/lib/signaframe-formdef/index.js';

// Las columnas de la matriz interna (igual que interno.html → sfVals).
const KEYS = { id: 'id', Tipo: 'type', Etiqueta: 'label', 'Pregunta del grupo': 'radioGroupLabel', Oculto: 'hidden', 'Solo lectura': 'readOnly', Obligatorio: 'required', Ancho: 'width',
  'Ruta JSON': 'jsonOutputPath', 'Prellenado desde': 'prefillKey', 'Excluir del JSON': 'excludeFromJson', 'Se muestra si': 'conditionalVisibility', 'Se arma con': 'autoFillConcat', Opciones: 'options' };
const BOOLK = new Set(['hidden', 'readOnly', 'required', 'excludeFromJson']);
const DERIVED = new Set(['sourceMeta', 'order', 'salidaJSON', 'prefillMode']);

/** form-def → filas de la matriz interna (como las escribe interno.html). */
function rowsFromFormDef(fd) {
  const rows = []; const opts = [];
  const field = (f) => {
    const v = { Nivel: 'Campo', 'Casillero PDF': f.sourceMeta?.sourceName || '' };
    for (const [col, key] of Object.entries(KEYS)) {
      let x = f[key];
      if (BOOLK.has(key)) x = x ? 'Sí' : '';
      else if (key === 'options') {
        if (x && x.length) {
          x.forEach((o, i) => { const { label, pdfValue, jsonValue, parentValues, ...rest } = o;
            opts.push({ 'id del campo': f.id, Orden: i + 1, Etiqueta: label, 'Valor PDF': pdfValue ?? '', 'Valor JSON': jsonValue ?? '',
              'Depende de (parentValues)': parentValues === '' ? '(vacío)' : (parentValues ?? ''), 'Otras propiedades': Object.keys(rest).length ? JSON.stringify(rest) : '' }); });
          x = `${x.length} opciones`;
        } else x = '';
      } else if (key === 'autoFillConcat' || key === 'conditionalVisibility') x = x ? (typeof x === 'string' ? x : JSON.stringify(x)) : '';
      v[col] = x == null ? '' : x;
    }
    const extra = {};
    for (const [k, x] of Object.entries(f)) if (!Object.values(KEYS).includes(k) && !DERIVED.has(k) && x !== undefined && x !== null) extra[k] = x;
    v['Otras propiedades'] = Object.keys(extra).length ? JSON.stringify(extra) : '';
    rows.push(v);
  };
  for (const s of fd.sections) {
    rows.push({ Nivel: 'Paso', id: s.id, Etiqueta: s.title, Oculto: s.hidden ? 'Sí' : '' });
    (s.fields || []).forEach(field);
    for (const sub of s.subsections || []) {
      const extra = {}; for (const k of ['description', 'instructions']) if (sub[k]) extra[k] = sub[k];
      rows.push({ Nivel: 'Subsección', id: sub.id, Etiqueta: sub.title, Oculto: sub.hidden ? 'Sí' : '', 'Se muestra si': sub.conditionalVisibility || '', 'Otras propiedades': Object.keys(extra).length ? JSON.stringify(extra) : '' });
      sub.fields.forEach(field);
    }
  }
  return { rows, opts };
}

/** El «main» que exportaría Signaframe al importar el PDF: los campos con sourceMeta. */
function mainFromFormDef(fd) {
  const fields = allFields(fd.sections).filter((f) => f.sourceMeta?.sourceName || (f.type === 'signature' && f.sourceMeta)).map((f) => ({ id: f.id, type: f.type, label: f.label, sourceMeta: f.sourceMeta }));
  return { sections: [{ id: 'sec_import', title: 'Importado', fields, subsections: [] }], _sourcePdf: fd._sourcePdf, version: 'v1' };
}

// ── Sintético ───────────────────────────────────────────────────────────────
{
  const main = {
    sections: [{ id: 's', fields: [
      { id: 'field_nombre', type: 'text', label: 'nombre', sourceMeta: { sourceName: 'nombre', page: 1, rect: { X: 1, Y: 2, Width: 3, Height: 4 } } },
      { id: 'field_monedacrc', type: 'checkbox', label: 'crc', sourceMeta: { sourceName: 'monedaCRC', page: 1 } },
      { id: 'field_monedausd', type: 'checkbox', label: 'usd', sourceMeta: { sourceName: 'monedaUSD', page: 1 } },
      { id: 'field_sobra', type: 'text', label: 'sobra', sourceMeta: { sourceName: 'sobra', page: 2 } },
    ] }],
    _sourcePdf: { fileName: 'x.pdf', pageCount: 2, fieldPositions: [] },
    validationRules: [{ id: 'r1' }],
  };
  const rows = [
    { Nivel: 'Paso', id: 'sec_dg', Etiqueta: 'Datos Generales' },
    { Nivel: 'Subsección', id: 'sub_sis', Etiqueta: 'Sistema', Oculto: 'Sí', 'Se muestra si': '{"conditions":[]}', 'Otras propiedades': '{"instructions":"hola"}' },
    { Nivel: 'Campo', id: 'field_tipo', Tipo: 'select', Etiqueta: 'Tipo', Oculto: 'Sí', 'Solo lectura': 'Sí', 'Ruta JSON': 'datosFormulario.personas[0].codigoTipo', 'Prellenado desde': 'datosFormulario.personas[0].codigoTipo', Opciones: '2 opciones' },
    { Nivel: 'Paso', id: 'sec_p', Etiqueta: 'Persona' },
    { Nivel: 'Subsección', id: 'sub_p', Etiqueta: 'Datos' },
    { Nivel: 'Campo', id: 'field_NOMBRE_mal', Tipo: 'text', Etiqueta: 'Nombre', Obligatorio: 'Sí', Ancho: 'quarter', 'Casillero PDF': 'nombre', 'Ruta JSON': 'datosFormulario.personas[0].primerNombre', 'Otras propiedades': '{"maxLength":50}' },
    { Nivel: 'Campo', id: 'field_completo', Tipo: 'text', Etiqueta: 'Completo', 'Solo lectura': 'Sí', 'Se arma con': '{"parts":[{"type":"field","fieldId":"field_NOMBRE_mal"}],"sourceFieldIds":["field_NOMBRE_mal"]}' },
    { Nivel: 'Campo', id: 'field_monedacrc', Tipo: 'radio', Etiqueta: 'Colones', 'Pregunta del grupo': 'Moneda', 'Casillero PDF': 'monedaCRC', 'Ruta JSON': 'x.codigoMoneda', 'Otras propiedades': '{"jsonValue":"CRC","checkedPdfValue":true,"radioGroupFields":["field_monedausd"]}' },
    { Nivel: 'Campo', id: 'field_monedausd', Tipo: 'radio', Etiqueta: 'Dólares', 'Casillero PDF': 'monedaUSD', 'Ruta JSON': 'x.codigoMoneda', 'Se muestra si': '{"conditions":[{"fieldId":"field_NOMBRE_mal","operator":"not_empty"}]}' },
    { Nivel: 'Campo', id: 'field_fantasma', Tipo: 'text', Etiqueta: 'No existe', 'Casillero PDF': 'noEstaEnElPdf' },
    { Nivel: 'Fuera', 'Pregunta (ficha)': 'Pregunta sin campo' },
  ];
  const optRows = [
    { 'id del campo': 'field_tipo', Orden: 2, Etiqueta: 'Dependiente', 'Valor JSON': 'DME' },
    { 'id del campo': 'field_tipo', Orden: 1, Etiqueta: 'Asegurado', 'Valor JSON': 'ASG', 'Depende de (parentValues)': '(vacío)' },
  ];
  const { formDef: fd, report } = buildFormDef(matrixFromRows(rows, optRows), main, { version: 'v3' });
  assert.deepEqual(fd.sections.map((s) => [s.id, s.order]), [['sec_dg', 1], ['sec_p', 2], ['sec_campos_pdf_sin_usar', 3]]);
  const sis = fd.sections[0].subsections[0];
  assert.equal(sis.hidden, true);
  assert.equal(sis.instructions, 'hola');
  assert.equal(sis.conditionalVisibility, '{"conditions":[]}');
  const tipo = sis.fields[0];
  assert.deepEqual(tipo.options.map((o) => o.jsonValue), ['ASG', 'DME'], 'opciones en orden');
  assert.equal(tipo.options[0].parentValues, '');
  assert.equal(tipo.prefillMode, 'optional');
  assert.equal(tipo.salidaJSON, tipo.jsonOutputPath);
  const f = Object.fromEntries(allFields(fd.sections).map((x) => [x.id, x]));
  // REGLA DE ORO: el id y el sourceMeta salen del main.
  assert.ok(f.field_nombre, 'id corregido al del main');
  assert.deepEqual(f.field_nombre.sourceMeta, main.sections[0].fields[0].sourceMeta);
  assert.equal(f.field_nombre.maxLength, 50);
  assert.equal(f.field_nombre.required, true);
  assert.deepEqual(report.idCorregido, [{ de: 'field_NOMBRE_mal', a: 'field_nombre' }]);
  // Las referencias al id viejo se corrigen.
  assert.deepEqual(f.field_completo.autoFillConcat.sourceFieldIds, ['field_nombre']);
  assert.ok(f.field_monedausd.conditionalVisibility.includes('"field_nombre"'));
  assert.equal(f.field_monedacrc.checkedPdfValue, true);
  assert.deepEqual(f.field_monedacrc.radioGroupFields, ['field_monedausd']);
  // Casillero inexistente: avisa y no inventa sourceMeta.
  assert.deepEqual(report.sinCasillero, [{ id: 'field_fantasma', casillero: 'noEstaEnElPdf' }]);
  assert.equal(f.field_fantasma.sourceMeta, undefined);
  // Lo que el main tiene y la matriz no usa queda oculto.
  assert.deepEqual(report.sinUsar, ['sobra']);
  assert.equal(f.field_sobra.hidden, true);
  assert.equal(f.field_sobra.excludeFromJson, true);
  // Arriba: lo del main.
  assert.deepEqual(fd.validationRules, [{ id: 'r1' }]);
  assert.equal(fd._sourcePdf.fileName, 'x.pdf');
  assert.equal(fd.version, 'v3');
  assert.deepEqual(report.repetidos, []);
  assert.equal(fd.sections[1].childrenOrder[0].kind, 'subsection');
  assert.deepEqual(report.firmasSinUbicar, []);
}

// Firma: si el main no la trae ubicada, posición provisoria y aviso.
{
  const { formDef, report } = buildFormDef(matrixFromRows([
    { Nivel: 'Paso', id: 'sec_f', Etiqueta: 'Firmas', Oculto: 'Sí' },
    { Nivel: 'Campo', id: 'field_firma', Tipo: 'signature', Etiqueta: 'Firma', Oculto: 'Sí' },
  ]), { sections: [], _sourcePdf: { pageCount: 3 } });
  assert.deepEqual(formDef.sections[0].fields[0].sourceMeta, { sourceName: null, sourceType: 'signature', page: 3, rect: { x: 0, y: 0, width: 180, height: 60 } });
  assert.deepEqual(report.firmasSinUbicar, ['field_firma']);
}

// Desde el Excel: hojas «Formulario Signaframe» (encabezado en la fila 2) y «Opciones».
{
  const wb = XLSX.utils.book_new();
  const hdr = ['ID ficha', 'Pregunta (ficha)', 'Nivel', 'id', 'Tipo', 'Etiqueta', 'Oculto', 'Casillero PDF', 'Opciones', 'Otras propiedades'];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['FICHA DEL CLIENTE', '', 'SIGNAFRAME'], hdr,
    ['', 'PASO 1', 'Paso', 'sec_a', '', 'A'],
    ['', '   Sub', 'Subsección', 'sub_a', '', 'Sub'],
    ['q1', '      Pregunta', 'Campo', 'field_x', 'select', 'X', '', 'x', '1 opciones', '{"width":"half"}'],
  ]), 'Formulario Signaframe');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['id del campo', 'Orden', 'Etiqueta', 'Valor PDF', 'Valor JSON', 'Depende de (parentValues)', 'Otras propiedades'],
    ['field_x', 1, 'Uno', '', 1, '', ''],
  ]), 'Opciones');
  const m = readMatrixXlsx(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const { formDef } = buildFormDef(m, null);
  const x = formDef.sections[0].subsections[0].fields[0];
  assert.equal(x.width, 'half');
  assert.deepEqual(x.options, [{ label: 'Uno', pdfValue: '', jsonValue: '1' }]);
  assert.deepEqual(x.sourceMeta, { sourceName: 'x' }, 'sin main: sourceMeta mínimo');
  const otro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(otro, XLSX.utils.aoa_to_sheet([['a']]), 'Hoja1');
  assert.throws(() => readMatrixXlsx(XLSX.write(otro, { type: 'array', bookType: 'xlsx' })), /Formulario Signaframe/);
}

// ── Ida y vuelta con un form-def real (opcional) ───────────────────────────
const real = process.argv[2];
if (real) {
  const gold = JSON.parse(fs.readFileSync(real, 'utf8'));
  const { rows, opts } = rowsFromFormDef(gold);
  const { formDef, report } = buildFormDef(matrixFromRows(rows, opts), mainFromFormDef(gold), { version: gold.version });
  const norm = (f) => {
    const o = {};
    for (const [k, v] of Object.entries(f)) {
      if (['order', 'prefillMode', 'salidaJSON'].includes(k) || k.startsWith('_')) continue;
      if (v === null || v === undefined || v === false || v === '' || (Array.isArray(v) && !v.length)) continue;
      o[k] = v;
    }
    return o;
  };
  const a = allFields(gold.sections); const b = new Map(allFields(formDef.sections).map((f) => [f.id, f]));
  let diffs = 0;
  for (const f of a) {
    const g = b.get(f.id);
    if (!g) { diffs++; console.log('falta', f.id); continue; }
    try { assert.deepEqual(norm(g), norm(f)); } catch {
      diffs++;
      if (diffs < 6) {
        const A = norm(f); const B = norm(g);
        const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
        console.log('distinto', f.id, keys.map((k) => `${k}: ${JSON.stringify(A[k])?.slice(0, 80)} → ${JSON.stringify(B[k])?.slice(0, 80)}`).join(' | '));
      }
    }
    if (f.jsonOutputPath && f.type !== 'repeater') assert.equal(g.salidaJSON, f.jsonOutputPath);
  }
  assert.equal(diffs, 0, `${diffs} campos distintos`);
  assert.deepEqual(formDef.sections.map((s) => s.id), gold.sections.map((s) => s.id));
  assert.deepEqual(report.sinUsar, []);
  assert.deepEqual(report.sinCasillero, []);
  // El motor de Signaframe tiene que dar lo mismo con el original y con el rearmado.
  const { simulate } = await import('../src/lib/signaframe-engine/index.js');
  const payload = { encabezado: { correoElectronico: 'a@b.cr', nombreCompletoCliente: 'Ana' }, datosFormulario: {} };
  const s1 = simulate({ formDefinition: gold, payload });
  const s2 = simulate({ formDefinition: formDef, payload });
  assert.deepEqual(s2.json, s1.json, 'mismo JSON de salida');
  assert.deepEqual(s2.pdf, s1.pdf, 'mismo PDF');
  console.log(`signaframe-formdef: ida y vuelta OK con ${a.length} campos de ${real.split('/').pop()} (motor: mismo JSON y mismo PDF)`);
}

console.log('signaframe-formdef: todas las pruebas OK');
