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

// Código de formulario del INS: D0770, 1008172…
const CODE_RX = /^[A-Z]?\d{3,7}$/i;
// «No aplica Formulario D0770» / «No aplica para este formulario». Un «No aplica» suelto
// en la columna Regla quiere decir «sin regla», no que el campo no vaya.
const NOT_IN_FORM_RX = /no aplica (para )?(el |este |[eé]ste |ese )?formulario\s*([A-Z]?\d{3,7})?/i;

/**
 * Códigos de los PDFs que arma esta ficha. Salen solo de la columna «Formulario a
 * visualizar» y de «No aplica Formulario X»: las observaciones sueltas («en el
 * formulario D0714 debe verse…») no cuentan.
 */
function formCodes(rows) {
    const codes = new Set();
    for (const r of rows) {
        r.form.split(/[/,;]| y /).map((t) => t.trim()).filter((t) => CODE_RX.test(t)).forEach((t) => codes.add(t.toUpperCase()));
        for (const t of r.texts) {
            const m = t.match(NOT_IN_FORM_RX);
            if (m && m[3]) codes.add(m[3].toUpperCase());
        }
    }
    return [...codes].sort();
}

const isBackendOnly = (r) => norm(r.step) === 'json' || norm(r.form) === 'json' || norm(r.target) === 'json';

/**
 * ¿La fila es un campo del formulario web de esta ficha? Cada ficha es un formulario:
 * entra todo lo que ve el usuario, salvo lo que va solo al JSON y lo que la ficha
 * dice que no aplica (al único PDF que arma, o a «este formulario»).
 */
function belongsTo(r, codes) {
    if (isBackendOnly(r)) return false;
    for (const t of r.texts) {
        const m = t.match(NOT_IN_FORM_RX);
        if (!m) continue;
        const code = m[3] ? m[3].toUpperCase() : null;
        if (!code) return false;                                   // «no aplica para este formulario»
        if (codes.length <= 1 && codes.includes(code)) return false; // no va en el único PDF
    }
    return true;
}

/** Cuenta campos y reglas de un formulario según el criterio del contrato. */
export function countForm(rows, codes = []) {
    const fields = new Map();
    for (const r of rows) {
        if (!belongsTo(r, codes)) continue;
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
        out.fieldList.push({ key: `${f.sheet}|${norm(f.name)}`, name: f.name, sheet: f.sheet, kind: f.kind, rules });
    }
    return out;
}

/** El formulario de una ficha (una ficha = un formulario web), con sus números. */
export function fichaForms(wb, fileName) {
    const rows = readFichaRows(wb);
    if (!rows) return [];
    const codes = formCodes(rows);
    return [{ code: codes.join(' / ') || null, codes, ficha: fileName, ...countForm(rows, codes) }];
}

// ─── Cotización ──────────────────────────────────────────────────────────────

const STOP = /^(ficha|configuracion|configuraci|solicitud|seguro|formulario|edit|editable|llenable|version|para|del|las|los|con|final)$/;
const tokens = (s) => norm(String(s).replace(/\.[a-z0-9]+$/i, ''))
    .split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.test(w)).map((w) => w.slice(0, 6));

// Un código que tienen todas las fichas (p. ej. un anexo común) no sirve para elegir.
function affinity(ficha, pdf, commonCodes) {
    const a = new Set(tokens(ficha.ficha));
    const shared = new Set(tokens(pdf.file).filter((w) => a.has(w))).size;
    const file = norm(pdf.file).replace(/[^a-z0-9]/g, '');
    const byCode = ficha.codes.some((c) => !commonCodes.has(c) && file.includes(c.toLowerCase())) ? 2 : 0;
    const anyCode = ficha.codes.some((c) => file.includes(c.toLowerCase())) ? 0.5 : 0;
    return shared + byCode + anyCode;
}

