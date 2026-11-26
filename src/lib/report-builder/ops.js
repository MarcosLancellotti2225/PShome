// Operaciones de Reportes (← Presentations, «Report Builder»): rellenar vacíos, mapear
// columnas, cruzar hojas, filtrar filas y armar el resumen. Misma lógica que el original;
// acá son funciones puras que devuelven filas nuevas (no tocan las que reciben).

const str = (v) => String(v ?? '').trim();
const num = (v) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));

// Nombres de las columnas que agrega «Cruzar hojas».
export const MATCH_COLS = { count: 'Contactos', last: 'Último contacto', first: 'Primer contacto' };

// ── Fechas ──────────────────────────────────────────────────────────────────

/** dd/mm/aaaa, aaaa-mm-dd o lo que entienda Date. Ante la duda, día primero (como el original). */
export function parseDate(s) {
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : s;
  const t = str(s);
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) return new Date(y, b - 1, a);
    if (b > 12) return new Date(y, a - 1, b);
    return new Date(y, b - 1, a);
  }
  m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(d) {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Columna de fecha: por nombre (date, fecha, created…) o por contenido. '' si no hay. */
export function detectDateCol(headers, rows) {
  const byName = headers.find((h) => /date|fecha|created|modified|last.*activity/i.test(h));
  if (byName) return byName;
  for (const h of headers) {
    const sample = rows.slice(0, 5).map((r) => str(r[h]));
    if (sample.filter((v) => /\d{2}[/-]\d{2}[/-]\d{2,4}/.test(v)).length >= 3) return h;
  }
  return '';
}

/** Filas entre dos fechas (aaaa-mm-dd, inclusive). Las filas sin fecha se mantienen. */
export function filterByDate(rows, dateCol, from, to) {
  if (!dateCol || (!from && !to)) return rows;
  const f = from ? parseDate(from) : null;
  const t = to ? parseDate(to) : null;
  return rows.filter((r) => {
    const d = parseDate(r[dateCol]);
    if (!d) return true;
    if (f && d < f) return false;
    if (t && d > t) return false;
    return true;
  });
}

// ── Orden y búsqueda ────────────────────────────────────────────────────────

export function sortRows(rows, col, asc = true) {
  return [...rows].sort((a, b) => {
    const na = num(a[col]);
    const nb = num(b[col]);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return asc ? na - nb : nb - na;
    const va = str(a[col]).toLowerCase();
    const vb = str(b[col]).toLowerCase();
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}

export function searchRows(rows, cols, text) {
  const q = str(text).toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => cols.some((c) => str(r[c]).toLowerCase().includes(q)));
}

export function distinctValues(rows, col) {
  const seen = new Map();
  for (const r of rows) {
    const v = str(r[col]) || '(vacío)';
    seen.set(v, (seen.get(v) || 0) + 1);
  }
  return [...seen.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
}

// ── Rellenar vacíos ─────────────────────────────────────────────────────────

/**
 * Por columna: cuántas celdas vacías tiene y si siguen el patrón de Salesforce
 * (el valor del grupo solo en la primera fila). `recommended` = conviene rellenarla.
 */
export function emptyStats(rows, headers) {
  return headers.map((col) => {
    let empty = 0;
    let gap = false;
    let last = '';
    for (const r of rows) {
      const v = str(r[col]);
      if (v === '') { empty++; if (last !== '') gap = true; } else last = v;
    }
    const pctEmpty = rows.length ? Math.round((empty / rows.length) * 100) : 0;
    return { col, empty, pctEmpty, hasGap: gap, recommended: gap && pctEmpty > 10 && pctEmpty < 95 };
  });
}

/** Copia hacia abajo el último valor no vacío. → { rows, changes: [{ row, col, to }] } */
export function fillDown(rows, cols) {
  const out = rows.map((r) => ({ ...r }));
  const changes = [];
  for (const col of cols) {
    let last = '';
    out.forEach((r, i) => {
      const cur = str(r[col]);
      if (cur !== '') last = cur;
      else if (last !== '') { r[col] = last; changes.push({ row: i, col, to: last }); }
    });
  }
  return { rows: out, changes };
}

/**
 * Si `target` está vacío, lo completa con `source`:
 *  - mode 'same-row': el valor de `source` de la misma fila.
 *  - mode 'lookup': busca en otras filas qué `target` tiene ese mismo `source`.
 * → { rows, changes: [{ row, source, value }], remaining, unmapped: [{ value, count }] }
 */
export function mapColumn(rows, target, source, mode = 'same-row') {
  if (!target || !source) throw new Error('Elegí las dos columnas.');
  if (target === source) throw new Error('Las columnas tienen que ser distintas.');
  const out = rows.map((r) => ({ ...r }));
  const changes = [];
  let lookup = null;
  if (mode === 'lookup') {
    lookup = new Map();
    for (const r of out) {
      const s = str(r[source]);
      const t = str(r[target]);
      if (s && t) lookup.set(s.toLowerCase(), t);
    }
    if (!lookup.size) throw new Error(`No hay filas que tengan «${source}» y «${target}» completas para aprender de dónde copiar.`);
  }
  out.forEach((r, i) => {
    if (str(r[target]) !== '') return;
    const s = str(r[source]);
    if (!s) return;
    const value = lookup ? lookup.get(s.toLowerCase()) : s;
    if (!value) return;
    r[target] = value;
    changes.push({ row: i, source: s, value });
  });
  const pending = new Map();
  for (const r of out) {
    if (str(r[target]) === '' && str(r[source]) !== '') {
      const s = str(r[source]);
      pending.set(s, (pending.get(s) || 0) + 1);
    }
  }
  const unmapped = [...pending.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
  return { rows: out, changes, remaining: unmapped.reduce((n, u) => n + u.count, 0), unmapped };
}

// ── Filtrar filas por coincidencia ──────────────────────────────────────────

/**
 * mode 'neq': borra las filas donde A ≠ B (quedan las que coinciden).
 * mode 'eq' : borra las filas donde A = B.
 * → { rows (las que quedan), removed, examples: [{ row, a, b }] }
 */
export function filterRowsByMatch(rows, { colA, colB, mode = 'neq', ignoreCase = true, ignoreEmpty = false }) {
  if (!colA || !colB || colA === colB) throw new Error('Elegí dos columnas distintas.');
  const keep = [];
  const examples = [];
  let removed = 0;
  rows.forEach((r, i) => {
    const a = str(r[colA]);
    const b = str(r[colB]);
    if (ignoreEmpty && (a === '' || b === '')) { keep.push(r); return; }
    const same = ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;
    const drop = mode === 'neq' ? !same : same;
    if (drop) {
      removed++;
      if (examples.length < 5) examples.push({ row: i + 1, a: a || '(vacío)', b: b || '(vacío)' });
    } else keep.push(r);
  });
  return { rows: keep, removed, examples };
}

// ── Cruzar hojas ────────────────────────────────────────────────────────────

/**
 * Para cada fila de la hoja activa, busca las filas de la otra hoja con la misma clave
 * (sin importar mayúsculas) y agrega cuántas hay y la primera / última fecha.
 *
 * opts: { keyA, keyB, sameA, sameB, count, first, last, dateCol, from, to }
 *  - sameA / sameB: columnas de la OTRA hoja que tienen que coincidir para contar la fila
 *    (ej. «Customer Success Manager» = «Owner Name»: solo los contactos que hizo el CSM).
 *  - from / to: solo cuenta filas de la otra hoja entre esas fechas (aaaa-mm-dd).
 * → { rows, newCols, matched }
 */
export function crossSheets(rows, otherRows, opts) {
  const { keyA, keyB, sameA, sameB, count = true, first = false, last = false, from, to } = opts;
  if (!keyA || !keyB) throw new Error('Elegí la columna clave de cada hoja.');
  const dateCol = opts.dateCol ?? '';
  const source = filterByDate(otherRows, dateCol, from, to);
  const lookup = new Map();
  for (const r of source) {
    const k = str(r[keyB]).toLowerCase();
    if (!k) continue;
    if (sameA && sameB && str(r[sameA]).toLowerCase() !== str(r[sameB]).toLowerCase()) continue;
    if (!lookup.has(k)) lookup.set(k, []);
    lookup.get(k).push(r);
  }
  const newCols = [];
  if (count) newCols.push(MATCH_COLS.count);
  if (last && dateCol) newCols.push(MATCH_COLS.last);
  if (first && dateCol) newCols.push(MATCH_COLS.first);

  let matched = 0;
  const out = rows.map((r) => {
    const nr = { ...r };
    const hits = lookup.get(str(r[keyA]).toLowerCase()) || [];
    if (hits.length) matched++;
    if (count) nr[MATCH_COLS.count] = hits.length;
    if (dateCol && (first || last)) {
      const dates = hits.map((h) => parseDate(h[dateCol])).filter(Boolean).sort((a, b) => a - b);
      if (first) nr[MATCH_COLS.first] = dates.length ? formatDate(dates[0]) : '';
      if (last) nr[MATCH_COLS.last] = dates.length ? formatDate(dates[dates.length - 1]) : '';
    }
    return nr;
  });
  return { rows: out, newCols, matched };
}

// ── Resumen ─────────────────────────────────────────────────────────────────

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Agrupa y cuenta (ej. por CSM: cuántas cuentas, cuántas contactadas y el %).
 *
 * opts: { groupBy, countCol, contactCol?, threshold = 1, sumCol?, label?(col) }
 *  - countCol: se cuentan los valores distintos (ej. Parent Account).
 *  - contactCol: numérica; una cuenta está contactada si alguna de sus filas llega al umbral.
 *  - sumCol: se suma (ej. Active MRR).
 * → { groups: [{ key, total, contacted, pending, pct, sum, rows }], totals, table, columns }
 *   `table` son las filas del resumen como en el original (la última es TOTAL).
 */
export function summarize(rows, opts) {
  const { groupBy, countCol, contactCol, sumCol } = opts;
  const threshold = Number.isFinite(Number(opts.threshold)) && String(opts.threshold) !== '' ? Number(opts.threshold) : 1;
  const label = opts.label || ((c) => c);
  if (!groupBy || !countCol) throw new Error('Elegí por qué agrupar y qué contar.');

  const byKey = new Map();
  for (const r of rows) {
    const k = str(r[groupBy]) || '(vacío)';
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }

  const groups = [...byKey.entries()].map(([key, gRows]) => {
    const uniques = new Set();
    const contacted = new Set();
    let sum = 0;
    for (const r of gRows) {
      const v = str(r[countCol]);
      if (v) uniques.add(v);
      if (contactCol && v) {
        const cv = num(r[contactCol] || '0');
        if (cv >= threshold) contacted.add(v);
      }
      if (sumCol) sum += num(r[sumCol]) || 0;
    }
    const total = uniques.size;
    return {
      key, total, contacted: contacted.size, pending: total - contacted.size,
      pct: total ? round1((contacted.size / total) * 100) : 0, sum: round2(sum), rows: gRows,
    };
  });

  const t = groups.reduce((a, g) => ({ total: a.total + g.total, contacted: a.contacted + g.contacted, sum: a.sum + g.sum }), { total: 0, contacted: 0, sum: 0 });
  const totals = { key: 'TOTAL', total: t.total, contacted: t.contacted, pending: t.total - t.contacted, pct: t.total ? round1((t.contacted / t.total) * 100) : 0, sum: round2(t.sum), rows: rows.length };

  const cols = {
    group: label(groupBy),
    total: `Total ${label(countCol)}`,
    contacted: `Contactadas (>=${threshold})`,
    pending: 'Sin contactar',
    pct: '% Contactadas',
    sum: sumCol ? `Suma ${label(sumCol)}` : null,
    rows: 'Filas',
  };
  const toRow = (g, nRows) => {
    const o = { [cols.group]: g.key, [cols.total]: g.total };
    if (contactCol) {
      o[cols.contacted] = g.contacted;
      o[cols.pending] = g.pending;
      o[cols.pct] = `${g.pct}%`;
    }
    if (sumCol) o[cols.sum] = g.sum;
    o[cols.rows] = nRows;
    return o;
  };
  const table = [...groups.map((g) => toRow(g, g.rows.length)), toRow(totals, totals.rows)];
  return { groups, totals, table, columns: Object.keys(table[0]), cols, threshold, opts: { ...opts, threshold } };
}

/**
 * Detalle por grupo y por cuenta, para el reporte: contactos (suma de sus filas, ej. sucursales),
 * último contacto, suma y si está contactada. Primero las sin contactar, de mayor a menor suma.
 */
export function accountDetail(summary, { lastCol } = {}) {
  const { countCol, contactCol, sumCol } = summary.opts;
  const threshold = summary.threshold;
  return summary.groups.map((g) => {
    const acc = new Map();
    for (const r of g.rows) {
      const name = str(r[countCol]);
      if (!name) continue;
      const a = acc.get(name) || { name, contacts: 0, last: null, sum: 0, contacted: false };
      if (contactCol) {
        const cv = num(r[contactCol] || '0') || 0;
        a.contacts += cv;
        if (cv >= threshold) a.contacted = true;
      }
      if (lastCol) {
        const d = parseDate(r[lastCol]);
        if (d && (!a.last || d > a.last)) a.last = d;
      }
      if (sumCol) a.sum += num(r[sumCol]) || 0;
      acc.set(name, a);
    }
    const accounts = [...acc.values()]
      .map((a) => ({ ...a, sum: round2(a.sum), last: a.last ? formatDate(a.last) : '' }))
      .sort((a, b) => (a.contacted - b.contacted) || (b.sum - a.sum) || a.name.localeCompare(b.name));
    return { key: g.key, accounts };
  });
}

// ── Detección de columnas (para proponer valores por defecto) ───────────────

export function guessCol(headers, re, fallback = '') {
  return headers.find((h) => re.test(h)) ?? fallback;
}

export const GUESS = {
  account: /account.*name|cuenta/i,
  csm: /customer success|csm|owner/i,
  countCol: /account.*name|parent|cuenta/i,
  contact: /match|contact|email|count/i,
  sum: /mrr|revenue|amount|monto/i,
  csmFull: /customer success|csm.*full/i,
  owner: /owner.*name/i,
};
