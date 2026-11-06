/**
 * Arma el form-def de Signaframe (el JSON que se sube) desde la matriz interna.
 *
 * Es el último tramo del circuito: Ficha → Matriz interna → **JSON del formulario**.
 * La matriz ya trae los pasos, subsecciones y campos con sus propiedades; acá se
 * agrega lo que sale del main de Signaframe y lo que se deriva:
 *   - `sourceMeta` de cada campo con «Casillero PDF», copiado tal cual del main
 *     (REGLA DE ORO: el id y el sourceMeta de los campos del PDF no se tocan);
 *   - `order` (1, 2, 3… dentro de cada contenedor) y `childrenOrder`;
 *   - `salidaJSON` = `jsonOutputPath`;
 *   - `prefillMode: "optional"` cuando hay `prefillKey`;
 *   - los casilleros del main que la matriz no usa van ocultos en una sección
 *     «Campos del PDF sin usar», para no perder ninguno.
 *
 * Todo puro (sin DOM): se prueba con Node (test/signaframe-formdef.test.mjs).
 */

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const yes = (v) => /^(s[ií]|si|true|x|1)$/i.test(String(v ?? '').trim());
const txt = (v) => String(v ?? '').trim();

function parseJson(text, where, warn) {
    const t = txt(text);
    if (!t) return null;
    try { return JSON.parse(t); } catch {
        warn.push(`${where}: no es un JSON válido («${t.slice(0, 60)}»). Se ignora.`);
        return null;
    }
}

// ─── El main de Signaframe ───────────────────────────────────────────────────

/** Todos los campos del main (secciones, subsecciones y repeaters), aplanados. */
export function mainFields(main) {
    const out = [];
    const walk = (fields) => (fields || []).forEach((f) => {
        out.push(f);
        if (Array.isArray(f.fields)) walk(f.fields);
        if (Array.isArray(f.subFields)) walk(f.subFields);
    });
    for (const s of main?.sections || []) {
        walk(s.fields);
        for (const sub of s.subsections || []) walk(sub.fields);
    }
    return out;
}

/** Índice sourceName → campo del main (con y sin mayúsculas). */
function indexMain(main) {
    const exact = new Map();
    const lower = new Map();
    for (const f of mainFields(main)) {
        const n = f.sourceMeta && f.sourceMeta.sourceName;
        if (!n) continue;
        if (!exact.has(n)) exact.set(n, f);
        if (!lower.has(n.toLowerCase())) lower.set(n.toLowerCase(), f);
    }
    return { exact, lower };
}

// ─── Filas de la matriz → estructura ─────────────────────────────────────────

/**
 * Convierte las filas de la hoja «Formulario Signaframe» (objetos columna → valor)
 * y las de «Opciones» en pasos / subsecciones / campos.
 * @param {Array<object>} rows - una por fila, con las columnas de la matriz interna
 * @param {Array<object>} optionRows - filas de la hoja Opciones
 */
