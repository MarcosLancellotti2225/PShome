#!/usr/bin/env node
// Regenera las constantes DIC y DIC_PDF a partir del Diccionario General INS–Namirial.
//
//   node tools/build_dic.mjs [docs/diccionario_v10.xlsx] [index.html mapear.html …]
//
// Lee la hoja «Diccionario (Namirial)» (o «Diccionario General» en las versiones viejas): Paso, Sección,
// Visible, Nombre del campo en el PDF, Nombre AcroForm (si está), Variables o Sinónimos, Nombre formularios WEB,
// Ruta JSON completa. Si el libro tiene la hoja «Lista de nombres PDF», arma también DIC_PDF con cada nombre
// AcroForm listo para usar. Reemplaza lo que está entre /*DIC:start*/ y /*DIC:end*/ (acepta también
// /*DIC:BEGIN*/ … /*DIC:END*/). Sin dependencias: solo Node (zlib + fs).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const [xlsxPath = "docs/diccionario_v10.xlsx", ...htmlArgs] = process.argv.slice(2);
/* por defecto, las páginas que usan el diccionario */
const htmlPaths = htmlArgs.length ? htmlArgs : ["index.html", "mapear.html", "interno.html"].filter(f => existsSync(f));
const SHEETS = ["Diccionario (Namirial)", "Diccionario General"];

/* ── zip mínimo: directorio central + inflate ── */
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("No es un .xlsx válido (zip sin directorio central)");
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = method === 8 ? inflateRawSync(raw) : raw;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ── XML mínimo ── */
const ent = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const texts = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => ent(m[1])).join("");
const colIdx = ref => [...ref.replace(/\d+/g, "")].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const files = unzip(readFileSync(xlsxPath));
const str = k => (files[k] ? files[k].toString("utf8") : "");
const shared = [...str("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
const wbXml = str("xl/workbook.xml"), rels = str("xl/_rels/workbook.xml.rels");
const sheetTags = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => m[0]);
const sheetRows = name => {
  const tag = sheetTags.find(t => ent((t.match(/name="([^"]*)"/) || [])[1] || "") === name);
  if (!tag) return null;
  const rid = tag.match(/r:id="([^"]+)"/)[1];
  const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`))[0].match(/Target="([^"]+)"/)[1];
  const xml = str("xl/" + target.replace(/^\/?xl\//, ""));
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m => {
    const out = [];
    for (const c of m[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], body = c[2] || "";
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const val = t === "s" ? shared[+v] : t === "inlineStr" ? texts(body) : v != null ? ent(v) : "";
      out[ref ? colIdx(ref) : out.length] = (val ?? "").trim();
    }
    return out;
  });
};
const SHEET = SHEETS.find(n => sheetRows(n));
if (!SHEET) throw new Error(`No encontré la hoja «${SHEETS.join("» ni «")}»`);
const rows = sheetRows(SHEET);

/* ── columnas por nombre de encabezado ── */
const head = rows[0].map(h => (h || "").toLowerCase());
const colOpt = name => head.findIndex(h => h.startsWith(name));
const col = name => { const i = colOpt(name); if (i < 0) throw new Error(`Falta la columna «${name}»`); return i };
const C = { paso: col("paso"), sec: col("sección"), vis: col("visible"), pdf: col("nombre del campo en el pdf"), acro: colOpt("nombre acroform"), syn: col("variables o sinónimos"), web: col("nombre formularios web"), ruta: col("ruta json completa") };
const noPdf = v => !v || /^no aplica$/i.test(v) || /no va en el pdf/i.test(v) || /^[—-]+$/.test(v);

const DIC = rows.slice(1).filter(r => r[C.web] && r[C.ruta]).map(r => {
  const web = r[C.web];
  const syn = (r[C.syn] || "").split(";").map(s => s.trim()).filter(Boolean);
  const pdf = r[C.pdf];
  if (!noPdf(pdf) && pdf !== web && !syn.includes(pdf)) syn.push(pdf);
  const acro = C.acro >= 0 && !noPdf(r[C.acro]) ? r[C.acro] : "";
  return [web, syn, r[C.paso], r[C.sec], r[C.ruta], /^s[ií]/i.test(r[C.vis]) ? 1 : 0, acro];
});

/* ── lista de nombres AcroForm listos (si la trae) ── */
let DIC_PDF = [];
const lst = sheetRows("Lista de nombres PDF");
if (lst) {
  const hi = lst.findIndex(r => (r[0] || "").toLowerCase().startsWith("nombre acroform"));
  if (hi >= 0) {
    const h = lst[hi].map(x => (x || "").toLowerCase());
    const k = n => h.findIndex(x => x.startsWith(n));
    const L = { n: 0, q: k("qué es"), t: k("tipo"), p: k("paso"), s: k("sección"), r: k("ruta json") };
    DIC_PDF = lst.slice(hi + 1).filter(r => r[L.n] && /^[a-z0-9_]+$/.test(r[L.n])).map(r => [r[L.n], r[L.q] || "", r[L.t] || "", r[L.p] || "", r[L.s] || "", r[L.r] || ""]);
  }
}

const re = /\/\*DIC:(?:start|BEGIN)\*\/[\s\S]*?\/\*DIC:(?:end|END)\*\//;
const block = `/*DIC:start*/\n/* Generado con tools/build_dic.mjs desde ${xlsxPath.split("/").pop()} (${DIC.length} campos, ${DIC_PDF.length} nombres de PDF). No editar a mano. */\n` +
  `/* [nombre web, sinónimos y nombre en el PDF, paso, sección, ruta JSON, visible (1) u oculto (0), nombre AcroForm (regla)] */\nconst DIC=[\n${DIC.map(d => JSON.stringify(d)).join(",\n")}\n];\n` +
  `/* [nombre AcroForm, qué es, tipo, paso, sección, ruta JSON] */\nconst DIC_PDF=[\n${DIC_PDF.map(d => JSON.stringify(d)).join(",\n")}\n];\n/*DIC:end*/`;
for (const htmlPath of htmlPaths) {
  const html = readFileSync(htmlPath, "utf8");
  if (!re.test(html)) throw new Error(`${htmlPath} no tiene los marcadores /*DIC:start*/ … /*DIC:end*/`);
  writeFileSync(htmlPath, html.replace(re, block));
  console.log(`${htmlPath}: DIC actualizado, ${DIC.length} campos (${DIC.filter(d => !d[5]).length} ocultos, ${DIC.filter(d => d[6]).length} con nombre AcroForm) y ${DIC_PDF.length} nombres de PDF, desde ${xlsxPath} (hoja «${SHEET}»)`);
}
