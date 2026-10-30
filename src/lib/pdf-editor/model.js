// Modelo del Editor PDF: un campo por widget detectado, con su estado original y el editado.
// La «clave» de cada campo es la misma que usa el motor de reescritura (rewriter.js):
//   widget de un grupo  → nombre#índiceDeWidget
//   nombre repetido     → nombre#índiceDeRepetición
//   resto               → nombre
// Todo es puro (sin DOM): se puede probar con Node.

const TYPE_NAMES = { text: 'Texto', checkbox: 'Casilla', radio: 'Radio', dropdown: 'Lista', listbox: 'Lista', choice: 'Lista', button: 'Botón', pushbutton: 'Botón', signature: 'Firma', unknown: 'Otro' };
// El detector devuelve los tipos con mayúscula («Text», «Checkbox»…): se comparan en minúscula.
export const typeLabel = (type) => TYPE_NAMES[String(type || '').toLowerCase()] || type;
export const isTextField = (f) => /^text$/i.test(f.type);

export const FT_OPTIONS = [
  { value: 'Tx', label: 'Texto' },
  { value: 'Btn', label: 'Casilla / botón' },
  { value: 'Ch', label: 'Lista' },
];

export function fieldKey(f) {
  if (f._isWidget) return `${f.name}#${f._widgetIndex}`;
  if (f._dupCount > 1) return `${f.name}#${f._dupIndex}`;
  return f.name;
}

// Campos detectados → campos editables.
export function fromDetected(detected, fontInfo = {}) {
  return detected.map((f) => {
    const font = fontInfo[f.name];
    const base = {
      name: f.name,
      type: f.type,
      page: f.page,
      x: f.x, y: f.y, width: f.width, height: f.height,
      fontSize: font ? font.size : null, // null = no se sabe / no es texto; 0 = auto
      comb: font ? font.comb : false,
      multiline: null,
      ft: null,
    };
    return {
      key: fieldKey(f),
      group: f._isWidget ? f._widgetCount : 0,
      isNew: false,
      deleted: false,
      orig: base,
      ...base,
    };
  });
}

let newCounter = 0;
export function newField({ page, x, y, width, height, existingNames }) {
  let name;
  do { newCounter += 1; name = `campo_nuevo_${newCounter}`; } while (existingNames.has(name));
  const base = { name, type: 'text', page, x, y, width, height, fontSize: 10, comb: false, multiline: null, ft: null };
  return { key: `__nuevo_${Date.now()}_${newCounter}`, group: 0, isNew: true, deleted: false, orig: { ...base }, ...base };
}

export const isRenamed = (f) => !f.isNew && f.name !== f.orig.name;
export const isMoved = (f) => !f.isNew && (f.x !== f.orig.x || f.y !== f.orig.y || f.width !== f.orig.width || f.height !== f.orig.height);
export const isPropChanged = (f) => !f.isNew && (f.fontSize !== f.orig.fontSize || f.multiline !== f.orig.multiline);
export const isTypeChanged = (f) => !f.isNew && f.ft && f.ft !== f.orig.ft;
export const isChanged = (f) => f.isNew || f.deleted || isRenamed(f) || isMoved(f) || isPropChanged(f) || isTypeChanged(f);

// Problemas de nombres. Los widgets de un mismo grupo (radios) comparten nombre a propósito.
// Repetidos y vacíos se marcan siempre; espacios y caracteres raros, solo en nombres editados o nuevos.
const NAME_OK = /^[A-Za-z0-9_\-[\]]+$/;
export function validate(fields) {
  const problems = new Map(); // key → [mensajes]
  const add = (k, m) => problems.set(k, [...(problems.get(k) || []), m]);
  const byName = new Map();
  for (const f of fields) {
    if (f.deleted) continue;
    const n = f.name.trim();
    if (!n) { add(f.key, 'Sin nombre'); continue; }
    // El estilo del nombre se revisa solo en lo que tocaste: los nombres crudos del PDF
    // («Check Box12») no son un error, son lo que falta renombrar.
    const touched = f.isNew || n !== f.orig.name;
    if (!touched) { /* sin revisar estilo */ } else if (/\s/.test(n)) add(f.key, 'Tiene espacios');
    else if (n.includes('.')) add(f.key, 'Tiene puntos (el PDF los toma como jerarquía)');
    else if (!NAME_OK.test(n)) add(f.key, 'Tiene caracteres raros (usá letras, números y _)');
    if (f.width < 2 || f.height < 2) add(f.key, 'La caja es demasiado chica');
    const groupId = f.group ? f.orig.name : null;
    if (!byName.has(n)) byName.set(n, new Set());
    byName.get(n).add(groupId ?? f.key);
  }
  for (const f of fields) {
    if (f.deleted) continue;
    const owners = byName.get(f.name.trim());
    if (owners && owners.size > 1) add(f.key, 'Nombre repetido con otro campo');
  }
  return problems;
}

