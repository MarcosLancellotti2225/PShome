// Probar JSON: el JSON que generamos contra el que mandó el cliente, valor por valor.
// Sin React ni DOM: se usa igual desde la app, los tests y el MCP.
import { leafPaths } from '../signaframe-engine/simulate.js';

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'lista' : typeof v === 'object' ? 'objeto' : typeof v);

export const JSON_STATUS = {
  igual: 'Igual',
  distinto: 'Otro valor',
  tipo: 'Otro tipo',
  falta: 'Falta',
  sobra: 'Sobra',
};

/**
 * Compara dos JSON hoja por hoja (ruta completa, con índices de listas).
 * - falta:    el cliente lo tiene y nosotros no lo generamos.
 * - sobra:    lo generamos y el cliente no lo tiene.
 * - tipo:     está en los dos con otro tipo (ej. "12" contra 12).
 * - distinto: mismo tipo, otro valor.
 * Devuelve { rows, counts, identical } con las filas en el orden del cliente y después las que sobran.
 */
export function compareJson(ours, client) {
  const mine = new Map(leafPaths(ours ?? {}).map((x) => [x.path, x.value]));
  const theirs = leafPaths(client ?? {});
  const rows = [];
  for (const { path, value } of theirs) {
    if (!mine.has(path)) { rows.push({ path, status: 'falta', client: value }); continue; }
    const v = mine.get(path);
    let status = 'igual';
    if (kindOf(v) !== kindOf(value)) status = 'tipo';
    else if (JSON.stringify(v) !== JSON.stringify(value)) status = 'distinto';
    rows.push({ path, status, ours: v, client: value });
  }
  const seen = new Set(theirs.map((x) => x.path));
  for (const [path, value] of mine) if (!seen.has(path)) rows.push({ path, status: 'sobra', ours: value });
  const counts = Object.fromEntries(Object.keys(JSON_STATUS).map((k) => [k, 0]));
  for (const r of rows) counts[r.status]++;
  return { rows, counts, identical: rows.every((r) => r.status === 'igual') };
}