export function matrixFromRows(rows, optionRows = []) {
    const warn = [];
    const optsById = new Map();
    for (const o of optionRows) {
        const id = txt(o['id del campo']);
        if (!id) continue;
        const opt = { label: txt(o['Etiqueta']) };
        const pdf = o['Valor PDF'];
        const json = o['Valor JSON'];
        const rest = parseJson(o['Otras propiedades'], `Opción de ${id}`, warn);
        // Signaframe guarda pdfValue siempre (vacío si la opción no pinta un casillero),
        // salvo en el formato viejo de opciones { value, label }.
        if (txt(pdf) !== '' || !(isObj(rest) && 'value' in rest)) opt.pdfValue = typeof pdf === 'number' ? pdf : txt(pdf);
        if (txt(json) !== '') opt.jsonValue = typeof json === 'number' ? String(json) : txt(json);
        const dep = txt(o['Depende de (parentValues)']);
        if (dep) opt.parentValues = dep === '(vacío)' ? '' : dep;
        if (isObj(rest)) Object.assign(opt, rest);
        const list = optsById.get(id) || [];
        list.push({ order: Number(o['Orden']) || list.length + 1, opt });
        optsById.set(id, list);
    }

    const steps = [];
    let step = null;
    let sub = null;
    rows.forEach((r, i) => {
        const nivel = txt(r['Nivel']).toLowerCase();
        const id = txt(r['id']);
        const where = `Fila ${i + 1}${id ? ` (${id})` : ''}`;
        if (nivel === 'paso') {
            step = { id, title: txt(r['Etiqueta']), hidden: yes(r['Oculto']), subs: [], fields: [] };
            const extra = parseJson(r['Otras propiedades'], where, warn);
            if (isObj(extra)) Object.assign(step, { extra });
            steps.push(step);
            sub = null;
        } else if (nivel === 'subsección' || nivel === 'subseccion') {
            if (!step) { warn.push(`${where}: subsección antes de cualquier paso. Se ignora.`); return; }
            sub = { id, title: txt(r['Etiqueta']), hidden: yes(r['Oculto']), cond: txt(r['Se muestra si']) || null, fields: [] };
            const extra = parseJson(r['Otras propiedades'], where, warn);
            if (isObj(extra)) sub.extra = extra;
            step.subs.push(sub);
        } else if (nivel === 'campo') {
            if (!step) { warn.push(`${where}: campo antes de cualquier paso. Se ignora.`); return; }
            if (!id) { warn.push(`${where}: campo sin id. Se ignora.`); return; }
            const f = { id, type: txt(r['Tipo']) || 'text', label: txt(r['Etiqueta']) };
            if (txt(r['Pregunta del grupo'])) f.radioGroupLabel = txt(r['Pregunta del grupo']);
            f.required = yes(r['Obligatorio']);
            f.readOnly = yes(r['Solo lectura']);
            if (yes(r['Oculto'])) f.hidden = true;
            if (txt(r['Ancho'])) f.width = txt(r['Ancho']);
            if (txt(r['Ruta JSON'])) f.jsonOutputPath = txt(r['Ruta JSON']);
            if (txt(r['Prellenado desde'])) f.prefillKey = txt(r['Prellenado desde']);
            if (yes(r['Excluir del JSON'])) f.excludeFromJson = true;
            if (txt(r['Se muestra si'])) f.conditionalVisibility = txt(r['Se muestra si']);
            const concat = parseJson(r['Se arma con'], `${where} «Se arma con»`, warn);
            if (concat) f.autoFillConcat = concat;
            const opts = optsById.get(id);
            if (opts) f.options = opts.sort((a, b) => a.order - b.order).map((x) => x.opt);
            const extra = parseJson(r['Otras propiedades'], `${where} «Otras propiedades»`, warn);
            if (isObj(extra)) Object.assign(f, extra);
            if (txt(r['Casillero PDF'])) f._box = txt(r['Casillero PDF']);
            (sub || step).fields.push(f);
        }
        // «Fuera» y filas vacías: no van al formulario.
    });
    return { steps, warn };
}

// ─── Estructura → form-def ───────────────────────────────────────────────────

const SIN_USAR_ID = 'sec_campos_pdf_sin_usar';

/**
 * @param {{steps: Array}} matrix - de matrixFromRows (o el modelo de la Matriz interna)
 * @param {object|null} main - export de Signaframe con el PDF importado
 * @param {{version?: string}} [opts]
 * @returns {{formDef: object, report: object}}
 */
