/**
 * Concat engine: shared logic for evaluating autoFillConcat tokens.
 *
 * Supports:
 *  - Per-token chained transformations (trim, upper, lower, capitalize,
 *    substring, length, split, replace, round, floor, ceil, abs, formatNumber,
 *    formatDate).
 *  - Operation between consecutive tokens (concat, add, sub, addDays,
 *    diffDays).
 *  - Per-token conditions with extended operators (empty, notEmpty, equals,
 *    notEquals, gt, lt, contains, startsWith, endsWith, regex). Conditions are
 *    evaluated against the value AFTER transformations are applied.
 */
/**
 * Splits a CSV-like list of values supporting double or single quoted entries,
 * so a needle may itself contain commas, quotes or other special characters.
 *
 * Examples:
 *   foo, bar              -> ["foo", "bar"]
 *   "hello, world", foo   -> ["hello, world", "foo"]
 *   "she said ""hi""", x  -> ['she said "hi"', "x"]
 *   'a, b', c             -> ["a, b", "c"]
 *
 * Unquoted entries are trimmed and empty entries are dropped (legacy behaviour).
 * Quoted entries preserve internal whitespace and the surrounding quotes are
 * stripped. Doubled quotes inside a quoted segment are unescaped.
 */
function splitValues(csv) {
    if (!csv)
        return [];
    const out = [];
    let buf = '';
    let quote = null;
    let bufQuoted = false;
    const flush = () => {
        const v = bufQuoted ? buf : buf.trim();
        if (v.length > 0 || bufQuoted)
            out.push(v);
        buf = '';
        bufQuoted = false;
    };
    for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (quote) {
            if (ch === quote) {
                if (csv[i + 1] === quote) {
                    buf += ch;
                    i++;
                    continue;
                }
                quote = null;
                continue;
            }
            buf += ch;
            continue;
        }
        if ((ch === '"' || ch === "'") && buf.trim() === '') {
            quote = ch;
            buf = '';
            bufQuoted = true;
            continue;
        }
        if (ch === ',') {
            flush();
            continue;
        }
        buf += ch;
    }
    flush();
    return out.filter((v) => v.length > 0);
}
function fieldValueCandidates(fieldId) {
    const stripped = fieldId.startsWith('field_') ? fieldId.slice(6) : fieldId;
    return [fieldId, `field_${fieldId}`, stripped, `field_${stripped}`];
}
function readFieldValue(formData, fieldId) {
    const raw = fieldValueCandidates(fieldId).map((key) => formData[key]).find((v) => v != null) ?? '';
    if (raw == null)
        return '';
    return String(raw).trim();
}
/**
 * Expand a value to all equivalent representations using the field's option
 * set, so a condition configured against the label, pdfValue, jsonValue or
 * legacy `value` all match the stored form value (which is usually the label).
 */
function expandWithOptions(value, options) {
    const base = value.trim().toLowerCase();
    if (!base)
        return [''];
    if (!options || options.length === 0)
        return [base];
    const out = new Set([base]);
    for (const o of options) {
        const reps = [o.label, o.pdfValue, o.jsonValue, o.value]
            .filter((x) => typeof x === 'string' && x.length > 0)
            .map((x) => x.trim().toLowerCase());
        if (reps.includes(base))
            reps.forEach((r) => out.add(r));
    }
    return Array.from(out);
}
/**
 * Evaluate a token condition. The reference value is normally taken from
 * `formData[fieldId]`. If `tokenValueOverride` is provided, the condition is
 * evaluated against that string instead — used to gate a token by its OWN
 * post-transformation value.
 */
