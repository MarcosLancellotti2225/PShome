#!/usr/bin/env node
// Convierte una herramienta clásica (HTML + CSS + JS sueltos) en una pantalla montable de la app.
//
//   node scripts/legacy/convert.mjs scripts/legacy/<id>.config.mjs     (una)
//   npm run legacy                                                     (todas)
//
// Genera en src/tools/<id>/legacy/:
//   markup.html  → el <body> original sin <script> (con la paleta Namirial si corresponde)
//   styles.css   → el CSS original encapsulado bajo .lg-<id> (no pisa al resto de la app)
//   app.js       → el JS original dentro de mount(): las funciones que usan los botones
//                  (onclick="...") se exponen en window y el arranque (DOMContentLoaded) se llama al final.
//
// La lógica NO se toca. Para cambiar una herramienta, editá los archivos generados o, si todavía
// se regenera desde el repo viejo, el original y volvé a correr este script.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import postcss from 'postcss';
import * as acorn from 'acorn';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = (await import(pathToFileURL(resolve(process.argv[2])).href)).default;
const scope = `.lg-${cfg.id}`;
const outDir = resolve(ROOT, `src/tools/${cfg.id}/legacy`);
mkdirSync(outDir, { recursive: true });

const HEADER = (what) => `GENERADO por scripts/legacy/convert.mjs desde ${cfg.source} (${what}). La lógica es la original.`;

// ── Colores: reemplazo de la paleta vieja por la de Namirial ─────────────────
function hexToRgb(h) {
  let x = h.replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
}
function recolor(text, map) {
  if (!map) return text;
  let out = text;
  for (const [from, to] of Object.entries(map)) {
    const re = new RegExp(`${from.replace('#', '#')}(?![0-9a-fA-F])`, 'gi');
    out = out.replace(re, to);
    // rgba(r,g,b,a) del mismo color
    const [r, g, b] = hexToRgb(from);
    const [R, G, B] = hexToRgb(to);
    out = out.replace(new RegExp(`rgba\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*,`, 'g'), `rgba(${R}, ${G}, ${B},`);
  }
  return out;
}