/** Nombre del formulario para mostrar: el de la ficha sin «Ficha de configuración -». */
export function formTitle(form) {
    const t = String(form.ficha || '').replace(/\.(xlsx|xlsm|xls|csv)$/i, '')
        .replace(/^ficha\s+de\s+configuraci\S*\s*[-–:]?\s*/i, '').trim();
    return t || form.pdf || form.code || 'Formulario';
}

/**
 * Empareja cada ficha con el PDF que arma (por palabras del nombre y por código).
 * Devuelve una fila por formulario a cotizar y los PDFs que quedan afuera.
 */
export function contractForms(pdfs, excels) {
    const forms = excels.flatMap((x) => x.contractForms || []);
    const candidates = pdfs.filter((p) => p.fieldCount > 0);
    const pairs = [];
    const commonCodes = new Set(forms.length > 1 ? forms[0].codes.filter((c) => forms.every((f) => f.codes.includes(c))) : []);
    forms.forEach((f, fi) => candidates.forEach((p) => { const s = affinity(f, p, commonCodes); if (s > 0) pairs.push({ fi, p, s }); }));
    pairs.sort((a, b) => b.s - a.s);
    const pdfOf = new Map();
    const usedPdfs = new Set();
    for (const { fi, p } of pairs) {
        if (pdfOf.has(fi) || usedPdfs.has(p.file)) continue;
        pdfOf.set(fi, p); usedPdfs.add(p.file);
    }
    // Una sola ficha y un solo PDF con campos: van juntos aunque los nombres no se parezcan.
    if (forms.length === 1 && !pdfOf.size && candidates.length === 1) { pdfOf.set(0, candidates[0]); usedPdfs.add(candidates[0].file); }
    const rows = forms.map((f, fi) => {
        const pdf = pdfOf.get(fi) || null;
        return { ...f, pdf: pdf ? pdf.file : null, pdfFields: pdf ? pdf.fieldCount : null, id: `${f.ficha}|${fi}` };
    });
    const skipped = pdfs.filter((p) => !usedPdfs.has(p.file)).map((p) => ({
        file: p.file,
        reason: p.fieldCount === 0
            ? 'No tiene campos para completar: es un documento que se adjunta, no se cotiza como formulario.'
            : 'Tiene campos pero no tiene ficha propia en el ZIP: no se puede cotizar por contrato hasta tener su ficha.',
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
    if (fields > top.maxFields || rules > top.maxRules) {
        const over = [fields > top.maxFields && `${fields} campos`, rules > top.maxRules && `${rules} reglas`].filter(Boolean).join(' y ');
        why = `Con ${over} supera el máximo de ${top.label} (${top.maxFields} campos y ${top.maxRules} reglas): se cobra ${top.label} más los adicionales.`;
    } else if (byFields === byRules) why = `${fields} campos y ${rules} reglas entran en ${tier.label}.`;
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

// ─── Grupo: varios formularios que comparten campos y reglas ────────────────

const pluralize = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const size = (f) => f.editable + f.rules.total;

/**
 * Arma la lista a cotizar. Sin grupo, cada formulario se cobra completo.
 * En grupo, el principal se cobra completo y cada uno de los demás solo por lo que
 * agrega: los campos y reglas que no estaban en los anteriores del grupo.
 * @param {Array} forms - contract.forms
 * @param {{on:boolean, main:string|null, out:string[]}|null} group
 * @returns {Array<{form, counts, role:'solo'|'principal'|'agrupado', shared, quote}>}
 */
export function quoteItems(forms, pricing = CONTRACT_PRICING, hours = {}, group = null) {
    const out = new Set(group?.out || []);
    const members = group?.on ? forms.filter((f) => !out.has(f.id)) : [];
    const solo = (form) => ({ form, counts: form, role: 'solo', shared: null, quote: quoteForm(form, pricing, hours[form.id] ?? null) });
    if (members.length < 2) return forms.map(solo);

    const main = members.find((f) => f.id === group.main) || [...members].sort((a, b) => size(b) - size(a))[0];
    const ordered = [main, ...members.filter((f) => f !== main).sort((a, b) => size(b) - size(a))];
    const seenFields = new Set();
    const seenRules = new Set();
    const items = ordered.map((form, i) => {
        let counts = form;
        let shared = null;
        if (i > 0) {
            const rules = { validacion: 0, condicional: 0, calculo: 0, otra: 0, total: 0 };
            let editable = 0;
            for (const f of form.fieldList) {
                if (f.kind === 'editable' && !seenFields.has(f.key)) editable += 1;
                for (const r of f.rules) {
                    if (seenRules.has(`${f.key}|${norm(r.text)}`)) continue;
                    rules[r.type] += 1; rules.total += 1;
                }
            }
            counts = { ...form, editable, rules };
            shared = { fields: form.editable - editable, rules: form.rules.total - rules.total };
        }
        for (const f of form.fieldList) {
            seenFields.add(f.key);
            f.rules.forEach((r) => seenRules.add(`${f.key}|${norm(r.text)}`));
        }
        return { form, counts, role: i === 0 ? 'principal' : 'agrupado', shared, quote: quoteForm(counts, pricing, hours[form.id] ?? null) };
    });
    return [...items, ...forms.filter((f) => !members.includes(f)).map(solo)];
}

// ─── Explicación para el cliente ─────────────────────────────────────────────

/** Párrafos que explican cómo se llegó al precio, con los números de cada caso. */
export function explainQuote(items, contract, pricing = CONTRACT_PRICING) {
    const c = pricing.currency;
    const top = pricing.tiers[pricing.tiers.length - 1];
    if (!items.length) return [];
    const sum = (fn) => items.reduce((s, i) => s + fn(i), 0);
    const p = [];
    p.push(`La cotización aplica la Propuesta de Servicio firmada el 21/10/2025, Rubro 2 «Formularios Digitales (Bajo demanda)». Cada formulario se clasifica por dos criterios: la cantidad de campos de captura y la cantidad de reglas de negocio (${pricing.tiers.map((t) => `${t.label}: hasta ${t.maxFields} campos y ${t.maxRules} reglas, ${money(t.price, c)}`).join('; ')}).`);
    const auto = sum((i) => i.form.auto);
    const info = sum((i) => i.form.info);
    p.push(`Campos de captura: se cuentan solo los que completa el usuario, según la ficha de configuración entregada por el INS (también los prellenados que el usuario puede cambiar). No se cobran ${pluralize(auto, 'campo automático o bloqueado', 'campos automáticos o bloqueados')}, ${pluralize(info, 'texto informativo', 'textos informativos')} ni los datos que viajan solo en el JSON.`);
    const r = (k) => sum((i) => i.form.rules[k]);
    p.push(`Reglas de negocio: son las indicadas en la ficha para cada campo (${pluralize(r('validacion'), 'validación', 'validaciones')} de formato, ${pluralize(r('condicional'), 'condición', 'condiciones')} de visualización, ${pluralize(r('calculo'), 'cálculo automático', 'cálculos automáticos')} y ${pluralize(r('otra'), 'otra', 'otras')}). Son las actividades que la sección 4 de la propuesta nombra como «reglas de validación de datos» y «lógica de negocio del formulario».`);
    items.forEach((i) => {
        const name = formTitle(i.form);
        if (i.role === 'agrupado') {
            p.push(`${name}: comparte con los formularios anteriores del grupo ${pluralize(i.shared.fields, 'campo', 'campos')} y ${pluralize(i.shared.rules, 'regla', 'reglas')}, que no se vuelven a cobrar. Agrega ${pluralize(i.quote.fields, 'campo nuevo', 'campos nuevos')} y ${pluralize(i.quote.rules, 'regla nueva', 'reglas nuevas')}: complejidad ${i.quote.tier.label.toLowerCase()} (línea ${i.quote.tier.line}), ${money(i.quote.base, c)}.`);
        } else {
            p.push(`${name}${i.role === 'principal' ? ' (formulario principal del grupo, se cobra completo)' : ''}: ${i.quote.why} Complejidad ${i.quote.tier.label.toLowerCase()} (línea ${i.quote.tier.line}), ${money(i.quote.base, c)}.`);
        }
    });
    const grouped = items.filter((i) => i.role !== 'solo');
    if (grouped.length > 1) {
        const separate = grouped.reduce((s, i) => s + quoteForm(i.form, pricing).total, 0);
        const together = grouped.reduce((s, i) => s + i.quote.total, 0);
        p.push(`Los ${grouped.length} formularios del grupo se cotizan juntos porque comparten campos y reglas: el principal se cobra completo y cada uno de los demás solo por lo que agrega, con el mínimo de complejidad baja. Por separado sumarían ${money(separate, c)}; en grupo, ${money(together, c)}.`);
    }
    const groups = sum((i) => i.quote.extraFieldGroups);
    if (groups) p.push(`Los campos que superan los ${top.maxFields} del nivel ${top.label} se cobran en grupos de ${pricing.extraFields.groupSize} a ${money(pricing.extraFields.price, c)} (línea 2.4): ${pluralize(groups, 'grupo', 'grupos')} en total.`);
    const extra = sum((i) => i.quote.extraRules);
    if (extra) p.push(`${pluralize(extra, 'regla supera', 'reglas superan')} el máximo de ${top.maxRules} del nivel ${top.label}. Según la línea 2.5 se estiman en horas a ${money(pricing.hourRate, c)} y requieren la aprobación previa del INS antes de implementarse.`);
    (contract?.skipped || []).forEach((s) => p.push(`${s.file}: ${s.reason}`));
    return p;
}

/** Resumen en texto para pegar en un mail o una propuesta. */
export function quoteSummary(items, pricing = CONTRACT_PRICING, contract = null) {
    const c = pricing.currency;
    const lines = items.map(({ form, quote: q, role }) => {
        const name = formTitle(form) + (form.pdf ? ` (${form.pdf})` : '');
        const tag = role === 'principal' ? ' [principal del grupo]' : role === 'agrupado' ? ' [agrupado: solo lo nuevo]' : '';
        const parts = [`${name}${tag}: ${q.tier.label} (línea ${q.tier.line}) · ${q.fields} campos · ${q.rules} reglas · base ${money(q.base, c)}`];
        if (q.extraFieldGroups) parts.push(`+ ${q.extraFieldGroups} grupos de ${pricing.extraFields.groupSize} campos (${money(q.fieldsCost, c)})`);
        const reglas = q.extraRules === 1 ? '1 regla extra' : `${q.extraRules} reglas extra`;
        if (q.extraRules) parts.push(q.hours == null
            ? `+ ${reglas} a ${money(pricing.hourRate, c)}/hora, a estimar`
            : `+ ${q.hours} h por ${reglas} (${money(q.hoursCost, c)})`);
        return `- ${parts.join(' ')} → ${money(q.total, c)}${q.pendingHours ? ' + horas' : ''}`;
    });
    const total = items.reduce((s, i) => s + i.quote.total, 0);
    const pending = items.some((i) => i.quote.pendingHours);
    const text = [
        `Cotización según contrato (${pricing.source})`,
        ...lines,
        `Total: ${money(total, c)}${pending ? ' + horas de reglas extra a estimar' : ''} (sin IVA)`,
    ];
    if (contract) text.push('', 'Cómo se calculó:', ...explainQuote(items, contract, pricing).map((x) => `- ${x}`));
    return text.join('\n');
}

// ─── Modelo para los reportes (HTML, PDF y Word) ────────────────────────────

/**
 * Todo lo que muestran los reportes, ya calculado: los tres formatos salen de acá
 * para que digan lo mismo que la pantalla.
 * @param {object} contract - result.contract de analyzeZip
 * @param {object} pricing
 * @param {Object<string, number|null>} hours - horas de reglas extra por id de formulario
 * @param {object|null} group - { on, main, out }
 */
export function reportModel(contract, pricing = CONTRACT_PRICING, hours = {}, group = null) {
    const c = pricing.currency;
    const quoted = quoteItems(contract?.forms || [], pricing, hours, group);
    const items = quoted.map(({ form, counts, role, shared, quote: q }) => {
        const lines = [{ label: `Formulario digital ${q.tier.label.toLowerCase()} (línea ${q.tier.line})`, amount: q.base }];
        if (q.extraFieldGroups) {
            lines.push({ label: `${pluralize(q.extraFieldGroups, 'grupo', 'grupos')} de ${pricing.extraFields.groupSize} campos adicionales (línea 2.4)`, amount: q.fieldsCost });
        }
        if (q.extraRules) {
            lines.push({
                label: `${pluralize(q.extraRules, 'regla adicional', 'reglas adicionales')} (línea 2.5, ${money(pricing.hourRate, c)} por hora)`
                    + (q.hours == null ? '' : ` · ${q.hours} h`),
                amount: q.hours == null ? null : q.hoursCost,
            });
        }
        return {
            name: formTitle(form),
            pdf: form.pdf,
            code: form.code,
            role,
            shared,
            level: q.tier.label,
            levelKey: q.tier.key,
            line: q.tier.line,
            fields: q.fields,
            rules: q.rules,
            why: role === 'agrupado'
                ? `Comparte ${pluralize(shared.fields, 'campo', 'campos')} y ${pluralize(shared.rules, 'regla', 'reglas')} con los formularios anteriores del grupo: se cobra solo lo que agrega (${q.fields} campos y ${q.rules} reglas nuevas).`
                : q.why,
            ruleMix: counts.rules,
            notCounted: { auto: form.auto, info: form.info },
            lines,
            total: q.total,
            pending: q.pendingHours,
        };
    });
    const total = items.reduce((s, i) => s + i.total, 0);
    const pending = items.some((i) => i.pending);
    const grouped = quoted.filter((i) => i.role !== 'solo');
    const separate = quoted.reduce((s, i) => s + quoteForm(i.form, pricing, hours[i.form.id] ?? null).total, 0);
    const sum = (k) => items.reduce((s, i) => s + i.ruleMix[k], 0);
    const includes = items.length ? [
        `Construcción de ${pluralize(items.length, 'formulario digital', 'formularios digitales')} con ${pluralize(items.reduce((s, i) => s + i.fields, 0), 'campo de captura', 'campos de captura')}${grouped.length > 1 ? ' (sin contar dos veces los que se repiten en el grupo)' : ''}.`,
        `Implementación de ${pluralize(items.reduce((s, i) => s + i.rules, 0), 'regla de negocio', 'reglas de negocio')}: ${pluralize(sum('validacion'), 'validación', 'validaciones')}, ${pluralize(sum('condicional'), 'condición', 'condiciones')}, ${pluralize(sum('calculo'), 'cálculo', 'cálculos')}${sum('otra') ? ` y ${pluralize(sum('otra'), 'otra', 'otras')}` : ''}.`,
        'Generación del documento PDF con los datos del formulario.',
        'Pruebas del formulario, del documento generado y del envío de datos.',
    ] : [];
    return {
        source: pricing.source,
        currency: c,
        tiers: pricing.tiers,
        hourRate: pricing.hourRate,
        items,
        grouped: grouped.length > 1,
        separateTotal: separate,
        attachments: (contract?.skipped || []).map((s) => ({ file: s.file, reason: s.reason })),
        total,
        totalLabel: `${money(total, c)}${pending ? ' + horas a estimar' : ''}`,
        pending,
        includes,
        explanation: explainQuote(quoted, contract, pricing),
    };
}
