#!/usr/bin/env node
// MCP de SE Tools — expone la lógica de src/lib a Claude (Claude Desktop / Claude Code).
// Corre en tu máquina con Node (stdio). Usa los MISMOS archivos que la app: si mejorás
// src/lib, Claude lo usa al toque. Ver mcp/README.md.
//
// Cada simulación se guarda como «trabajo» (.json) en SE_TOOLS_TRABAJOS
// (por defecto ~/se-tools-trabajos). Se abre en SE Tools → Signaframe → Signaframe Studio.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, basename } from 'node:path';

import { simulate } from '../src/lib/signaframe-engine/index.js';
import { analyzeFormDef, compareWithSample } from '../src/lib/json-mapper/index.js';
import { construirModelo } from '../src/lib/json-mapper/revisor/modelo.js';
import { revisar, cobertura } from '../src/lib/json-mapper/revisor/reglas.js';
import { detectFields } from '../src/lib/pdf-detect/index.js';
import { formDefFromMatrixXlsx, readMatrixXlsx, diffFormDefs, allFields } from '../src/lib/signaframe-formdef/index.js';
import { editMatrixXlsx } from '../src/lib/signaframe-formdef/matrix-edit.js';
import { createClient, templateFormDef, DEFAULT_URL } from '../src/lib/signaframe-api/index.js';
import { createHash, randomBytes } from 'node:crypto';

const TRABAJOS = process.env.SE_TOOLS_TRABAJOS || join(homedir(), 'se-tools-trabajos');
const TRABAJO_TIPO = 'se-tools/signaframe-trabajo';

// ── helpers ──────────────────────────────────────────────────────────────────
const expand = (p) => resolve(String(p).trim().replace(/^~(?=[/\\])/, homedir()));

/** Acepta una ruta a un .json o el JSON pegado como texto. */
async function loadJson(src, what) {
  const t = String(src ?? '').trim();
  if (!t) throw new Error(`Falta ${what}`);
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  const p = expand(t);
  if (!existsSync(p)) throw new Error(`No encuentro ${what}: ${p}`);
  return JSON.parse(await readFile(p, 'utf8'));
}

/** El form-def puede venir pelado, como respuesta de la API o como export de plantilla. */
function unwrapFormDef(j) {
  if (j?.sections) return j;
  for (const c of [j?.formDefinition, j?.definition, j?.data?.jsonDefinition, j?.jsonDefinition, j?.data?.formDefinition]) {
    if (c?.sections) return c;
  }
  throw new Error('El archivo no parece un form-def: no tiene "sections"');
}

