// Pruebas del cliente de la API de Signaframe, del diff de form-defs y de la edición de la matriz.
// Contra un Signaframe falso (fetch simulado) con las rutas y respuestas del swagger.
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createClient, templateFormDef } from '../src/lib/signaframe-api/index.js';
import { diffFormDefs, readMatrixXlsx, buildFormDef } from '../src/lib/signaframe-formdef/index.js';
import { editMatrixXlsx } from '../src/lib/signaframe-formdef/matrix-edit.js';

// ── Signaframe falso ────────────────────────────────────────────────────────
function fakeSignaframe() {
  const state = {
    token: 'tok-1', refresh: 'ref-1', calls: [],
    tpl: { id: 't1', name: 'D0001 Prueba', description: 'd', category: 'INS', status: 1, isPublished: false, jsonDefinition: JSON.stringify({ version: 'v1', sections: [] }) },
  };
  const json = (status, body) => ({ ok: status < 400, status, statusText: String(status), text: async () => JSON.stringify(body) });
  const fetch = async (url, init) => {
    const u = new URL(url);
    const auth = init.headers.Authorization;
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push(`${init.method} ${u.pathname}${u.search}`);
    if (u.pathname === '/api/auth/login') return body.password === 'ok' ? json(200, { data: { accessToken: state.token, refreshToken: state.refresh } }) : json(401, { message: 'Credenciales inválidas' });
    if (u.pathname === '/api/auth/refresh') return body.refreshToken === state.refresh ? json(200, { data: { accessToken: (state.token = 'tok-2'), refreshToken: (state.refresh = 'ref-2') } }) : json(401, {});
    if (auth !== `Bearer ${state.token}`) return json(401, { message: 'Token vencido' });
    if (u.pathname === '/api/auth/me') return json(200, { data: { email: 'm@n.com', role: 0 } });
    if (u.pathname === '/api/templates' && init.method === 'GET') return json(200, { data: { page: 1, size: 50, totalItems: 1, totalPages: 1, items: [state.tpl] } });
    if (u.pathname === '/api/templates/t1' && init.method === 'GET') return json(200, { data: state.tpl });
    if (u.pathname === '/api/templates/t1' && init.method === 'PUT') { Object.assign(state.tpl, body); return json(200, {}); }
    if (u.pathname === '/api/templates/t1/pdf-fill') return json(200, { pdfs: [{ name: 'D0001.pdf', b64: 'JVBERi0=', order: 1 }] });
    if (u.pathname === '/api/processes' && init.method === 'POST') return json(200, { data: { id: 'p1', accessUrl: 'https://x/f/abc', status: 0 } });
    return json(404, { message: 'no existe' });
  };
  return { state, fetch };
}

// Login, { data }, query, PUT con los campos de la plantilla, pdf-fill sin { data }.
{
  const f = fakeSignaframe();
  const c = createClient({ url: 'https://sf.test/', email: 'm@n.com', password: 'ok', fetch: f.fetch });
  assert.equal(c.base, 'https://sf.test');
  assert.equal((await c.me()).email, 'm@n.com');
  assert.equal(f.state.calls[0], 'POST /api/auth/login', 'hace login solo');
  const list = await c.listTemplates({ search: 'D0001' });
  assert.equal(list.items[0].id, 't1');
  assert.ok(f.state.calls.includes('GET /api/templates?size=50&search=D0001'));
  const t = await c.getTemplate('t1');
  assert.deepEqual(templateFormDef(t), { version: 'v1', sections: [] });
  await c.updateTemplate('t1', { name: t.name, description: t.description, category: t.category, jsonDefinition: '{"version":"v2","sections":[]}' });
  assert.equal(f.state.tpl.id, 't1', 'el PUT manda el id');
  assert.equal(f.state.tpl.category, 'INS', 'y conserva los otros campos');
  assert.equal(templateFormDef(await c.getTemplate('t1')).version, 'v2');
  assert.equal((await c.fillTemplatePdf('t1', { a: '1' })).pdfs.length, 1);

  // Token vencido: renueva con el refresh y reintenta.
  f.state.token = 'tok-que-ya-no-es-el-nuestro';
  const before = f.state.calls.length;
  assert.equal((await c.me()).email, 'm@n.com');
  assert.deepEqual(f.state.calls.slice(before), ['GET /api/auth/me', 'POST /api/auth/refresh', 'GET /api/auth/me']);
}
{
  const f = fakeSignaframe();
  const c = createClient({ url: 'https://sf.test', token: 'viejo', email: 'm@n.com', password: 'ok', fetch: f.fetch });
  assert.equal((await c.me()).email, 'm@n.com', 'con token vencido hace login y reintenta');
  const c2 = createClient({ url: 'https://sf.test', fetch: f.fetch });
  await assert.rejects(() => c2.me(), /SIGNAFRAME_TOKEN/);
  const c3 = createClient({ url: 'https://sf.test', token: 'malo', fetch: f.fetch });
  await assert.rejects(() => c3.me(), /401.*Token vencido/);
  await assert.rejects(() => createClient({ url: 'https://sf.test', token: 'tok-1', fetch: f.fetch }).getTemplate('nada'), /404/);
}

