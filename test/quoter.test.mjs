// Pruebas de la cotización según contrato (src/lib/quoter/contract.js).
// Usa una ficha sintética armada acá: no hay datos de clientes.
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { CONTRACT_PRICING, fichaForms, quoteForm, ruleType } from '../src/lib/quoter/contract.js';

const HEAD = ['Pasos Formulario', 'Sección', 'Nombre en PDF', 'Nombre del campo en formulario', 'Tipo de dato', 'Valor', 'Regla', 'Obligatorio', 'Formulario a visualizar', 'Visualización en Formularios', 'Observaciones'];
const row = (o) => [o.paso ?? 'Datos', '', '', o.name, o.tipo ?? 'Texto', o.valor ?? '', o.regla ?? '', o.va ?? 'Both', o.form ?? 'TODOS', o.vis ?? 'editable / input del usuario / visible', o.obs ?? ''];

function ficha(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD, ...rows.map(row)]), name);
  return wb;
}

// ── Lectura de la ficha ─────────────────────────────────────────────────────
{
  const wb = ficha({
    'Estructura base JSON': [{ name: 'No cuenta' }],
    datos: [
      { name: 'Nombre', obs: '50 caracteres alfanuméricos' },
      { name: 'Género', tipo: 'Radio', valor: 'Masculino' },          // dos filas = un campo
      { name: 'Género', tipo: 'Radio', valor: 'Femenino' },
      { name: 'Edad', vis: 'Disabled / Visible', obs: 'Cálculo automático de la edad' }, // automático: regla sí, campo no
      { name: 'Aviso legal', tipo: 'Informativo', vis: 'Visible' },
      { name: 'Código interno', paso: 'JSON', form: 'JSON' },          // solo JSON
      { name: 'Peso', regla: 'No aplica Formulario D0001' },           // no es de D0001
      { name: 'Moneda', tipo: 'Combo', valor: 'Colones' },
      { name: 'Cobertura', tipo: 'Check box', valor: '10M', regla: 'Estas opciones se muestran si se escoge moneda colones' },
      { name: 'Cobertura', tipo: 'Check box', valor: '20M', regla: 'Estas opciones se muestran si se escoge moneda colones' }, // mismo texto: una regla
      { name: 'Teléfono', obs: '8 dígitos', form: 'D0001' },
      { name: 'Solo del otro', form: 'D0002' },
      { name: 'Referencia', regla: 'Referencia INS' },                  // no es regla
    ],
    'JSON Generado': [{ name: 'tampoco' }],
  });
  // Una ficha = un formulario web. Los códigos salen de «Formulario a visualizar».
  const forms = fichaForms(wb, 'ficha.xlsx');
  assert.equal(forms.length, 1);
  assert.deepEqual(forms[0].codes, ['D0001', 'D0002']);
  const d = forms[0];
  // Nombre, Género, Moneda, Cobertura, Teléfono, Solo del otro, Referencia y Peso
  // («No aplica Formulario D0001», pero la ficha también arma D0002).
  assert.equal(d.editable, 8, 'campos editables');
  assert.equal(d.auto, 1);
  assert.equal(d.info, 1);
  assert.deepEqual(d.rules, { validacion: 2, condicional: 1, calculo: 1, otra: 0, total: 4 });
}

// Ficha de un solo PDF: «No aplica Formulario X» la saca; un «No aplica» suelto en Regla
// es «sin regla»; las observaciones con otros códigos no crean formularios.
{
  const forms = fichaForms(ficha({
    hoja: [
      { name: 'A', form: '1008172' },
      { name: 'B', regla: 'No aplica Formulario 1008172' },
      { name: 'C', regla: 'No aplica' },
      { name: 'D', obs: 'En el formulario D0714 debe de verse como predeterminado' },
      { name: 'E', regla: 'No aplica para este formulario' },
    ],
  }), 'f.xlsx');
  assert.deepEqual(forms[0].codes, ['1008172']);
  assert.equal(forms[0].editable, 3, 'A, C y D');
  assert.equal(forms[0].rules.total, 1, 'solo la observación de D');
}