// Estado editado → parámetros del motor de reescritura.
export function buildEdits(fields) {
  const renameMap = [];
  const deleteNames = [];
  const moveMap = [];
  const typeChanges = [];
  const propChanges = [];
  const newFields = [];
  for (const f of fields) {
    if (f.isNew) {
      if (!f.deleted) newFields.push({ name: f.name.trim(), page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, fontSize: f.fontSize, multiline: f.multiline });
      continue;
    }
    if (f.deleted) { deleteNames.push(f.key); continue; }
    if (isRenamed(f)) renameMap.push({ oldName: f.key, newName: f.name.trim() });
    if (isMoved(f)) moveMap.push({ fieldName: f.key, x: f.x, y: f.y, width: f.width, height: f.height });
    if (isTypeChanged(f)) typeChanges.push({ fieldName: f.key, ftCode: f.ft });
    if (isPropChanged(f)) {
      const p = { fieldName: f.key };
      if (f.fontSize !== f.orig.fontSize && f.fontSize !== null) p.fontSize = f.fontSize;
      if (f.multiline !== f.orig.multiline && f.multiline !== null) p.multiline = f.multiline;
      propChanges.push(p);
    }
  }
  return { renameMap, deleteNames, moveMap, typeChanges, propChanges, newFields };
}

export function summarize(fields) {
  const s = { total: 0, renamed: 0, deleted: 0, added: 0, moved: 0, props: 0 };
  for (const f of fields) {
    if (f.isNew) { if (!f.deleted) s.added += 1; continue; }
    s.total += 1;
    if (f.deleted) { s.deleted += 1; continue; }
    if (isRenamed(f)) s.renamed += 1;
    if (isMoved(f)) s.moved += 1;
    if (isPropChanged(f) || isTypeChanged(f)) s.props += 1;
  }
  return s;
}

// ── Edición en bloque (texto con TAB) ───────────────────────────────────────
export function toBulkText(fields) {
  return fields.filter((f) => !f.isNew).map((f) => `${f.orig.name}\t${f.name}`).join('\n');
}

// Devuelve [{ oldName, newName }] a partir del texto pegado (TAB, ; o , como separador).
export function parseBulkText(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\t|;|,/).map((p) => p.trim());
    return { oldName: parts[0], newName: parts[1] || '' };
  }).filter((e) => e.oldName);
}

// ── Cruce Excel → PDF (mismo criterio que Convertir PDF) ───────────────────
export function normalizeFieldName(name) {
  return String(name || '').toLowerCase()
    .replace(/[\s._-]+/g, '')
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[b.length][a.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
}

// Para cada campo del PDF busca su fila del Excel: exacto, normalizado o parecido (≥ 70 %).
// Mismo criterio que Convertir PDF, con dos arreglos:
//  - cada fila del Excel se usa una sola vez y gana la mejor coincidencia (antes una fila podía
//    renombrar varios campos y quedaban nombres repetidos);
//  - nombres que solo difieren en los números («Text20» / «Text21») no cuentan como parecidos.
// Devuelve Map(clave del campo → { newName, matchType, score, excelName }).
const lettersOnly = (s) => s.replace(/[0-9]+/g, '');
export function matchExcelToFields(entries, fields) {
  const candidates = [];
  const pdfFields = fields.filter((f) => !f.isNew);
  entries.forEach((ex, ei) => {
    if (!ex.newName) return;
    const exNorm = normalizeFieldName(ex.oldName);
    for (const f of pdfFields) {
      const pdfName = f.orig.name;
      const pdfNorm = normalizeFieldName(pdfName);
      if (ex.oldName === pdfName) { candidates.push({ f, ei, ex, score: 1, type: 'exacto' }); continue; }
      if (exNorm === pdfNorm) { candidates.push({ f, ei, ex, score: 0.95, type: 'normalizado' }); continue; }
      if (lettersOnly(exNorm) === lettersOnly(pdfNorm)) continue; // solo cambian los números
      const sim = similarity(exNorm, pdfNorm);
      if (sim >= 0.7) candidates.push({ f, ei, ex, score: sim, type: 'parecido' });
    }
  });
  candidates.sort((a, b) => b.score - a.score);
  const out = new Map();
  const usedRows = new Set();
  // Los widgets de un mismo grupo (radios) comparten fila: se renombran juntos.
  const groupOf = (f) => (f.group ? `g:${f.orig.name}` : `k:${f.key}`);
  const rowGroup = new Map();
  for (const c of candidates) {
    const g = groupOf(c.f);
    if (out.has(c.f.key)) continue;
    if (usedRows.has(c.ei) && rowGroup.get(c.ei) !== g) continue;
    if ([...rowGroup.values()].includes(g) && rowGroup.get(c.ei) !== g) continue;
    usedRows.add(c.ei);
    rowGroup.set(c.ei, g);
    out.set(c.f.key, { newName: c.ex.newName, matchType: c.type, score: c.score, excelName: c.ex.oldName });
  }
  return out;
}