export function evaluateConcatTokenCondition(cond, formData, tokenValueOverride, getFieldOptions) {
    if (!cond || !cond.op)
        return true;
    if (!cond.fieldId && tokenValueOverride === undefined)
        return true;
    const v = tokenValueOverride !== undefined ? tokenValueOverride : readFieldValue(formData, cond.fieldId);
    const opts = cond.fieldId && getFieldOptions ? getFieldOptions(cond.fieldId) : null;
    const vForms = expandWithOptions(v, opts);
    switch (cond.op) {
        case 'empty':
            return v === '' || v === 'false';
        case 'notEmpty':
            return v !== '' && v !== 'false';
        case 'equals': {
            const list = splitValues(cond.values).flatMap((s) => expandWithOptions(s, opts));
            return list.some((s) => vForms.includes(s));
        }
        case 'notEquals': {
            const list = splitValues(cond.values).flatMap((s) => expandWithOptions(s, opts));
            return !list.some((s) => vForms.includes(s));
        }
        case 'gt': {
            const a = Number(v);
            const b = Number(cond.value ?? '');
            if (!Number.isFinite(a) || !Number.isFinite(b))
                return false;
            return a > b;
        }
        case 'lt': {
            const a = Number(v);
            const b = Number(cond.value ?? '');
            if (!Number.isFinite(a) || !Number.isFinite(b))
                return false;
            return a < b;
        }
        case 'contains': {
            const list = splitValues(cond.values).flatMap((s) => expandWithOptions(s, opts));
            return list.some((s) => vForms.some((vf) => vf.includes(s)));
        }
        case 'startsWith': {
            const list = splitValues(cond.values).flatMap((s) => expandWithOptions(s, opts));
            return list.some((s) => vForms.some((vf) => vf.startsWith(s)));
        }
        case 'endsWith': {
            const list = splitValues(cond.values).flatMap((s) => expandWithOptions(s, opts));
            return list.some((s) => vForms.some((vf) => vf.endsWith(s)));
        }
        case 'regex': {
            try {
                const re = new RegExp(cond.value ?? '');
                return re.test(v);
            }
            catch {
                return false;
            }
        }
        default:
            return true;
    }
}
function toNumber(v, fallback = NaN) {
    if (v === null || v === undefined || v === '')
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function capitalizeWords(s) {
    return s
        .toLocaleLowerCase()
        .replace(/(^|\s|[-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase());
}
export function formatDateValue(value, format) {
    if (!value)
        return '';
    // Pure date-only strings (YYYY-MM-DD) must be treated as local dates — using
    // `new Date("YYYY-MM-DD")` parses as UTC midnight, which shifts the day in
    // any non-UTC timezone and causes the value to drift by one day on each
    // save/reload cycle.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    let d;
    if (dateOnly) {
        d = new Date(parseInt(dateOnly[1], 10), parseInt(dateOnly[2], 10) - 1, parseInt(dateOnly[3], 10));
    }
    else {
        d = new Date(value);
    }
    if (Number.isNaN(d.getTime()))
        return value;
    const fmt = (format ?? 'DD/MM/YYYY').trim() || 'DD/MM/YYYY';
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const map = {
        YYYY: String(d.getFullYear()),
        YY: String(d.getFullYear()).slice(-2),
        MM: pad(d.getMonth() + 1),
        DD: pad(d.getDate()),
        HH: pad(d.getHours()),
        mm: pad(d.getMinutes()),
        ss: pad(d.getSeconds()),
    };
    return fmt.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (t) => map[t] ?? t);
}
export function applyTransforms(value, transforms) {
    if (!transforms || transforms.length === 0)
        return value;
    let v = value;
    for (const t of transforms) {
        switch (t.kind) {
            case 'trim':
                v = v.trim();
                break;
            case 'upper':
                v = v.toLocaleUpperCase();
                break;
            case 'lower':
                v = v.toLocaleLowerCase();
                break;
            case 'capitalize':
                v = capitalizeWords(v);
                break;
            case 'substring': {
                const start = Math.max(0, Math.floor(toNumber(t.start, 0)));
                const endRaw = toNumber(t.end, NaN);
                v = Number.isFinite(endRaw) ? v.substring(start, Math.floor(endRaw)) : v.substring(start);
                break;
            }
            case 'length':
                v = String(v.length);
                break;
            case 'split': {
                const sep = t.arg1 ?? '';
                const idx = Math.max(0, Math.floor(toNumber(t.start, 0)));
                const parts = sep === '' ? [v] : v.split(sep);
                v = parts[idx] ?? '';
                break;
            }
            case 'replace': {
                const search = t.arg1 ?? '';
                const repl = t.arg2 ?? '';
                if (search === '')
                    break;
                v = v.split(search).join(repl);
                break;
            }
            case 'round': {
                const n = toNumber(v, NaN);
                if (Number.isFinite(n))
                    v = String(Math.round(n));
                break;
            }
            case 'floor': {
                const n = toNumber(v, NaN);
                if (Number.isFinite(n))
                    v = String(Math.floor(n));
                break;
            }
            case 'ceil': {
                const n = toNumber(v, NaN);
                if (Number.isFinite(n))
                    v = String(Math.ceil(n));
                break;
            }
            case 'abs': {
                const n = toNumber(v, NaN);
                if (Number.isFinite(n))
                    v = String(Math.abs(n));
                break;
            }
            case 'formatNumber': {
                const n = toNumber(v, NaN);
                if (!Number.isFinite(n))
                    break;
                const decimals = Math.max(0, Math.min(20, Math.floor(toNumber(t.decimals ?? 2, 2))));
                const locale = (t.arg2 ?? 'es-ES') || 'es-ES';
                try {
                    v = new Intl.NumberFormat(locale, {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals,
                    }).format(n);
                }
                catch {
                    v = n.toFixed(decimals);
                }
                break;
            }
            case 'formatDate':
                v = formatDateValue(v, t.arg2);
                break;
        }
    }
    return v;
}
function parseDateOnly(s) {
    if (!s)
        return null;
    const t = s.trim();
    if (!t)
        return null;
    // YYYY-MM-DD or full ISO → build as local date to avoid TZ shifts.
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m)
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // DD/MM/YYYY or D/M/YYYY (also accepts '-' or '.' separators).
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m)
        return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
}
function diffFullYears(a, b) {
    let y = a.getFullYear() - b.getFullYear();
    const m = a.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && a.getDate() < b.getDate()))
        y -= 1;
    return y;
}
function diffFullMonths(a, b) {
    let m = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
    if (a.getDate() < b.getDate())
        m -= 1;
    return m;
}
/**
 * Combine two values according to the operation. The first call uses
 * operation = 'concat' implicitly (treating `acc` as the running value).
 * `separator` is only used by 'concat'.
 */