// Varias fichas en un ZIP: cada una con su PDF por el nombre; un código común no decide.
{
  const { contractForms } = await import('../src/lib/quoter/contract.js');
  const mk = (ficha) => ({ ficha, code: '1008172', codes: ['1008172'], editable: 1, rules: { total: 0 } });
  const { forms, skipped } = contractForms(
    [
      { file: '1008172 Solicitud Equipo Electronico Edit.pdf', fieldCount: 10 },
      { file: 'D0714 Solicitud Equipo Electronico Equipo movil Edit.pdf', fieldCount: 10 },
      { file: 'D0267 Solicitud Equipo Electronico Colectivo Edit.pdf', fieldCount: 10 },
      { file: 'Anexo.pdf', fieldCount: 0 },
    ],
    [{ contractForms: [mk('Ficha de configuración - Equipo Electrónico Modalidad Adhesión Equipo Movil.xlsx')] },
     { contractForms: [mk('Ficha de configuración - Equipo Electrónico Modalidad Adhesión.xlsx')] },
     { contractForms: [mk('Ficha de configuración - Equipo Electrónico Tomador Póliza Colectiva.xlsx')] }],
  );
  assert.deepEqual(forms.map((f) => f.pdf.slice(0, 5)), ['D0714', '10081', 'D0267']);
  assert.deepEqual(skipped.map((x) => x.file), ['Anexo.pdf']);
}

// Ficha sin códigos de formulario: un solo formulario con todo.
{
  const forms = fichaForms(ficha({ hoja: [{ name: 'A' }, { name: 'B', obs: 'Formato de correo' }] }), 'f.xlsx');
  assert.equal(forms.length, 1);
  assert.equal(forms[0].code, null);
  assert.equal(forms[0].editable, 2);
  assert.equal(forms[0].rules.total, 1);
}

// Un Excel que no es ficha no da formularios.
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Moneda'], ['Colones'], ['Dólares']]), 'Moneda');
  assert.deepEqual(fichaForms(wb, 'catalogos.xlsx'), []);
}

// ── Tipos de regla ──────────────────────────────────────────────────────────
assert.equal(ruleType('Numérico y 9 dígitos'), 'validacion');
assert.equal(ruleType('Formato de correo'), 'validacion');
assert.equal(ruleType('Sí selecciona Otro se debe de desplegar un campo'), 'condicional');
assert.equal(ruleType('Concatenar automático'), 'calculo');

// ── Precio ──────────────────────────────────────────────────────────────────
const q = (editable, rules, hours = null) => quoteForm({ editable, rules: { total: rules } }, CONTRACT_PRICING, hours);

assert.equal(q(15, 10).tier.key, 'baja', '15 campos es Baja');
assert.equal(q(15, 10).total, 5500);
assert.equal(q(16, 5).tier.key, 'media');
assert.equal(q(10, 11).tier.key, 'media', 'las reglas suben el nivel');
assert.equal(q(30, 20).total, 9800);
assert.equal(q(23, 31).tier.key, 'alta');
assert.equal(q(23, 31).extraRules, 1);
assert.equal(q(23, 31).pendingHours, true);
assert.equal(q(23, 31).total, 12700);
assert.equal(q(23, 31, 2).total, 12700 + 2 * 99);
assert.equal(q(51, 5).extraFieldGroups, 1, 'un grupo empezado cuenta entero');
assert.equal(q(55, 5).extraFieldGroups, 1);
assert.equal(q(56, 5).extraFieldGroups, 2);
assert.equal(q(56, 5).total, 12700 + 2 * 250);
assert.equal(q(50, 30).extraRules + q(50, 30).extraFieldGroups, 0);
assert.match(q(88, 74).why, /supera el máximo de Alta/);
assert.match(q(50, 30).why, /entran en Alta/);

// ── Reportes: salen del mismo modelo que la pantalla ───────────────────────
{
  const { reportModel } = await import('../src/lib/quoter/contract.js');
  const { buildCommercialReport } = await import('../src/lib/quoter/report.js');
  const { buildDocxReport } = await import('../src/lib/quoter/docx.js');
  const JSZip = (await import('jszip')).default;
  const contract = {
    forms: [{ id: 'f|D0001', code: 'D0001', ficha: 'f.xlsx', pdf: 'D0001.pdf', editable: 23, auto: 2, info: 1, rules: { validacion: 19, condicional: 9, calculo: 2, otra: 1, total: 31 } }],
    skipped: [{ file: 'Anexo.pdf', reason: 'No tiene campos.' }],
  };
  const m = reportModel(contract, CONTRACT_PRICING, {});
  assert.equal(m.items[0].level, 'Alta');
  assert.equal(m.total, 12700);
  assert.equal(m.pending, true);
  assert.equal(m.items[0].lines[1].amount, null, 'regla extra sin horas = a estimar');
  const m2 = reportModel(contract, CONTRACT_PRICING, { 'f|D0001': 2 });
  assert.equal(m2.total, 12700 + 198);
  assert.equal(m2.pending, false);
  const html = buildCommercialReport(m, { archivo: 'caso.zip', fecha: 'hoy' });
  assert.ok(html.includes('USD 12.700') && html.includes('a estimar') && html.includes('Anexo.pdf'));
  assert.ok(!/semana|puntos/i.test(html), 'el reporte ya no habla de semanas ni puntos');
  const docx = await buildDocxReport(m2, { archivo: 'caso.zip' });
  const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
  assert.ok(xml.includes('USD 12.898') && xml.includes('Complejidad alta'));
  assert.ok(!/semana/i.test(xml));
}

