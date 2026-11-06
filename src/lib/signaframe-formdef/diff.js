/**
 * Qué cambia entre dos form-defs (el que está en Signaframe y el que se va a subir).
 * Sirve para mostrar el cambio antes de confirmarlo y para frenar si se rompe la
 * REGLA DE ORO: un campo del PDF (con sourceMeta.sourceName) que cambió de id,
 * perdió su sourceMeta o desapareció.
 */
import { allFields } from './build.js';

const sourceName = (f) => f?.sourceMeta?.sourceName || null;
const IGNORE = new Set(['order']);

// Para comparar: sin importar el orden de las claves, y false / null / '' / [] / ausente cuentan igual.
const empty = (v) => v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && !v.length);
function canon(v) {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v).sort()) if (!empty(v[k])) o[k] = canon(v[k]);
        return o;
    }
    return v;
}
const same = (a, b) => (empty(a) && empty(b)) || JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function changedKeys(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].filter((k) => !IGNORE.has(k) && !same(a[k], b[k])).sort();
}

/**
 * @returns {{agregados: string[], quitados: string[], cambiados: Array<{id, claves: string[]}>, porPropiedad: object,
 *   secciones: {agregadas: string[], quitadas: string[]}, reglaDeOro: string[], iguales: boolean}}
 */
export function diffFormDefs(before, after) {
    const A = new Map(allFields(before?.sections || []).map((f) => [f.id, f]));
    const B = new Map(allFields(after?.sections || []).map((f) => [f.id, f]));
    const agregados = [...B.keys()].filter((id) => !A.has(id));
    const quitados = [...A.keys()].filter((id) => !B.has(id));
    const cambiados = [];
    for (const [id, a] of A) {
        const b = B.get(id);
        if (!b) continue;
        const claves = changedKeys(a, b);
        if (claves.length) cambiados.push({ id, claves });
    }
    const secA = new Set((before?.sections || []).map((s) => s.id));
    const secB = new Set((after?.sections || []).map((s) => s.id));
    const secciones = { agregadas: [...secB].filter((x) => !secA.has(x)), quitadas: [...secA].filter((x) => !secB.has(x)) };

    // Regla de oro: cada casillero del PDF que estaba tiene que seguir con el mismo id y el mismo sourceMeta.
    const reglaDeOro = [];
    const bByName = new Map([...B.values()].filter(sourceName).map((f) => [sourceName(f), f]));
    for (const a of A.values()) {
        const n = sourceName(a);
        if (!n) continue;
        const b = bByName.get(n);
        if (!b) { reglaDeOro.push(`El casillero ${n} (${a.id}) ya no está en el form-def`); continue; }
        if (b.id !== a.id) reglaDeOro.push(`El casillero ${n} cambió de id: ${a.id} → ${b.id}`);
        else if (!same(a.sourceMeta, b.sourceMeta)) reglaDeOro.push(`Cambió el sourceMeta de ${a.id} (${n})`);
    }
    // Cuántos campos cambian cada propiedad: { label: 3, prefillMode: 115 }.
    const porPropiedad = {};
    for (const c of cambiados) for (const k of c.claves) porPropiedad[k] = (porPropiedad[k] || 0) + 1;
    const iguales = !agregados.length && !quitados.length && !cambiados.length && !secciones.agregadas.length && !secciones.quitadas.length
        && JSON.stringify((before?.sections || []).map((s) => s.id)) === JSON.stringify((after?.sections || []).map((s) => s.id));
    return { agregados, quitados, cambiados, porPropiedad, secciones, reglaDeOro, iguales };
}