const slug = (s) => String(s || 'trabajo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 60);

async function saveTrabajo(nombre, data) {
  await mkdir(TRABAJOS, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const file = join(TRABAJOS, `${ts}_${slug(nombre)}.json`);
  await writeFile(file, JSON.stringify({ tipo: TRABAJO_TIPO, version: 1, nombre, creado: new Date().toISOString(), ...data }, null, 1));
  return file;
}

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const lines = (arr) => arr.filter((x) => x != null && x !== '').join('\n');
const jsonOrPath = (what) => z.string().describe(`${what}: ruta a un archivo .json en esta máquina, o el JSON pegado como texto`);

const SEV = { error: 'ERROR', aviso: 'AVISO', nota: 'NOTA', warning: 'AVISO', info: 'NOTA' };

function revisionDe(formDef, ejemplo) {
  const modelo = construirModelo(formDef);
  const hallazgos = revisar(modelo);
  const cob = ejemplo ? cobertura(modelo, ejemplo) : null;
  return { hallazgos, cobertura: cob };
}

// ── servidor ─────────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'se-tools', version: '0.1.0' });

server.registerTool(
  'simular_formulario',
  {
    title: 'Simular formulario de Signaframe',
    description:
      'Simula un formulario de Signaframe SIN crear proceso, con el mismo motor que el front de Signaframe. ' +
      'Con el form-def y el payload del cliente devuelve el JSON que se enviaría (al INS), el valor de cada AcroForm del PDF ' +
      'y diagnósticos: prefill que no matchea opciones, datos del payload sin uso, obligatorios vacíos u ocultos, ' +
      'diferencias contra un JSON esperado, y las reglas del Revisor. Guarda un «trabajo» que se abre en SE Tools para verlo y editarlo.',
    inputSchema: {
      form_def: jsonOrPath('form-def de la plantilla'),
      payload: jsonOrPath('Payload del cliente (body del POST /api/processes, con encabezado y datosFormulario)').optional(),
      edits: z.record(z.string()).optional().describe('Valores que cargaría la persona: { "field_x": "valor visible" }'),
      esperado: jsonOrPath('JSON que debería salir, para comparar campo por campo').optional(),
      nombre: z.string().optional().describe('Nombre del trabajo, ej. "VUA01KYC v3"'),
    },
  },
  async ({ form_def, payload, edits, esperado, nombre }) => {
    const formDefinition = unwrapFormDef(await loadJson(form_def, 'el form-def'));
    const pl = payload ? await loadJson(payload, 'el payload') : null;
    const exp = esperado ? await loadJson(esperado, 'el JSON esperado') : null;

    const r = simulate({ formDefinition, payload: pl, edits, expectedJson: exp });
    const rev = revisionDe(formDefinition, pl);
    const name = nombre || (typeof form_def === 'string' && !form_def.trim().startsWith('{') ? basename(form_def).replace(/\.json$/i, '') : 'Simulación');
    const file = await saveTrabajo(name, {
      entrada: { formDefinition, payload: pl, edits: edits ?? {}, expectedJson: exp },
      resultado: r,
      revision: rev,
    });

    const n = (l) => r.issues.filter((i) => i.level === l).length;
    const revErr = rev.hallazgos.filter((h) => h.severidad === 'error').length;
    const top = [
      ...r.issues.filter((i) => i.level !== 'info').map((i) => `- [${SEV[i.level]}] ${i.code} · ${i.fieldId ?? i.path ?? ''}: ${i.message}`),
      ...rev.hallazgos.filter((h) => h.severidad !== 'nota').map((h) => `- [${SEV[h.severidad]}] Revisor ${h.regla} · ${h.titulo}${h.campoIds?.length ? ` (${h.campoIds.slice(0, 3).join(', ')}${h.campoIds.length > 3 ? '…' : ''})` : ''}`),
    ].slice(0, 25);

    return {
      content: [
        {
          type: 'text',
          text: lines([
            `Trabajo guardado: ${file}`,
            'Para verlo: SE Tools → Signaframe → Signaframe Studio → Abrir trabajo.',
            '',
            `Campos: ${r.stats.fields} · precargados: ${r.stats.prefilled} · ocultos por regla: ${r.stats.hiddenByRule}`,
            `PDF: ${r.stats.pdfValues} AcroForms con valor · JSON: ${r.stats.jsonLeaves} valores`,
            r.diff ? `Contra el esperado: ${r.diff.length === 0 ? 'IDÉNTICO' : `${r.diff.length} diferencias`}` : null,
            `Simulación: ${n('error')} errores · ${n('warning')} avisos · ${n('info')} notas`,
            `Revisor: ${revErr} errores · ${rev.hallazgos.length} hallazgos en total`,
            top.length ? '\n' + top.join('\n') : null,
          ]),
        },
        { type: 'text', text: 'JSON que se enviaría:\n' + JSON.stringify(r.json, null, 2) },
      ],
    };
  },
);

server.registerTool(
  'revisar_formdef',
  {
    title: 'Revisar form-def',
    description:
      'Corre las 26 reglas de plataforma del Revisor sobre un form-def de Signaframe (casillas que pintan con "X", fechas mal formateadas, ' +
      'condiciones por etiqueta, rutas que se pisan, etc.). Opcional: con un JSON de ejemplo del cliente, mide qué rutas cubre. No corrige nada.',
    inputSchema: {
      form_def: jsonOrPath('form-def'),
      ejemplo: jsonOrPath('JSON de ejemplo del cliente, para la cobertura').optional(),
    },
  },
  async ({ form_def, ejemplo }) => {
    const fd = unwrapFormDef(await loadJson(form_def, 'el form-def'));
    const ej = ejemplo ? await loadJson(ejemplo, 'el ejemplo') : null;
    const { hallazgos, cobertura: cob } = revisionDe(fd, ej);
    const by = (s) => hallazgos.filter((h) => h.severidad === s).length;
    return text(
      lines([
        `Revisor: ${by('error')} errores · ${by('aviso')} avisos · ${by('nota')} notas`,
        cob ? `Cobertura del ejemplo: ${cob.cubiertas}/${cob.total} rutas${cob.faltan.length ? ` · faltan: ${cob.faltan.slice(0, 15).join(', ')}${cob.faltan.length > 15 ? '…' : ''}` : ''}` : null,
        '',
        ...hallazgos.map((h) => `- [${SEV[h.severidad]}] ${h.regla} ${h.titulo}${h.ref ? ` ${h.ref}` : ''}\n  ${h.detalle}${h.campoIds?.length ? `\n  campos: ${h.campoIds.join(', ')}` : ''}`),
      ]),
    );
  },
);

server.registerTool(
  'comparar_json',
  {
    title: 'Comparar JSON del form-def con el del cliente',
    description:
      'Dibuja el JSON de salida (o de entrada) que declara un form-def y lo compara con un JSON real del cliente: ' +
      'qué rutas faltan, cuáles sobran y cuáles tienen otra forma. Es la lógica del Comparador JSON de SE Tools.',
    inputSchema: {
      form_def: jsonOrPath('form-def'),
      json_cliente: jsonOrPath('JSON real del cliente'),
      direccion: z.enum(['salida', 'entrada']).optional().describe('salida (lo que emite el form) o entrada (lo que precarga). Por defecto, salida'),
    },
  },
  async ({ form_def, json_cliente, direccion }) => {
    const fd = unwrapFormDef(await loadJson(form_def, 'el form-def'));
    const cli = await loadJson(json_cliente, 'el JSON del cliente');
    const analysis = analyzeFormDef(fd);
    const cmp = compareWithSample(analysis, cli, direccion === 'entrada' ? 'input' : 'output');
    const rows = (cmp?.rows ?? []).filter((r) => r.status !== 'ok');
    const c = cmp?.counts ?? {};
    return text(
      lines([
        `Comparación (${direccion ?? 'salida'}): ${c.ok ?? 0} coinciden · ${c.falta ?? 0} faltan · ${c.forma ?? 0} con otra forma · ${c.sobra ?? 0} sobran`,
        '',
        ...rows.slice(0, 80).map((r) => `- ${r.status.toUpperCase()} ${r.path}${r.detail ? ` — ${r.detail}` : ''}`),
        rows.length > 80 ? `… y ${rows.length - 80} más` : null,
      ]),
    );
  },
);

server.registerTool(
  'detectar_campos_pdf',
  {
    title: 'Detectar campos del PDF',
    description:
      'Lee un PDF y lista sus AcroForms ordenados como se leen (arriba→abajo, izquierda→derecha), con tipo, página y posición. No modifica el PDF.',
    inputSchema: { pdf: z.string().describe('Ruta al PDF en esta máquina') },
  },
  async ({ pdf }) => {
    const p = expand(pdf);
    if (!existsSync(p)) throw new Error(`No encuentro el PDF: ${p}`);
    const { fields, stats } = await detectFields(new Uint8Array(await readFile(p)));
    return text(
      lines([
        `${stats.total} campos en ${stats.pages} páginas`,
        '',
        ...fields.map((f, i) => `${String(i + 1).padStart(3)}. p${f.page} ${f.type ?? ''} ${f.name}  [x ${Math.round(f.x ?? 0)}, y ${Math.round(f.y ?? 0)}, ${Math.round(f.width ?? 0)}×${Math.round(f.height ?? 0)}]`),
      ]),
    );
  },
);

server.registerTool(
  'armar_json_formulario',
  {
    title: 'Armar el JSON del formulario',
    description:
      'Arma el form-def de Signaframe (el JSON que se sube) desde la matriz interna (.xlsx con las hojas «Formulario Signaframe» y «Opciones») y el main de Signaframe. ' +
      'Igual que el botón «Bajar JSON del formulario» de SE Tools: el id y el sourceMeta de cada campo del PDF salen del main tal cual. ' +
      'Guarda el JSON al lado de la matriz (o en la ruta pedida) y devuelve el resumen y lo que encontró el Revisor.',
    inputSchema: {
      matriz: z.string().describe('Ruta a la matriz interna (.xlsx) en esta máquina'),
      main: jsonOrPath('Main de Signaframe (export con el PDF importado)').optional(),
      version: z.string().optional().describe('Versión del JSON, ej. "v2". Por defecto v1'),
      salida: z.string().optional().describe('Ruta del .json a escribir. Por defecto, al lado de la matriz'),
    },
  },
  async ({ matriz, main, version, salida }) => {
    const p = expand(matriz);
    if (!existsSync(p)) throw new Error(`No encuentro la matriz: ${p}`);
    const mainJson = main ? await loadJson(main, 'el main') : null;
    const ver = (version || 'v1').trim();
    const { formDef, report } = formDefFromMatrixXlsx(new Uint8Array(await readFile(p)), mainJson, { version: ver });
    const out = salida ? expand(salida) : p.replace(/(_matriz_interna)?\.xlsx$/i, '') + `_form-def_${ver}.json`;
    await writeFile(out, JSON.stringify(formDef, null, 2));
    const { hallazgos } = revisionDe(formDef);
    const cuenta = (s) => hallazgos.filter((h) => h.severidad === s).length;
    const list = (titulo, arr) => (arr.length ? [`${titulo} (${arr.length}):`, ...arr.slice(0, 40).map((x) => `  - ${x}`), arr.length > 40 ? `  … y ${arr.length - 40} más` : null] : []);
    return text(
      lines([
        `JSON guardado en ${out}`,
        `${report.campos} campos · ${report.pasos} pasos · Revisor: ${cuenta('error')} errores, ${cuenta('aviso')} avisos`,
        mainJson ? null : 'Sin main: los campos del PDF llevan solo el nombre del casillero (sin página ni posición).',
        ...list('Casilleros que no están en el main (no pintan)', report.sinCasillero.map((x) => `${x.id} → ${x.casillero}`)),
        ...list('Firmas sin ubicar (posición provisoria)', report.firmasSinUbicar),
        ...list('Ids repetidos', report.repetidos),
        ...list('Ids corregidos por los del main', report.idCorregido.map((x) => `${x.de} → ${x.a}`)),
        ...list('Casilleros del main sin usar (ocultos)', report.sinUsar),
        ...list('Errores del Revisor', hallazgos.filter((h) => h.severidad === 'error').map((h) => `${h.regla} ${h.titulo}`)),
        ...list('Avisos de la matriz', report.warn),
      ]),
    );
  },
);

// ── Matriz interna ──────────────────────────────────────────────────────────

/** Próxima versión libre: D0770_matriz_interna.xlsx → D0770_matriz_interna_v2.xlsx (no pisa nada). */
function nextVersion(p) {
  const m = p.match(/^(.*?)(?:_v(\d+))?(\.[^.]+)$/);
  let n = m[2] ? Number(m[2]) + 1 : 2;
  while (existsSync(`${m[1]}_v${n}${m[3]}`)) n++;
  return `${m[1]}_v${n}${m[3]}`;
}

server.registerTool(
  'leer_matriz',
  {
    title: 'Leer la matriz interna',
    description:
      'Muestra la matriz interna (.xlsx) como la ve el armador del JSON: pasos, subsecciones y campos con id, tipo, etiqueta, oculto, obligatorio, casillero del PDF y ruta JSON. ' +
      'Con «buscar» filtra por id, etiqueta, casillero o ruta. Usalo antes de editar_matriz para saber los ids.',
    inputSchema: {
      matriz: z.string().describe('Ruta a la matriz interna (.xlsx)'),
      buscar: z.string().optional().describe('Texto a buscar (id, etiqueta, casillero o ruta)'),
    },
  },
  async ({ matriz, buscar }) => {
    const p = expand(matriz);
    if (!existsSync(p)) throw new Error(`No encuentro la matriz: ${p}`);
    const { steps, warn } = readMatrixXlsx(new Uint8Array(await readFile(p)));
    const q = (buscar || '').toLowerCase();
    const hit = (f) => !q || [f.id, f.label, f._box, f.jsonOutputPath].some((x) => String(x || '').toLowerCase().includes(q));
    const flags = (f) => [f.hidden && 'oculto', f.readOnly && 'solo lectura', f.required && 'obligatorio', f.excludeFromJson && 'fuera del JSON'].filter(Boolean).join(', ');
    const out = [];
    let n = 0;
    for (const st of steps) {
      const block = [];
      const fieldLines = (fs, pad) => fs.filter(hit).forEach((f) => {
        n++;
        block.push(`${pad}- ${f.id} · ${f.type} · «${f.label}»${flags(f) ? ` [${flags(f)}]` : ''}${f._box ? ` · PDF ${f._box}` : ''}${f.jsonOutputPath ? ` · ${f.jsonOutputPath}` : ''}${f.options ? ` · ${f.options.length} opciones` : ''}`);
      });
      fieldLines(st.fields, '  ');
      for (const sub of st.subs) {
        const before = block.length;
        fieldLines(sub.fields, '    ');
        if (block.length > before || !q) block.splice(before, 0, `  ▸ ${sub.title} (${sub.id})${sub.hidden ? ' [oculta]' : ''}`);
      }
      if (block.length || !q) out.push(`■ ${st.title} (${st.id})${st.hidden ? ' [oculto]' : ''}`, ...block);
    }
    return text(lines([`${n} campos${q ? ` que coinciden con «${buscar}»` : ''}`, '', ...out.slice(0, 600), out.length > 600 ? `… (${out.length - 600} líneas más: usá «buscar»)` : null, ...warn.map((w) => `Aviso: ${w}`)]));
  },
);

const cambioSchema = z.object({
  id: z.string().describe('id del campo (como lo muestra leer_matriz)'),
  propiedad: z.string().optional().describe('Qué cambiar: label, type, hidden, readOnly, required, width, jsonOutputPath, prefillKey, excludeFromJson, conditionalVisibility, autoFillConcat, radioGroupLabel, sourceName, o cualquier otra propiedad del form-def (maxLength, defaultValue, checkedPdfValue…)'),
  valor: z.any().optional().describe('Valor nuevo. Para oculto/obligatorio: true o false. null o vacío quita la propiedad'),
  opciones: z.array(z.record(z.any())).optional().describe('Reemplaza todas las opciones del campo: [{label, pdfValue, jsonValue, parentValues}]'),
});

server.registerTool(
  'editar_matriz',
  {
    title: 'Editar la matriz interna',
    description:
      'Cambia campos de la matriz interna (.xlsx) por id y guarda una versión NUEVA al lado (…_v2.xlsx); el original no se toca. ' +
      'Después se puede armar el JSON con armar_json_formulario sobre el archivo nuevo. El id de un campo no se cambia (regla de oro).',
    inputSchema: {
      matriz: z.string().describe('Ruta a la matriz interna (.xlsx)'),
      cambios: z.array(cambioSchema).min(1),
      salida: z.string().optional().describe('Ruta del .xlsx nuevo. Por defecto, la próxima versión al lado del original'),
    },
  },
  async ({ matriz, cambios, salida }) => {
    const p = expand(matriz);
    if (!existsSync(p)) throw new Error(`No encuentro la matriz: ${p}`);
    const { bytes, aplicados, errores } = await editMatrixXlsx(new Uint8Array(await readFile(p)), cambios);
    if (!aplicados.length) return text(lines(['No se aplicó ningún cambio.', ...errores.map((e) => `- ${e}`)]));
    const out = salida ? expand(salida) : nextVersion(p);
    await writeFile(out, bytes);
    return text(lines([`Matriz guardada en ${out}`, `${aplicados.length} cambios:`, ...aplicados.map((a) => `- ${a}`), ...(errores.length ? ['No se aplicaron:', ...errores.map((e) => `- ${e}`)] : [])]));
  },
);

// ── Signaframe (API) ────────────────────────────────────────────────────────
// Credenciales en la config de Claude Desktop: SIGNAFRAME_URL, y SIGNAFRAME_TOKEN o SIGNAFRAME_EMAIL + SIGNAFRAME_PASSWORD.

let sf = null;
function signaframe() {
  if (!sf) {
    sf = createClient({
      url: process.env.SIGNAFRAME_URL || DEFAULT_URL,
      token: process.env.SIGNAFRAME_TOKEN,
      email: process.env.SIGNAFRAME_EMAIL,
      password: process.env.SIGNAFRAME_PASSWORD,
    });
  }
  return sf;
}
const SF_DIR = join(TRABAJOS, 'signaframe');
async function saveSf(name, data) {
  await mkdir(SF_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const file = join(SF_DIR, `${ts}_${slug(name)}`);
  await writeFile(file, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data, null, 2));
  return file;
}

// Cambios en Signaframe: primero se muestran y devuelven un código; se aplican solo con ese código.
const PENDING = new Map(); // código → { hash, vence }
const hashOf = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function askConfirm(action, preview) {
  const code = randomBytes(3).toString('hex').toUpperCase();
  PENDING.set(code, { hash: hashOf(action), vence: Date.now() + 15 * 60 * 1000 });
  return text(lines([
    ...preview,
    '',
    `PARA APLICARLO: mostrale este resumen al usuario y pedile que confirme. Solo si dice que sí, volvé a llamar con confirmacion: "${code}" (vale 15 minutos y solo para exactamente este cambio).`,
  ]));
}
function checkConfirm(code, action) {
  const p = PENDING.get(String(code || '').trim().toUpperCase());
  if (!p || p.vence < Date.now() || p.hash !== hashOf(action)) return false;
  PENDING.delete(String(code).trim().toUpperCase());
  return true;
}
const confirmField = z.string().optional().describe('Código que devolvió la primera llamada. Pasalo SOLO después de que el usuario confirme');

const tplLine = (t) => `- ${t.name} · id ${t.id} · estado ${t.status}${t.isPublished ? ' · publicada' : ''}${t.category ? ` · ${t.category}` : ''} · actualizada ${String(t.updatedAt || '').slice(0, 10)}`;

server.registerTool(
  'signaframe_conexion',
  {
    title: 'Signaframe: probar la conexión',
    description: 'Muestra a qué Signaframe está conectado el MCP, la versión desplegada y con qué usuario.',
    inputSchema: {},
  },
  async () => {
    const c = signaframe();
    const v = await c.version().catch(() => null);
    const me = await c.me();
    return text(lines([`Conectado a ${c.base}`, v ? `Versión: ${v.version ?? ''} ${v.commit ? `(${String(v.commit).slice(0, 7)})` : ''}` : null, `Usuario: ${me.firstName ?? ''} ${me.lastName ?? ''} <${me.email}> · rol ${me.role}`]));
  },
);

server.registerTool(
  'signaframe_plantillas',
  {
    title: 'Signaframe: buscar plantillas',
    description: 'Lista las plantillas de Signaframe (con su id), filtrando por texto. Solo lectura.',
    inputSchema: {
      buscar: z.string().optional().describe('Texto a buscar en el nombre, ej. "D0770"'),
      pagina: z.number().int().optional(),
    },
  },
  async ({ buscar, pagina }) => {
    const r = await signaframe().listTemplates({ search: buscar, page: pagina });
    return text(lines([`${r.totalItems} plantillas${buscar ? ` con «${buscar}»` : ''} (página ${r.page} de ${r.totalPages})`, ...(r.items || []).map(tplLine)]));
  },
);

server.registerTool(
  'signaframe_traer_plantilla',
  {
    title: 'Signaframe: traer el form-def de una plantilla',
    description:
      'Baja la plantilla, guarda su form-def como .json en la carpeta de trabajos (para revisarlo, simularlo o editarlo) y muestra el resumen y lo que encuentra el Revisor. Solo lectura.',
    inputSchema: { id: z.string().describe('id de la plantilla (ver signaframe_plantillas)') },
  },
  async ({ id }) => {
    const t = await signaframe().getTemplate(id);
    const fd = templateFormDef(t);
    if (!fd) return text(`La plantilla ${t.name} (${id}) no tiene form-def todavía.`);
    const file = await saveSf(`${t.name}_${fd.version || ''}.json`, fd);
    const { hallazgos } = revisionDe(fd);
    const cuenta = (s) => hallazgos.filter((h) => h.severidad === s).length;
    return text(lines([
      `${t.name} · id ${t.id} · estado ${t.status}${t.isPublished ? ' · publicada' : ''} · versión del JSON ${fd.version ?? '(sin versión)'}`,
      `${allFields(fd.sections || []).length} campos en ${(fd.sections || []).length} secciones · Revisor: ${cuenta('error')} errores, ${cuenta('aviso')} avisos`,
      `Form-def guardado en ${file}`,
    ]));
  },
);

server.registerTool(
  'signaframe_subir_formdef',
  {
    title: 'Signaframe: subir un form-def a una plantilla',
    description:
      'Reemplaza el form-def de una plantilla de Signaframe. Primera llamada (sin confirmacion): guarda una copia del form-def actual, muestra qué cambia y lo que dice el Revisor, y devuelve un código. ' +
      'Segunda llamada con ese código (solo si el usuario confirmó): sube el cambio. Frena si se rompe la regla de oro (ids o sourceMeta de los campos del PDF) o si el Revisor da errores, salvo forzar.',
    inputSchema: {
      id: z.string().describe('id de la plantilla'),
      form_def: jsonOrPath('Form-def a subir'),
      forzar: z.boolean().optional().describe('Subir aunque haya errores del Revisor o cambios en la regla de oro. Solo si el usuario lo pide explícitamente'),
      confirmacion: confirmField,
    },
  },
  async ({ id, form_def, forzar, confirmacion }) => {
    const nuevo = unwrapFormDef(await loadJson(form_def, 'el form-def'));
    const c = signaframe();
    const t = await c.getTemplate(id);
    const actual = templateFormDef(t);
    const d = diffFormDefs(actual, nuevo);
    const { hallazgos } = revisionDe(nuevo);
    const errores = hallazgos.filter((h) => h.severidad === 'error');
    const action = { op: 'subir', id, nuevo };
    if (d.iguales) return text('El form-def es igual al que ya está en Signaframe: no hay nada que subir.');
    if (!forzar && (d.reglaDeOro.length || errores.length)) {
      return text(lines([
        'NO SE SUBE.',
        ...(d.reglaDeOro.length ? ['Regla de oro (los campos del PDF no se tocan):', ...d.reglaDeOro.slice(0, 30).map((x) => `- ${x}`)] : []),
        ...(errores.length ? ['Errores del Revisor:', ...errores.slice(0, 30).map((h) => `- ${h.regla} ${h.titulo}`)] : []),
        'Corregilo, o volvé a llamar con forzar: true si el usuario lo pide explícitamente.',
      ]));
    }
    const preview = [
      `Plantilla: ${t.name} (id ${id})${t.isPublished ? ' · PUBLICADA: el cambio lo ven los procesos nuevos' : ''}`,
      `Versión: ${actual?.version ?? '(sin)'} → ${nuevo.version ?? '(sin)'}`,
      `Campos: ${d.agregados.length} nuevos, ${d.quitados.length} quitados, ${d.cambiados.length} cambiados · secciones: +${d.secciones.agregadas.length} −${d.secciones.quitadas.length}`,
      Object.keys(d.porPropiedad).length ? `Qué cambia: ${Object.entries(d.porPropiedad).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} (${n})`).join(', ')}` : null,
      ...d.agregados.slice(0, 15).map((x) => `  + ${x}`),
      ...d.quitados.slice(0, 15).map((x) => `  − ${x}`),
      ...d.cambiados.slice(0, 25).map((x) => `  ~ ${x.id}: ${x.claves.join(', ')}`),
      d.cambiados.length > 25 ? `  … y ${d.cambiados.length - 25} más` : null,
      `Revisor: ${errores.length} errores, ${hallazgos.filter((h) => h.severidad === 'aviso').length} avisos`,
      forzar && (d.reglaDeOro.length || errores.length) ? 'OJO: se sube forzado, con problemas de regla de oro o del Revisor.' : null,
    ];
    if (!checkConfirm(confirmacion, action)) return askConfirm(action, preview);
    const backup = actual ? await saveSf(`${t.name}_antes_de_subir.json`, actual) : null;
    await c.updateTemplate(id, { name: t.name, description: t.description, category: t.category, jsonDefinition: JSON.stringify(nuevo) });
    const check = templateFormDef(await c.getTemplate(id));
    const ok = check && diffFormDefs(check, nuevo).iguales;
    return text(lines([
      ok ? `Subido a «${t.name}». Signaframe devuelve el form-def nuevo.` : `Subido a «${t.name}», pero al volver a leerlo no coincide del todo: revisalo en Signaframe.`,
      backup ? `Copia del form-def anterior: ${backup}` : null,
      t.isPublished ? null : 'La plantilla no está publicada: para usarla en procesos hay que publicarla (signaframe_publicar).',
    ]));
  },
);

server.registerTool(
  'signaframe_publicar',
  {
    title: 'Signaframe: publicar o despublicar una plantilla',
    description: 'Publica o despublica una plantilla. Pide confirmación con código como signaframe_subir_formdef.',
    inputSchema: {
      id: z.string(),
      accion: z.enum(['publicar', 'despublicar']),
      confirmacion: confirmField,
    },
  },
  async ({ id, accion, confirmacion }) => {
    const c = signaframe();
    const t = await c.getTemplate(id);
    const action = { op: accion, id };
    if (!checkConfirm(confirmacion, action)) {
      return askConfirm(action, [`${accion === 'publicar' ? 'Publicar' : 'Despublicar'} «${t.name}» (id ${id}). Hoy está ${t.isPublished ? 'publicada' : 'sin publicar'}.`]);
    }
    if (accion === 'publicar') await c.publishTemplate(id); else await c.unpublishTemplate(id);
    const after = await c.getTemplate(id);
    return text(`«${t.name}»: ${after.isPublished ? 'publicada' : 'sin publicar'}.`);
  },
);

server.registerTool(
  'signaframe_rellenar_pdf',
  {
    title: 'Signaframe: ver cómo pinta el PDF',
    description:
      'Pide a Signaframe el PDF de la plantilla relleno y lo guarda en la carpeta de trabajos. Los valores salen de un payload del cliente (se simulan con el motor y el form-def de la plantilla) o se pasan directo por casillero. No crea procesos.',
    inputSchema: {
      id: z.string().describe('id de la plantilla'),
      payload: jsonOrPath('Payload del cliente (encabezado + datosFormulario)').optional(),
      valores: z.record(z.string()).optional().describe('Valores por casillero del PDF: { "nombreCasillero": "valor" }'),
    },
  },
  async ({ id, payload, valores }) => {
    const c = signaframe();
    let fieldValues = valores || {};
    if (payload) {
      const t = await c.getTemplate(id);
      const fd = templateFormDef(t);
      if (!fd) throw new Error('La plantilla no tiene form-def para simular el payload.');
      const r = simulate({ formDefinition: fd, payload: await loadJson(payload, 'el payload') });
      fieldValues = { ...Object.fromEntries(Object.entries(r.pdf).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])), ...fieldValues };
    }
    if (!Object.keys(fieldValues).length) throw new Error('Pasá un payload o valores por casillero.');
    const r = await c.fillTemplatePdf(id, fieldValues);
    const pdfs = r?.pdfs || [];
    const files = [];
    for (const p of pdfs) files.push(await saveSf(`${p.name || 'relleno'}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf'), Buffer.from(p.b64 || '', 'base64')));
    return text(lines([`${Object.keys(fieldValues).length} casilleros con valor · ${pdfs.length} PDF:`, ...files.map((f) => `- ${f}`)]));
  },
);

server.registerTool(
  'signaframe_procesos',
  {
    title: 'Signaframe: buscar procesos',
    description: 'Lista procesos (más nuevos primero), filtrando por texto, plantilla o estado. Solo lectura.',
    inputSchema: {
      buscar: z.string().optional(),
      plantilla: z.string().optional().describe('id de la plantilla'),
      estado: z.number().int().optional().describe('Estado (número, como lo devuelve Signaframe)'),
      pagina: z.number().int().optional(),
    },
  },
  async ({ buscar, plantilla, estado, pagina }) => {
    const r = await signaframe().listProcesses({ search: buscar, templateId: plantilla, status: estado, page: pagina, sortBy: 'createdAt', sortDir: 'desc' });
    return text(lines([
      `${r.totalItems} procesos (página ${r.page} de ${r.totalPages})`,
      ...(r.items || []).map((p) => `- ${p.id} · ${p.templateName ?? (p.templates || []).map((x) => x.templateName).join(' + ')} · estado ${p.status} · ${p.recipient?.fullName ?? ''} · ${String(p.createdAt || '').slice(0, 16).replace('T', ' ')}${p.externalReference ? ` · ref ${p.externalReference}` : ''}`),
    ]));
  },
);

server.registerTool(
  'signaframe_ver_proceso',
  {
    title: 'Signaframe: ver un proceso',
    description:
      'Muestra el estado de un proceso, sus documentos y firmas, y guarda en la carpeta de trabajos el detalle completo (datos que entraron y que se capturaron). Con auditoria: true suma los eventos y los callbacks. Solo lectura.',
    inputSchema: { id: z.string(), auditoria: z.boolean().optional() },
  },
  async ({ id, auditoria }) => {
    const c = signaframe();
    const p = await c.getProcess(id);
    const extra = auditoria ? { auditoria: await c.processAudit(id).catch(() => null), callbacks: await c.processCallbacks(id).catch(() => null) } : {};
    const file = await saveSf(`proceso_${id}.json`, { ...p, ...extra });
    return text(lines([
      `Proceso ${p.id} · estado ${p.status} · ${(p.templates || []).map((t) => t.templateName).join(' + ')}`,
      `Destinatario: ${p.recipient?.fullName ?? ''} ${p.recipient?.email ? `<${p.recipient.email}>` : ''}`,
      `Creado ${p.createdAt}${p.submittedAt ? ` · enviado ${p.submittedAt}` : ''}${p.completedAt ? ` · completado ${p.completedAt}` : ''}`,
      `Documentos: ${(p.documents || []).map((d) => `${d.name} (estado ${d.status}${d.signed ? ', firmado' : ''})`).join(' · ') || 'ninguno'}`,
      `Firmas: ${(p.signatureRequests || []).map((s) => `estado ${s.status}${s.failureReason ? ` — ${s.failureReason}` : ''}`).join(' · ') || 'ninguna'}`,
      auditoria ? `Eventos de auditoría: ${extra.auditoria?.items?.length ?? 0} · callbacks: ${extra.callbacks?.items?.length ?? 0}` : null,
      `Detalle completo (incluye los datos del cliente; queda solo en esta máquina): ${file}`,
    ]));
  },
);

server.registerTool(
  'signaframe_crear_proceso_prueba',
  {
    title: 'Signaframe: crear un proceso de prueba',
    description:
      'Crea un proceso con un payload (encabezado + datosFormulario) para ver el formulario real en el navegador. Nunca manda el mail al cliente (enviarCorreoEnlaceFirma = false). ' +
      'Pide confirmación con código. Devuelve el link del formulario.',
    inputSchema: { payload: jsonOrPath('Payload (encabezado + datosFormulario)'), confirmacion: confirmField },
  },
  async ({ payload, confirmacion }) => {
    const body = await loadJson(payload, 'el payload');
    if (!body.encabezado || !body.datosFormulario) throw new Error('El payload tiene que tener "encabezado" y "datosFormulario".');
    body.encabezado = { ...body.encabezado, enviarCorreoEnlaceFirma: false };
    const action = { op: 'proceso', body };
    if (!checkConfirm(confirmacion, action)) {
      const e = body.encabezado;
      return askConfirm(action, [
        `Crear un proceso en ${signaframe().base}`,
        `Formulario: ${e.codigoTipoFormulario ?? '?'} ${e.descripcionTipoFormulario ?? ''} · trámite ${e.codigoTipoTramite ?? '?'} · cliente ${e.nombreCompletoCliente ?? '?'} <${e.correoElectronico ?? '?'}>`,
        'No se manda el mail del enlace (enviarCorreoEnlaceFirma = false).',
      ]);
    }
    const r = await signaframe().createProcess(body);
    return text(lines([`Proceso creado: ${r.id} · estado ${r.status}`, `Formulario: ${r.accessUrl}`]));
  },
);

server.registerTool(
  'signaframe_listas',
  {
    title: 'Signaframe: listas predefinidas (catálogos)',
    description: 'Sin id: busca listas predefinidas. Con id: muestra sus valores (etiqueta, valor PDF, valor JSON, dependencias). Solo lectura.',
    inputSchema: { buscar: z.string().optional(), id: z.string().optional() },
  },
  async ({ buscar, id }) => {
    const c = signaframe();
    if (id) {
      const l = await c.getPresetList(id);
      return text(lines([`${l.name} · ${l.values?.length ?? 0} valores${l.isDependent ? ` · depende de ${l.parentFieldHint ?? '?'}` : ''}${l.jsonValueType ? ` · JSON ${l.jsonValueType}` : ''}`,
        ...(l.values || []).slice(0, 300).map((v) => `- ${v.label} · PDF «${v.pdfValue ?? ''}» · JSON «${v.jsonValue ?? ''}»${v.parentValues ? ` · si ${v.parentValues}` : ''}`)]));
    }
    const r = await c.listPresetLists({ search: buscar });
    return text(lines([`${r.totalItems} listas`, ...(r.items || []).map((l) => `- ${l.name} · id ${l.id} · ${l.valuesCount} valores${l.isDependent ? ' · dependiente' : ''}`)]));
  },
);

server.registerTool(
  'listar_trabajos',
  {
    title: 'Listar trabajos',
    description: 'Lista los trabajos de simulación guardados, más nuevos primero, con su ruta para abrirlos en SE Tools.',
    inputSchema: {},
  },
  async () => {
    if (!existsSync(TRABAJOS)) return text(`Todavía no hay trabajos en ${TRABAJOS}.`);
    const files = (await readdir(TRABAJOS)).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 50);
    const out = [];
    for (const f of files) {
      const s = await stat(join(TRABAJOS, f));
      out.push(`- ${join(TRABAJOS, f)} · ${Math.round(s.size / 1024)} KB`);
    }
    return text(lines([`Trabajos en ${TRABAJOS}:`, ...out]));
  },
);

await server.connect(new StdioServerTransport());
