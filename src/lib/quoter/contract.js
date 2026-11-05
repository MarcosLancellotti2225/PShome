/**
 * Cotización según el contrato (Propuesta INS–Namirial 21/10/2025, Rubro 2).
 *
 * El contrato cobra por formulario y define la complejidad por dos números:
 *   - campos de captura: los que el usuario completa (editables, también los
 *     prellenados que puede cambiar). No cuentan los bloqueados («Disabled»),
 *     los informativos ni los que van solo al JSON.
 *   - reglas de negocio: todas las de la ficha (validaciones de formato o largo,
 *     condicionales, cálculos y otras), una por texto distinto en cada campo.
 *
 * La fuente es la ficha de configuración (Excel), no el PDF: una fila por
 * opción de cada combo/casilla, así que se agrupa por campo.
 *
 * Todo puro (sin DOM): se prueba con Node (test/quoter.test.mjs).
 */

import * as XLSX from 'xlsx';

export const CONTRACT_PRICING = {
    source: 'Propuesta de Servicio INS–Namirial 21/10/2025 · Rubro 2',
    currency: 'USD',
    // «Menos de 15 campos» / «de 16 a 30»: 15 cuenta como Baja.
    tiers: [
        { key: 'baja', label: 'Baja', line: '2.1', maxFields: 15, maxRules: 10, price: 5500 },
        { key: 'media', label: 'Media', line: '2.2', maxFields: 30, maxRules: 20, price: 9800 },
        { key: 'alta', label: 'Alta', line: '2.3', maxFields: 50, maxRules: 30, price: 12700 },
    ],
    // Línea 2.4: arriba de 50 campos, grupos de 5 (un grupo empezado cuenta entero).
    extraFields: { groupSize: 5, price: 250 },
    // Línea 2.5 / Rubro 5: reglas extra o mayor complejidad, a estimar en horas.
    hourRate: 99,
};

// ─── Lectura de la ficha ─────────────────────────────────────────────────────