// ── Grupo: el principal completo, los demás solo por lo que agregan ─────────
{
  const { quoteItems, explainQuote, reportModel } = await import('../src/lib/quoter/contract.js');
  const fld = (name, rules = []) => ({ key: `hoja|${name}`, name, sheet: 'hoja', kind: 'editable', rules: rules.map((t) => ({ text: t, type: 'validacion' })) });
  const big = Array.from({ length: 40 }, (_, i) => fld(`c${i}`, i < 25 ? [`regla ${i}`] : []));
  const mk = (id, fieldList) => ({
    id, ficha: `${id}.xlsx`, code: null, codes: [], auto: 0, info: 0, fieldList,
    editable: fieldList.length,
    rules: { validacion: fieldList.reduce((s, f) => s + f.rules.length, 0), condicional: 0, calculo: 0, otra: 0, total: fieldList.reduce((s, f) => s + f.rules.length, 0) },
  });
  const A = mk('A', big);                                              // 40 campos, 25 reglas: Alta
  const B = mk('B', [...big.slice(0, 30), fld('nuevo1', ['otra regla'])]); // casi todo repetido
  const C = mk('C', [fld('suelto')]);
  const forms = [B, A, C];

  const solo = quoteItems(forms, CONTRACT_PRICING, {}, null);
  assert.ok(solo.every((i) => i.role === 'solo'));
  assert.equal(solo.find((i) => i.form.id === 'B').quote.tier.key, 'alta', 'B solo: 31 campos');

  const g = quoteItems(forms, CONTRACT_PRICING, {}, { on: true, main: null, out: ['C'] });
  assert.deepEqual(g.map((i) => [i.form.id, i.role]), [['A', 'principal'], ['B', 'agrupado'], ['C', 'solo']]);
  const b = g[1];
  assert.equal(b.quote.fields, 1, 'B agrega un campo');
  assert.equal(b.quote.rules, 1, 'B agrega una regla');
  assert.equal(b.quote.tier.key, 'baja');
  assert.deepEqual(b.shared, { fields: 30, rules: 25 });

  // Principal elegido a mano.
  const g2 = quoteItems(forms, CONTRACT_PRICING, {}, { on: true, main: 'B', out: ['C'] });
  assert.equal(g2[0].form.id, 'B');
  assert.equal(g2[1].quote.fields, 10, 'A agrega los 10 campos que B no tiene');

  // Un solo miembro: no hay grupo.
  assert.ok(quoteItems(forms, CONTRACT_PRICING, {}, { on: true, main: null, out: ['B', 'C'] }).every((i) => i.role === 'solo'));

  const contract = { forms, skipped: [] };
  const m = reportModel(contract, CONTRACT_PRICING, {}, { on: true, main: null, out: ['C'] });
  assert.equal(m.grouped, true);
  assert.equal(m.total, 12700 + 5500 + 5500);
  assert.equal(m.separateTotal, 12700 + 12700 + 5500);
  const ex = explainQuote(g, contract, CONTRACT_PRICING);
  assert.ok(ex.some((x) => /Rubro 2/.test(x)), 'cita el contrato');
  assert.ok(ex.some((x) => /se cotizan juntos/.test(x)), 'explica el grupo');
  const { buildCommercialReport } = await import('../src/lib/quoter/report.js');
  const html = buildCommercialReport(m, {});
  assert.ok(html.includes('Cómo se calculó') && html.includes('Principal del grupo') && html.includes('Por separado sumarían'));
}

console.log('cotizador: todas las pruebas OK');