function combine(acc, next, op, separator) {
    if (next === '' && op === 'concat')
        return acc;
    switch (op) {
        case 'concat':
            if (acc === '')
                return next;
            return acc + separator + next;
        case 'add': {
            const a = toNumber(acc, NaN);
            const b = toNumber(next, NaN);
            if (!Number.isFinite(a) || !Number.isFinite(b))
                return '';
            return String(a + b);
        }
        case 'sub': {
            const a = toNumber(acc, NaN);
            const b = toNumber(next, NaN);
            if (!Number.isFinite(a) || !Number.isFinite(b))
                return '';
            return String(a - b);
        }
        case 'percent': {
            const a = toNumber(acc, NaN);
            const b = toNumber(next, NaN);
            if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0)
                return '';
            const pct = (a / b) * 100;
            const rounded = Math.round(pct * 100) / 100;
            return String(rounded);
        }
        case 'addDays': {
            const d = parseDateOnly(acc);
            const days = toNumber(next, NaN);
            if (!d || !Number.isFinite(days))
                return '';
            d.setDate(d.getDate() + Math.round(days));
            return d.toISOString().slice(0, 10);
        }
        case 'addMonths': {
            const d = parseDateOnly(acc);
            const months = toNumber(next, NaN);
            if (!d || !Number.isFinite(months))
                return '';
            d.setMonth(d.getMonth() + Math.round(months));
            return d.toISOString().slice(0, 10);
        }
        case 'addYears': {
            const d = parseDateOnly(acc);
            const years = toNumber(next, NaN);
            if (!d || !Number.isFinite(years))
                return '';
            d.setFullYear(d.getFullYear() + Math.round(years));
            return d.toISOString().slice(0, 10);
        }
        case 'diffDays': {
            const a = parseDateOnly(acc);
            const b = parseDateOnly(next);
            if (!a || !b)
                return '';
            const ms = a.getTime() - b.getTime();
            return String(Math.floor(ms / (1000 * 60 * 60 * 24)));
        }
        case 'diffMonths': {
            const a = parseDateOnly(acc);
            const b = parseDateOnly(next);
            if (!a || !b)
                return '';
            return String(diffFullMonths(a, b));
        }
        case 'diffYears': {
            const a = parseDateOnly(acc);
            const b = parseDateOnly(next);
            if (!a || !b)
                return '';
            return String(diffFullYears(a, b));
        }
    }
}
function evalDateRef(tok) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    let extra = 0;
    if (tok.ref === 'tomorrow')
        extra = 1;
    else if (tok.ref === 'yesterday')
        extra = -1;
    const off = Number(tok.offsetDays ?? 0);
    d.setDate(d.getDate() + extra + (Number.isFinite(off) ? Math.round(off) : 0));
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseRepeaterArray(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw;
    if (typeof raw !== 'string')
        return [];
    const t = raw.trim();
    if (!t.startsWith('['))
        return [];
    try {
        const v = JSON.parse(t);
        return Array.isArray(v) ? v : [];
    }
    catch {
        return [];
    }
}
function evalRepeaterLookup(tok, formData) {
    const rawRepeater = fieldValueCandidates(tok.repeaterFieldId).map((key) => formData[key]).find((v) => v != null);
    const items = parseRepeaterArray(rawRepeater);
    const needles = splitValues(tok.needles).map((s) => s.toLowerCase());
    if (needles.length === 0)
        return String(tok.ifNotFound ?? '');
    const match = tok.match ?? 'contains';
    const sub = tok.subFieldId;
    if (!sub)
        return String(tok.ifNotFound ?? '');
    const collected = [];
    if (tok.scope === 'parent') {
        for (const it of items) {
            const v = it?.values?.[sub];
            if (v != null)
                collected.push(String(v));
        }
    }
    else {
        for (const it of items) {
            for (const ch of it?.children ?? []) {
                const v = ch?.values?.[sub];
                if (v != null)
                    collected.push(String(v));
            }
        }
    }
    const found = collected.some((raw) => {
        const val = raw.toLowerCase();
        if (!val)
            return false;
        return needles.some((n) => (match === 'equals' ? val === n : val.includes(n)));
    });
    return String((found ? tok.ifFound : tok.ifNotFound) ?? '');
}
function evalRepeaterAggregate(tok, formData, outerSeparator) {
    const rawRepeater = fieldValueCandidates(tok.repeaterFieldId).map((key) => formData[key]).find((v) => v != null);
    const items = parseRepeaterArray(rawRepeater);
    const subFieldIds = (tok.subFieldIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (subFieldIds.length === 0)
        return '';
    // Flatten down to the list of "row" sources we read from (each row is
    // a single values object — either a parent item or a child subitem).
    const rows = [];
    if (tok.scope === 'parent') {
        for (const it of items) {
            if (it?.values)
                rows.push(it.values);
        }
    }
    else {
        for (const it of items) {
            for (const ch of it?.children ?? []) {
                if (ch?.values)
                    rows.push(ch.values);
            }
        }
    }
    const fieldSeparator = tok.separator ?? outerSeparator;
    const itemSeparator = tok.itemSeparator ?? fieldSeparator;
    const dedupe = !!tok.group;
    const labelMap = tok.subFieldLabels ?? {};
    const labelFor = (sf) => {
        const l = labelMap[sf];
        return l && l.length > 0 ? l : sf;
    };
    // Determine global label position: explicit labelPosition (including null = "Sin etiqueta") wins;
    // fallback from legacy includeLabels only when the property is absent.
    const hasExplicitLabelPosition = Object.prototype.hasOwnProperty.call(tok, 'labelPosition');
    const globalLabelPos = hasExplicitLabelPosition
        ? (tok.labelPosition ?? null)
        : (tok.includeLabels ? 'before' : null);
    const labelSep = tok.labelSeparator ?? ': ';
    let globalLabel = null;
    if (globalLabelPos && subFieldIds.length > 0) {
        globalLabel = labelFor(subFieldIds[0]);
    }
    const perItem = [];
    const seenItem = new Set();
    for (const row of rows) {
        const parts = [];
        for (const sf of subFieldIds) {
            const v = row[sf];
            if (v == null)
                continue;
            const s = String(v).trim();
            if (s === '')
                continue;
            parts.push(s);
        }
        if (parts.length === 0)
            continue;
        const joined = parts.join(fieldSeparator);
        if (dedupe) {
            const key = joined.toLowerCase();
            if (seenItem.has(key))
                continue;
            seenItem.add(key);
        }
        perItem.push(joined);
    }
    const result = perItem.join(itemSeparator);
    if (!result)
        return '';
    if (globalLabelPos && globalLabel) {
        if (globalLabelPos === 'before') {
            return `${globalLabel}${labelSep}${result}`;
        }
        return `${result}${labelSep}${globalLabel}`;
    }
    return result;
}
/**
 * Resolve a list of tokens into a single string for one side (pdf or json).
 */
export function resolveConcatTokens(tokens, separator, ctx) {
    let acc = '';
    let started = false;
    let pendingFirstOp = null;
    for (const tok of tokens) {
        // 1) Compute raw value
        let raw = '';
        if (tok.kind === 'text') {
            raw = String(tok.value ?? '');
        }
        else if (tok.kind === 'repeaterLookup') {
            raw = evalRepeaterLookup(tok, ctx.formData);
        }
        else if (tok.kind === 'dateRef') {
            raw = evalDateRef(tok);
        }
        else if (tok.kind === 'repeaterAggregate') {
            raw = evalRepeaterAggregate(tok, ctx.formData, separator);
        }
        else {
            raw = ctx.resolveFieldValue(tok, ctx.side);
        }
        // 2) Apply transformations
        const transformed = applyTransforms(raw, tok.transforms);
        // 3) Evaluate condition (against transformed value if no fieldId set)
        if (tok.condition) {
            const useOwn = !tok.condition.fieldId;
            const ok = evaluateConcatTokenCondition(tok.condition, ctx.formData, useOwn ? transformed : undefined, ctx.getFieldOptions);
            if (!ok)
                continue;
        }
        // 4) Skip empty field tokens (text tokens are kept as-is to preserve literal whitespace if intended)
        const op = tok.op ?? 'concat';
        if (tok.kind === 'field' && transformed === '') {
            // For non-concat ops (diff/add/sub/...), a missing operand invalidates
            // the running result — otherwise the previous accumulator (often a raw
            // date) would leak into the output.
            if ((op !== 'concat' || pendingFirstOp) && started) {
                acc = '';
                started = false;
                pendingFirstOp = null;
            }
            continue;
        }
        // 5) Combine with accumulator
        if (!started) {
            // Some saved configs store the operation on the LEFT token (e.g.
            // "today" with op=diffYears followed by the birth-date field). Keep the
            // first value as the left operand, but only emit it if a later token
            // actually consumes the pending operation.
            acc = transformed;
            started = true;
            pendingFirstOp = op !== 'concat' ? op : null;
        }
        else {
            const combineOp = op !== 'concat' ? op : pendingFirstOp ?? op;
            acc = combine(acc, transformed, combineOp, separator);
            pendingFirstOp = null;
        }
    }
    return pendingFirstOp ? '' : acc;
}