const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const norm = (v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Hojas que no son campos del formulario: estructura, output generado, índices.
const IGNORED_SHEET_RX = /json\s*generado|generado|estructura|instructivo|portada|[ií]ndice|readme|ejemplo/i;
const FORM_CODE_RX = /\b([A-Z]\d{3,5})\b/g;

const COLS = {
    name: /nombre\s+del\s+campo\s+en\s+(el\s+)?formulario/i,
    step: /^pasos/i,
    section: /^secci[oó]n$/i,
    type: /^tipo\s+de\s+dato/i,
    rule: /^regla/i,
    target: /^obligatorio/i, // en las fichas del INS dice a dónde va el dato: Both / WEB / JSON / None
    form: /formulario\s+a\s+visualizar/i,
    view: /^visualizaci[oó]n/i,
    notes: /^observaci/i,
};

// Textos de las columnas de regla que no son reglas.
const NOT_A_RULE_RX = /^(no aplica\b|referencia\b|aplica para\b|n\/?a$|-$|no$|ninguna$)/i;

export function ruleType(text) {
    if (/\bsi\b|s[ií] selecciona|se muestra|solo en (el )?caso|solo se debe|desplegar|depende|cuando\b|seg[uú]n\b|ocultar/i.test(text)) return 'condicional';
    if (/autom[aá]tic|concaten|c[aá]lculo|calcular|getdate|sumatoria|suma de/i.test(text)) return 'calculo';
    if (/num[eé]ric|d[ií]gito|caracter|formato|alfanum|correo|m[aá]ximo|m[ií]nimo|longitud|decimal|rango|mayor|menor/i.test(text)) return 'validacion';
    return 'otra';
}

function findColumns(rows) {
    for (let h = 0; h < Math.min(8, rows.length); h++) {
        const head = (rows[h] || []).map(clean);
        const name = head.findIndex((c) => COLS.name.test(c));
        if (name < 0) continue;
        const col = { header: h };
        for (const [k, rx] of Object.entries(COLS)) col[k] = head.findIndex((c) => rx.test(c));
        col.name = name;
        return col;
    }
    return null;
}

/**
 * Lee las filas de campo de una ficha. Devuelve null si el Excel no es una ficha
 * (no tiene la columna «Nombre del campo en formulario»).
 */
export function readFichaRows(wb) {
    const rows = [];
    let found = false;
    for (const sheet of wb.SheetNames) {
        if (IGNORED_SHEET_RX.test(sheet)) continue;
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
        const col = findColumns(raw);
        if (!col) continue;
        found = true;
        const at = (r, k) => (col[k] >= 0 ? clean(r[col[k]]) : '');
        for (const r of raw.slice(col.header + 1)) {
            const name = at(r, 'name');
            if (!name) continue;
            rows.push({
                sheet, name,
                step: at(r, 'step'), section: at(r, 'section'), type: at(r, 'type'),
                target: at(r, 'target'), form: at(r, 'form'), view: at(r, 'view'),
                texts: [at(r, 'rule'), at(r, 'notes')].filter(Boolean),
            });
        }
    }
    return found ? rows : null;
}

// Códigos de formulario que menciona la ficha (D0770, D0873…).
function formCodes(rows) {
    const codes = new Set();
    for (const r of rows) {
        for (const t of [r.form, ...r.texts]) {
            for (const m of t.matchAll(FORM_CODE_RX)) codes.add(m[1]);
        }
    }
    return [...codes].sort();
}

const isBackendOnly = (r) => norm(r.step) === 'json' || norm(r.form) === 'json' || norm(r.target) === 'json';

function belongsTo(r, code, single) {
    if (isBackendOnly(r)) return false;
    // «No aplica Formulario D0770» saca la fila de ese formulario (o del único, si no nombra ninguno).
    for (const t of r.texts) {
        if (!/no aplica/i.test(t)) continue;
        if ((code && t.includes(code)) || (single && !/\b[A-Z]\d{3,5}\b/.test(t))) return false;
    }
    const f = norm(r.form);
    if (!f || f === 'todos' || f === 'ambos') return true;
    return single ? true : clean(r.form).includes(code);
}

/** Cuenta campos y reglas de un formulario según el criterio del contrato. */
export function countForm(rows, code, single) {
    const fields = new Map();
    for (const r of rows) {
        if (!belongsTo(r, code, single)) continue;
        const key = `${r.sheet}|${norm(r.section)}|${norm(r.name)}`;
        const f = fields.get(key) || { name: r.name, sheet: r.sheet, kind: null, texts: new Set() };
        const kind = /informativo/i.test(r.type) ? 'info' : /disabled|no aplica/i.test(r.view) ? 'auto' : 'editable';
        // Si alguna opción del campo es editable, el campo es editable.
        if (!f.kind || kind === 'editable' || (kind === 'auto' && f.kind === 'info')) f.kind = kind;
        r.texts.forEach((t) => { if (!NOT_A_RULE_RX.test(t)) f.texts.add(t); });
        fields.set(key, f);
    }
    const out = {
        editable: 0, auto: 0, info: 0,
        rules: { validacion: 0, condicional: 0, calculo: 0, otra: 0, total: 0 },
        fieldList: [],
    };
    for (const f of fields.values()) {
        out[f.kind] += 1;
        const rules = [...f.texts].map((text) => ({ text, type: ruleType(text) }));
        rules.forEach((r) => { out.rules[r.type] += 1; out.rules.total += 1; });
        out.fieldList.push({ name: f.name, sheet: f.sheet, kind: f.kind, rules });
    }
    return out;
}

/** Formularios de una ficha con sus números. */
export function fichaForms(wb, fileName) {
    const rows = readFichaRows(wb);
    if (!rows) return [];
    const codes = formCodes(rows);
    const single = codes.length <= 1;
    const list = single ? [codes[0] || null] : codes;
    return list.map((code) => ({ code, ficha: fileName, ...countForm(rows, code || '', single) }));
}

// ─── Cotización ──────────────────────────────────────────────────────────────

const compact = (s) => norm(s).replace(/[^a-z0-9]/g, '');

/**
 * Empareja cada formulario de las fichas con su PDF (por el código en el nombre
 * del archivo). Devuelve una fila por formulario a cotizar y los PDFs que quedan
 * afuera (sin campos, o sin ficha).
 */
export function contractForms(pdfs, excels) {
    const forms = excels.flatMap((x) => x.contractForms || []);
    const usedPdfs = new Set();
    const rows = forms.map((f) => {
        let pdf = null;
        if (f.code) pdf = pdfs.find((p) => compact(p.file).includes(compact(f.code))) || null;
        if (!pdf) {
            const withFields = pdfs.filter((p) => p.fieldCount > 0 && !usedPdfs.has(p.file));
            if (!f.code || withFields.length === 1) pdf = withFields.length === 1 ? withFields[0] : null;
        }
        if (pdf) usedPdfs.add(pdf.file);
        return { ...f, pdf: pdf ? pdf.file : null, pdfFields: pdf ? pdf.fieldCount : null, id: `${f.ficha}|${f.code || ''}` };
    });
    const skipped = pdfs.filter((p) => !usedPdfs.has(p.file)).map((p) => ({
        file: p.file,
        reason: p.fieldCount === 0
            ? 'No tiene campos para completar: es un documento que se adjunta, no se cotiza como formulario.'
            : 'No encontré su ficha en el ZIP: no se puede cotizar por contrato.',
    }));
    return { forms: rows, skipped };
}

/**
 * Precio de un formulario.
 * @param {{editable:number, rules:{total:number}}} form
 * @param {object} pricing - CONTRACT_PRICING (o una copia editada)
 * @param {number|null} hours - horas estimadas para las reglas extra (null = a estimar)
 */
export function quoteForm(form, pricing = CONTRACT_PRICING, hours = null) {
    const fields = form.editable;
    const rules = form.rules.total;
    const tiers = pricing.tiers;
    const top = tiers[tiers.length - 1];
    const byFields = tiers.find((t) => fields <= t.maxFields) || top;
    const byRules = tiers.find((t) => rules <= t.maxRules) || top;
    const tier = tiers.indexOf(byFields) >= tiers.indexOf(byRules) ? byFields : byRules;

    const extraFields = Math.max(0, fields - top.maxFields);
    const groups = Math.ceil(extraFields / pricing.extraFields.groupSize);
    const extraRules = Math.max(0, rules - top.maxRules);
    const h = hours == null || hours === '' || Number.isNaN(Number(hours)) ? null : Number(hours);
    const hoursCost = h == null ? 0 : Math.round(h * pricing.hourRate * 100) / 100;
    const fieldsCost = groups * pricing.extraFields.price;

    let why;
    if (byFields === byRules) why = `${fields} campos y ${rules} reglas entran en ${tier.label}.`;
    else if (tier === byRules) why = `Por campos (${fields}) sería ${byFields.label}, pero las ${rules} reglas superan el máximo de ${byFields.maxRules}.`;
    else why = `Por reglas (${rules}) sería ${byRules.label}, pero los ${fields} campos superan el máximo de ${byRules.maxFields}.`;

    return {
        tier, fields, rules, why,
        base: tier.price,
        extraFields, extraFieldGroups: groups, fieldsCost,
        extraRules, hours: h, hoursCost,
        pendingHours: extraRules > 0 && h == null,
        total: tier.price + fieldsCost + hoursCost,
    };
}

export function money(n, currency = 'USD') {
    return `${currency} ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Resumen en texto para pegar en un mail o una propuesta. */
export function quoteSummary(items, pricing = CONTRACT_PRICING) {
    const c = pricing.currency;
    const lines = items.map(({ form, quote: q }) => {
        const name = form.pdf || form.code || form.ficha;
        const parts = [`${name}: ${q.tier.label} (línea ${q.tier.line}) · ${q.fields} campos · ${q.rules} reglas · base ${money(q.base, c)}`];
        if (q.extraFieldGroups) parts.push(`+ ${q.extraFieldGroups} grupos de ${pricing.extraFields.groupSize} campos (${money(q.fieldsCost, c)})`);
        const reglas = q.extraRules === 1 ? '1 regla extra' : `${q.extraRules} reglas extra`;
        if (q.extraRules) parts.push(q.hours == null
            ? `+ ${reglas} a ${money(pricing.hourRate, c)}/hora, a estimar`
            : `+ ${q.hours} h por ${reglas} (${money(q.hoursCost, c)})`);
        return `- ${parts.join(' ')} → ${money(q.total, c)}${q.pendingHours ? ' + horas' : ''}`;
    });
    const total = items.reduce((s, i) => s + i.quote.total, 0);
    const pending = items.some((i) => i.quote.pendingHours);
    return [
        `Cotización según contrato (${pricing.source})`,
        ...lines,
        `Total: ${money(total, c)}${pending ? ' + horas de reglas extra a estimar' : ''} (sin IVA)`,
    ].join('\n');
}
