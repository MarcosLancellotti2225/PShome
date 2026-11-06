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
import { formDefFromMatrixXlsx } from '../src/lib/signaframe-formdef/index.js';

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