// ── Diff y regla de oro ─────────────────────────────────────────────────────
{
  const mk = (fields) => ({ sections: [{ id: 's', fields, subsections: [] }] });
  const pdf = { id: 'field_nombre', type: 'text', label: 'Nombre', sourceMeta: { sourceName: 'nombre', page: 1 } };
  const a = mk([pdf, { id: 'x', type: 'text', label: 'X' }]);
  assert.equal(diffFormDefs(a, a).iguales, true);
  const b = mk([{ ...pdf, label: 'Nombre completo', order: 9 }, { id: 'y', type: 'text', label: 'Y' }]);
  const d = diffFormDefs(a, b);
  assert.deepEqual(d.agregados, ['y']);
  assert.deepEqual(d.quitados, ['x']);
  assert.deepEqual(d.cambiados, [{ id: 'field_nombre', claves: ['label'] }], 'order no cuenta');
  assert.deepEqual(d.reglaDeOro, []);
  assert.deepEqual(d.porPropiedad, { label: 1 });
  // Orden de claves y false/ausente no son cambios.
  const c1 = mk([{ ...pdf, options: [{ label: 'A', jsonValue: '1', pdfValue: '' }], excludeFromJson: false }]);
  const c2 = mk([{ options: [{ pdfValue: '', label: 'A', jsonValue: '1' }], ...pdf }]);
  assert.equal(diffFormDefs(c1, c2).iguales, true);
  assert.match(diffFormDefs(a, mk([{ ...pdf, id: 'field_otro' }])).reglaDeOro[0], /cambió de id/);
  assert.match(diffFormDefs(a, mk([{ ...pdf, sourceMeta: { sourceName: 'nombre', page: 2 } }])).reglaDeOro[0], /sourceMeta/);
  assert.match(diffFormDefs(a, mk([])).reglaDeOro[0], /ya no está/);
}

// ── Editar la matriz ────────────────────────────────────────────────────────
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Formulario Signaframe');
  ws.addRow(['FICHA', '', 'SIGNAFRAME']);
  ws.addRow(['ID ficha', 'Pregunta (ficha)', 'Nivel', 'id', 'Tipo', 'Etiqueta', 'Oculto', 'Casillero PDF', 'Ruta JSON', 'Opciones', 'Otras propiedades']);
  ws.addRow(['', 'PASO', 'Paso', 'sec_a', '', 'A']);
  ws.addRow(['q1', 'Nombre', 'Campo', 'field_nombre', 'text', 'Nombre', '', 'nombre', 'x.nombre', '', '{"maxLength":50}']);
  ws.addRow(['q2', 'Moneda', 'Campo', 'field_moneda', 'select', 'Moneda', '', '', 'x.moneda', '1 opciones', '']);
  ws.getCell('F4').font = { bold: true };
  const wo = wb.addWorksheet('Opciones');
  wo.addRow(['id del campo', 'Orden', 'Etiqueta', 'Valor PDF', 'Valor JSON', 'Depende de (parentValues)', 'Otras propiedades']);
  wo.addRow(['field_moneda', 1, 'Colones', '', 'CRC', '', '']);
  const bytes = new Uint8Array(await wb.xlsx.writeBuffer());

  const r = await editMatrixXlsx(bytes, [
    { id: 'field_nombre', propiedad: 'label', valor: 'Primer nombre' },
    { id: 'field_nombre', propiedad: 'hidden', valor: true },
    { id: 'field_nombre', propiedad: 'maxLength', valor: 30 },
    { id: 'field_nombre', propiedad: 'placeholder', valor: 'Ej. Ana' },
    { id: 'field_moneda', opciones: [{ label: 'Colones', jsonValue: 'CRC' }, { label: 'Dólares', jsonValue: 'USD', pdfValue: 'X' }] },
    { id: 'field_nombre', propiedad: 'id', valor: 'otro' },
    { id: 'no_existe', propiedad: 'label', valor: 'x' },
  ]);
  assert.equal(r.aplicados.length, 5);
  assert.deepEqual(r.errores.map((e) => e.slice(0, 20)), ['field_nombre: el id ', 'No encuentro el camp']);
  const m = readMatrixXlsx(r.bytes);
  const { formDef } = buildFormDef(m, null);
  const [nombre, moneda] = formDef.sections[0].fields;
  assert.equal(nombre.label, 'Primer nombre');
  assert.equal(nombre.hidden, true);
  assert.equal(nombre.maxLength, 30);
  assert.equal(nombre.placeholder, 'Ej. Ana');
  assert.deepEqual(moneda.options.map((o) => o.jsonValue), ['CRC', 'USD']);
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(r.bytes);
  assert.equal(back.getWorksheet('Formulario Signaframe').getCell('F4').font?.bold, true, 'conserva el formato');
}

console.log('signaframe-api: todas las pruebas OK');