// ── CSS encapsulado ──────────────────────────────────────────────────────────
const ROOT_SEL = /^(:root|html|body)((?:\[[^\]]*\]|:not\([^)]*\)|:[a-z-]+)*)(.*)$/;
function scopeSelector(sel) {
  const s = sel.trim();
  if (!s) return s;
  const m = s.match(ROOT_SEL);
  if (m) {
    const [, el, suffix, rest] = m;
    // html[data-theme=x] / :root:not(...) → la condición queda en <html>, el estilo va al contenedor
    if (suffix && el !== 'body') return `html${suffix} ${scope}${rest}`.trim();
    return `${scope}${suffix}${rest}`;
  }
  return `${scope} ${s}`;
}
function scopeCss(css) {
  const root = postcss.parse(css);
  root.walkAtRules((at) => {
    if (at.name === 'import' || at.name === 'charset') at.remove();
    if (cfg.dropDarkMode && at.name === 'media' && /prefers-color-scheme:\s*dark/.test(at.params)) at.remove();
  });
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    if (cfg.dropDarkMode && /data-theme=["']?dark/.test(rule.selector)) { rule.remove(); return; }
    rule.selectors = rule.selectors.map(scopeSelector);
  });
  root.walkDecls((d) => {
    if (/^font(-family)?$/.test(d.prop)) {
      d.value = d.value
        .replace(/["']?(Inter|DM Sans|Instrument Sans)["']?/g, "'Open Sans'")
        .replace(/-apple-system,\s*BlinkMacSystemFont,[^;!]*?sans-serif/g, "var(--font-family)");
    }
  });
  let out = root.toString();
  out = recolor(out, cfg.colors);
  return `/* ${HEADER('CSS')} */\n${scope} { font-family: var(--font-family); }\n${out}\n\n/* Ajustes para correr dentro de la app */\n${cfg.extraCss || ''}\n`;
}

// ── Markup ───────────────────────────────────────────────────────────────────
const html = readFileSync(resolve(ROOT, cfg.dir, cfg.html), 'utf8');
const inlineCss = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const inlineJs = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
body = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').trim();
if (cfg.recolorMarkup) body = recolor(body, cfg.colors);
for (const [from, to] of cfg.markupReplace || []) {
  if (!body.includes(from)) throw new Error(`markupReplace no encontró: ${from.slice(0, 60)}`);
  body = body.replace(from, to);
}
writeFileSync(resolve(outDir, 'markup.html'), `<!-- ${HEADER('HTML')} -->\n${body}\n`);

// ── CSS ──────────────────────────────────────────────────────────────────────
const css = [...(cfg.css || []).map((f) => readFileSync(resolve(ROOT, cfg.dir, f), 'utf8')), inlineCss].join('\n');
writeFileSync(resolve(outDir, 'styles.css'), scopeCss(css));

// ── JS ───────────────────────────────────────────────────────────────────────
let code = [...(cfg.js || []).map((f) => readFileSync(resolve(ROOT, cfg.dir, f), 'utf8')), ...inlineJs].join('\n;\n');
for (const [from, to] of cfg.jsReplace || []) {
  if (!code.includes(from)) throw new Error(`jsReplace no encontró: ${from.slice(0, 60)}`);
  code = code.split(from).join(to);
}
// El arranque (DOMContentLoaded) se agenda para cuando terminó de cargarse todo el código, como en el original.
const boot = [];
code = code.replace(/document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\);?/g, (_, fn) => { boot.push(fn); return `queueMicrotask(${fn}); /* antes: DOMContentLoaded */`; });

const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
let exposed = ast.body.filter((n) => n.type === 'FunctionDeclaration').map((n) => n.id.name);
// exposeOnly: la herramienta no usa onclick en el HTML; solo se exponen las funciones que se nombran.
if (cfg.exposeOnly) {
  const faltan = cfg.exposeOnly.filter((n) => !exposed.includes(n));
  if (faltan.length) throw new Error(`exposeOnly: no existen ${faltan.join(', ')}`);
  exposed = [...cfg.exposeOnly];
}
for (const n of ast.body) {
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier' && (cfg.exposeVars || []).includes(d.id.name)) exposed.push(d.id.name);
}

// Verificación: todo lo que llaman los onclick="..." tiene que existir.
const handlerSrc = body + code;
const called = new Set([...handlerSrc.matchAll(/\son[a-z]+=\\?["']\s*([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]));
const windowAssigned = new Set([...code.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]));
const missing = [...called].filter((n) => !exposed.includes(n) && !windowAssigned.has(n) && !['alert', 'confirm', 'event', 'this', 'document', 'window', 'navigator', 'history', 'location'].includes(n));
if (missing.length) {
  console.error('Funciones usadas por botones que no se encuentran:', missing.join(', '));
  process.exit(1);
}

const mod = `/* eslint-disable */
// ${HEADER('JS')}
// Ruta base de la app (para archivos de public/, como docs/ o mapear.html).
const __PSTOOLS_BASE__ = import.meta.env.BASE_URL;
export const EXPOSED = ${JSON.stringify(exposed)};

export function mount() {
${code}
;
  // Las funciones que usan los botones viven en window. Si dos herramientas comparten un nombre,
  // la que está en pantalla vuelve a ponerlas al reaparecer (LegacyTool llama a lo que devuelve mount).
  const __exposed = { ${exposed.join(', ')} };
  Object.assign(window, __exposed);
  return () => Object.assign(window, __exposed);
}
`;
writeFileSync(resolve(outDir, 'app.js'), mod);
console.log(`${cfg.id}: ${exposed.length} funciones expuestas, arranque: [${boot.join(', ')}], handlers verificados: ${called.size}`);
