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
  const forms = fichaForms(wb, 'ficha.xlsx');
  assert.deepEqual(forms.map((f) => f.code), ['D0001', 'D0002']);
  const d1 = forms.find((f) => f.code === 'D0001');
  // Nombre, Género, Moneda, Cobertura, Teléfono, Referencia = 6 editables
  assert.equal(d1.editable, 6, 'campos editables de D0001');
  assert.equal(d1.auto, 1);
  assert.equal(d1.info, 1);
  assert.deepEqual(d1.rules, { validacion: 2, condicional: 1, calculo: 1, otra: 0, total: 4 });
  const d2 = forms.find((f) => f.code === 'D0002');
  // D0002 suma «Peso» y «Solo del otro», pierde «Teléfono»
  assert.equal(d2.editable, 7, 'campos editables de D0002');
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

console.log('cotizador: todas las pruebas OK');
