// Utilidades de la pestaña Probar de Signaframe Studio.

export const bare = (id) => (id.startsWith('field_') ? id.slice(6) : id);

/** El form-def puede venir suelto o envuelto (respuesta de la API, trabajo, etc.). */
export function unwrapFormDef(j) {
  if (j?.sections) return j;
  for (const c of [j?.formDefinition, j?.definition, j?.data?.jsonDefinition, j?.jsonDefinition, j?.data?.formDefinition]) {
    if (c?.sections) return c;
  }
  throw new Error('El JSON del formulario no parece un form-def: no tiene «sections».');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** JSON coloreado; las líneas que cambiaron desde `prev` quedan marcadas. */
export function jsonHtml(obj, prev) {
  const lines = JSON.stringify(obj, null, 2).split('\n');
  const before = prev ? new Set(JSON.stringify(prev, null, 2).split('\n')) : null;
  return lines
    .map((l) => {
      const h = escapeHtml(l)
        .replace(/&quot;(&lt;[^&]*?&gt;)&quot;/g, '"<span class="ss-ph">$1</span>"')
        .replace(/^(\s*)&quot;([^&]+?)&quot;:/, '$1"<span class="ss-key">$2</span>":');
      return before && !before.has(l) ? `<span class="ss-chg">${h}</span>` : h;
    })
    .join('\n');
}

/** Un valor corto para mostrar en una tabla. */
export function short(v) {
  if (v === undefined) return '—';
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

export const more = (list, n) => (list.length > n ? ` +${list.length - n}` : '');

// Los problemas del contrato (json-mapper) usan otra escala: se pasan a la del Revisor.
const FROM_CONTRACT = { critical: 'error', error: 'error', warning: 'aviso', info: 'nota' };

/** Junta los hallazgos del Revisor con los problemas del contrato que no son reglas del Revisor (R1…R26). */
export function revisorItems(hallazgos, analysis) {
  const items = hallazgos.map((h) => ({
    severidad: h.severidad, regla: h.regla, titulo: h.titulo, detalle: h.detalle, campos: h.campoIds || [],
  }));
  for (const i of analysis?.issues || []) {
    if (/^R\d+$/.test(i.type)) continue; // ya están arriba
    items.push({ severidad: FROM_CONTRACT[i.severity] || 'aviso', regla: 'JSON', titulo: i.path || 'Rutas del JSON', detalle: i.detail, campos: i.fields || [] });
  }
  const rank = { error: 0, aviso: 1, nota: 2 };
  return items.sort((a, b) => (rank[a.severidad] ?? 3) - (rank[b.severidad] ?? 3));
}