export function buildFormDef(matrix, main, opts = {}) {
    const report = {
        warn: [...(matrix.warn || [])],
        sinCasillero: [],   // «Casillero PDF» que no está en el main
        idCorregido: [],    // el id de la matriz no era el del main: se usa el del main
        sinUsar: [],        // casilleros del main que la matriz no usa
        firmasSinUbicar: [], // firmas sin posición en el PDF: hay que ubicarlas en Signaframe
        repetidos: [],      // ids duplicados
        campos: 0,
        pasos: 0,
    };
    const idx = main ? indexMain(main) : null;
    // Firmas ya ubicadas en el main (sourceMeta sin casillero, con página y rect).
    const mainSign = new Map(mainFields(main).filter((f) => f.type === 'signature' && f.sourceMeta).map((f) => [f.id, f.sourceMeta]));
    const lastPage = main?._sourcePdf?.pageCount || 1;
    const usedBoxes = new Set();
    const renames = new Map();

    const fieldOut = (src) => {
        const f = {};
        for (const [k, v] of Object.entries(src)) if (!k.startsWith('_') && v !== undefined) f[k] = clone(v);
        if (src._box) {
            const m = idx ? (idx.exact.get(src._box) || idx.lower.get(src._box.toLowerCase())) : null;
            if (m) {
                f.sourceMeta = clone(m.sourceMeta);
                usedBoxes.add(m.sourceMeta.sourceName);
                if (m.id && m.id !== f.id) { renames.set(f.id, m.id); report.idCorregido.push({ de: f.id, a: m.id }); f.id = m.id; }
            } else if (idx) {
                report.sinCasillero.push({ id: f.id, casillero: src._box });
            } else {
                // Sin main: el sourceMeta mínimo para que Signaframe lo enlace al importar.
                f.sourceMeta = { sourceName: src._box };
            }
        }
        if (f.type === 'signature' && !f.sourceMeta) {
            if (mainSign.has(f.id)) f.sourceMeta = clone(mainSign.get(f.id));
            else {
                f.sourceMeta = { sourceName: null, sourceType: 'signature', page: lastPage, rect: { x: 0, y: 0, width: 180, height: 60 } };
                report.firmasSinUbicar.push(f.id);
            }
        }
        if (f.jsonOutputPath && f.type !== 'repeater') f.salidaJSON = f.jsonOutputPath;
        if (f.prefillKey && !f.prefillMode) f.prefillMode = 'optional';
        return f;
    };

    const sections = [];
    for (const st of matrix.steps) {
        const sec = {
            id: st.id,
            title: st.title,
            description: null,
            instructions: null,
            conditionalVisibility: null,
            order: 0,
            hidden: st.hidden ? true : null,
            fields: [],
            subsections: [],
            childrenOrder: [],
            ...(st.extra || {}),
        };
        sec.fields = (st.fields || []).map(fieldOut);
        sec.subsections = (st.subs || []).filter((s) => (s.fields || []).length || s.extra?.instructions).map((s) => ({
            id: s.id,
            title: s.title,
            description: null,
            instructions: null,
            conditionalVisibility: s.cond || null,
            hidden: s.hidden ? true : null,
            order: 0,
            ...(s.extra || {}),
            fields: (s.fields || []).map(fieldOut),
        }));
        if (!sec.fields.length && !sec.subsections.length) continue;
        sections.push(sec);
    }

    // Casilleros del main que la matriz no usa: ocultos, para no perderlos.
    if (idx) {
        const leftovers = [];
        for (const [name, m] of idx.exact) {
            if (usedBoxes.has(name)) continue;
            report.sinUsar.push(name);
            leftovers.push({ ...clone(m), hidden: true, excludeFromJson: true });
        }
        if (leftovers.length) {
            sections.push({
                id: SIN_USAR_ID, title: 'Campos del PDF sin usar', description: null, instructions: null,
                conditionalVisibility: null, order: 0, hidden: true, fields: leftovers, subsections: [], childrenOrder: [],
            });
        }
    }

    // Referencias a ids que se corrigieron por los del main.
    if (renames.size) {
        const fix = (s) => {
            let out = s;
            for (const [a, b] of renames) out = out.split(`"${a}"`).join(`"${b}"`);
            return out;
        };
        for (const sec of sections) {
            if (typeof sec.conditionalVisibility === 'string') sec.conditionalVisibility = fix(sec.conditionalVisibility);
            for (const sub of sec.subsections) if (typeof sub.conditionalVisibility === 'string') sub.conditionalVisibility = fix(sub.conditionalVisibility);
        }
        for (const f of allFields(sections)) {
            for (const k of Object.keys(f)) {
                if (k === 'id' || k === 'sourceMeta') continue;
                if (typeof f[k] === 'string' && renames.has(f[k])) f[k] = renames.get(f[k]);
                else if (typeof f[k] === 'string' && f[k].includes('"field_')) f[k] = fix(f[k]);
                else if (f[k] && typeof f[k] === 'object') f[k] = JSON.parse(fix(JSON.stringify(f[k])));
            }
        }
    }

    // Orden.
    sections.forEach((sec, i) => {
        sec.order = i + 1;
        sec.fields.forEach((f, j) => { f.order = j + 1; });
        sec.subsections.forEach((sub, j) => {
            sub.order = sec.fields.length + j + 1;
            sub.fields.forEach((f, k) => { f.order = k + 1; });
        });
        sec.childrenOrder = [
            ...sec.fields.map((f) => ({ kind: 'field', id: f.id })),
            ...sec.subsections.map((s) => ({ kind: 'subsection', id: s.id })),
        ];
    });

    const seen = new Set();
    for (const f of allFields(sections)) {
        if (seen.has(f.id)) report.repetidos.push(f.id);
        seen.add(f.id);
    }
    report.campos = seen.size;
    report.pasos = sections.filter((s) => s.id !== SIN_USAR_ID).length;

    const formDef = {
        sections,
        validationRules: clone(main?.validationRules) || [],
        prefillMappings: clone(main?.prefillMappings) || [],
        generatedDocuments: clone(main?.generatedDocuments) || [],
        version: opts.version || 'v1',
    };
    if (main?._sourcePdf) formDef._sourcePdf = clone(main._sourcePdf);
    return { formDef, report };
}

/** Todos los campos del form-def (secciones y subsecciones). */
export function allFields(sections) {
    return sections.flatMap((s) => [...s.fields, ...s.subsections.flatMap((x) => x.fields)]);
}
