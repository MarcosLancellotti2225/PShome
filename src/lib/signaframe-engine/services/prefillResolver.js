/**
 * Resolves a prefill key against a parsed prefilled-data object.
 *
 * The key supports a small subset of jq-style path syntax:
 *   - dot notation:        datosGenerales.nombreAseguradoraSubstituye
 *   - leading dot:         .datosGenerales.nombreAseguradoraSubstituye
 *   - bracket notation:    datosGenerales["nombreAseguradoraSubstituye"]
 *   - array indices:       items[0].name  /  items.0.name
 *
 * Falls back to a flat lookup (legacy behaviour) when no dotted path matches.
 * Returns `undefined` if the path cannot be resolved.
 */
const COMPARISON_EXPRESSION_RE = /^(.+?)\s*(===|!==|==|!=)\s*(.+)$/;
function parseLiteral(raw) {
    if (raw.length >= 2) {
        const first = raw[0];
        const last = raw[raw.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            return raw.slice(1, -1);
        }
    }
    if (raw === 'true')
        return true;
    if (raw === 'false')
        return false;
    if (raw === 'null')
        return null;
    if (/^-?\d+(\.\d+)?$/.test(raw))
        return Number(raw);
    return raw;
}
function looseEquals(a, b) {
    if (a === b)
        return true;
    if (a == null || b == null)
        return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
/**
 * Splits a jq-like expression by top-level `|` (pipes), ignoring pipes inside
 * quoted strings or brackets. Returns the trimmed segments.
 */
function splitTopLevelPipes(expr) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let buf = '';
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (quote) {
            buf += ch;
            if (ch === quote && expr[i - 1] !== '\\')
                quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            buf += ch;
            continue;
        }
        if (ch === '(' || ch === '[') {
            depth++;
            buf += ch;
            continue;
        }
        if (ch === ')' || ch === ']') {
            depth--;
            buf += ch;
            continue;
        }
        if (ch === '|' && depth === 0) {
            parts.push(buf.trim());
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.trim())
        parts.push(buf.trim());
    return parts;
}
/**
 * Applies a jq-like filter stage to the current value. Supported filters:
 *   - split("x")           -> string.split(x)
 *   - split("x")[n]        -> string.split(x)[n]
 *   - join("x")            -> array.join(x)
 *   - length               -> .length
 *   - tostring / tonumber  -> coercions
 *   - trim / ascii_downcase / ascii_upcase
 *   - .a.b / [n] / ["k"]   -> further path traversal on the current value
 *   - . (identity)         -> no-op
 */
function applyFilterStage(value, stage) {
    let cur = value;
    let rest = stage.trim();
    if (rest === '' || rest === '.')
        return cur;
    while (rest.length > 0) {
        // Identity prefix
        if (rest.startsWith('.')) {
            rest = rest.slice(1);
            continue;
        }
        // split("sep") possibly followed by [index]
        let m = rest.match(/^split\(\s*(["'])(.*?)\1\s*\)/);
        if (m) {
            const sep = m[2];
            cur = typeof cur === 'string' ? cur.split(sep) : undefined;
            rest = rest.slice(m[0].length).trim();
            continue;
        }
        m = rest.match(/^join\(\s*(["'])(.*?)\1\s*\)/);
        if (m) {
            cur = Array.isArray(cur) ? cur.join(m[2]) : undefined;
            rest = rest.slice(m[0].length).trim();
            continue;
        }
        if (rest.startsWith('length')) {
            if (typeof cur === 'string' || Array.isArray(cur))
                cur = cur.length;
            else if (cur && typeof cur === 'object')
                cur = Object.keys(cur).length;
            else
                cur = undefined;
            rest = rest.slice('length'.length).trim();
            continue;
        }
        if (rest.startsWith('tostring')) {
            cur = cur == null ? undefined : String(cur);
            rest = rest.slice('tostring'.length).trim();
            continue;
        }
        if (rest.startsWith('tonumber')) {
            const n = Number(cur);
            cur = Number.isFinite(n) ? n : undefined;
            rest = rest.slice('tonumber'.length).trim();
            continue;
        }
        if (rest.startsWith('trim')) {
            cur = typeof cur === 'string' ? cur.trim() : cur;
            rest = rest.slice('trim'.length).trim();
            continue;
        }
        if (rest.startsWith('ascii_downcase')) {
            cur = typeof cur === 'string' ? cur.toLowerCase() : cur;
            rest = rest.slice('ascii_downcase'.length).trim();
            continue;
        }
        if (rest.startsWith('ascii_upcase')) {
            cur = typeof cur === 'string' ? cur.toUpperCase() : cur;
            rest = rest.slice('ascii_upcase'.length).trim();
            continue;
        }
        // [index] or ["key"]
        m = rest.match(/^\[\s*(\d+)\s*\]/);
        if (m) {
            const idx = Number(m[1]);
            cur = Array.isArray(cur) || typeof cur === 'string' ? cur[idx] : undefined;
            rest = rest.slice(m[0].length).trim();
            continue;
        }
        m = rest.match(/^\[\s*(["'])(.*?)\1\s*\]/);
        if (m) {
            const k = m[2];
            cur = cur && typeof cur === 'object' ? cur[k] : undefined;
            rest = rest.slice(m[0].length).trim();
            continue;
        }
        // .word (handled by stripping dot at top of loop, but allow bare word too)
        m = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
        if (m) {
            const k = m[1];
            cur = cur && typeof cur === 'object' ? cur[k] : undefined;
            rest = rest.slice(m[0].length).trim();
            continue;
        }
        // Unknown token — bail out.
        return undefined;
    }
    return cur;
}
export function resolvePrefillValue(data, key) {
    if (!data || !key)
        return undefined;
    const trimmed = key.trim();
    if (!trimmed)
        return undefined;
    // Comparison expressions: `path == "valor"` or `path != 'valor'` (also `===`/`!==`).
    // Returns a boolean by comparing the resolved value against the literal.
    // Useful to mark a checkbox/radio when a string field equals a given value.
    const cmpMatch = trimmed.match(COMPARISON_EXPRESSION_RE);
    if (cmpMatch) {
        const [, lhs, op, rhsRaw] = cmpMatch;
        const left = resolvePrefillValue(data, lhs.trim());
        const right = parseLiteral(rhsRaw.trim());
        const eq = looseEquals(left, right);
        return op.startsWith('!') ? !eq : eq;
    }
    // jq-style pipes: resolve the first segment as a path, then apply filters.
    const pipeSegments = splitTopLevelPipes(trimmed);
    if (pipeSegments.length > 1) {
        let cur = resolvePrefillValue(data, pipeSegments[0]);
        for (let i = 1; i < pipeSegments.length; i++) {
            if (cur === undefined)
                return undefined;
            cur = applyFilterStage(cur, pipeSegments[i]);
        }
        return cur;
    }
    // Legacy: exact flat key match wins (cheap, also handles keys that contain dots).
    if (Object.prototype.hasOwnProperty.call(data, trimmed)) {
        return data[trimmed];
    }
    // Tokenize: replace [n] / ["x"] / ['x'] with .n / .x, strip leading dot, split.
    const normalized = trimmed
        .replace(/\[\s*"([^"]+)"\s*\]/g, '.$1')
        .replace(/\[\s*'([^']+)'\s*\]/g, '.$1')
        .replace(/\[\s*(\d+)\s*\]/g, '.$1')
        .replace(/^\.+/, '');
    const parts = normalized.split('.').filter(Boolean);
    if (parts.length === 0)
        return undefined;
    let cur = data;
    for (const part of parts) {
        if (cur == null)
            return undefined;
        if (Array.isArray(cur)) {
            const idx = Number(part);
            if (!Number.isInteger(idx))
                return undefined;
            cur = cur[idx];
        }
        else if (typeof cur === 'object') {
            const obj = cur;
            if (Object.prototype.hasOwnProperty.call(obj, part)) {
                cur = obj[part];
            }
            else {
                // Case-insensitive fallback: backends may serialize keys in PascalCase
                // (e.g. "DatosFormulario") while prefillKey uses camelCase.
                const lower = part.toLowerCase();
                const matchKey = Object.keys(obj).find((k) => k.toLowerCase() === lower);
                cur = matchKey !== undefined ? obj[matchKey] : undefined;
            }
        }
        else {
            return undefined;
        }
    }
    return cur;
}
export function hasPrefillComparisonExpression(key) {
    return !!key?.trim().match(COMPARISON_EXPRESSION_RE);
}
/**
 * Coerces a resolved prefill value to the string form expected by form fields.
 * - booleans -> "true" / "false" (radios/checkboxes use this convention)
 * - null/undefined -> undefined (caller should skip)
 * - objects/arrays -> JSON stringified (best-effort fallback)
 */
export function coercePrefillValue(value) {
    if (value == null)
        return undefined;
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    try {
        return JSON.stringify(value);
    }
    catch {
        return undefined;
    }
}
/**
 * Interprets a resolved value as a boolean for radio/checkbox prefilling.
 * Accepts: true/false, "true"/"false" (case-insensitive), "1"/"0", "x"/"X",
 * "si"/"sí"/"yes", "no", and numbers (non-zero => true).
 * Returns `undefined` if the value cannot be interpreted as a boolean.
 */
export function coercePrefillBoolean(value) {
    if (value == null)
        return undefined;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value !== 0;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === '')
            return undefined;
        if (['true', '1', 'x', 'si', 'sí', 'yes', 'y'].includes(v))
            return true;
        if (['false', '0', 'no', 'n'].includes(v))
            return false;
    }
    return undefined;
}
/**
 * Grouped radios need an explicit boolean source per option. A shared numeric
 * code such as "1" must not be treated as truthy for every option, otherwise
 * the first radio in the group is selected accidentally. Numeric 1/0 are only
 * accepted when they come from an explicit comparison expression (`path == 1`).
 */
export function coerceGroupedRadioPrefillBoolean(value, fromComparisonExpression) {
    if (fromComparisonExpression)
        return coercePrefillBoolean(value);
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['true', 'x', 'si', 'sí', 'yes', 'y'].includes(v))
            return true;
        if (['false', 'no', 'n'].includes(v))
            return false;
    }
    return undefined;
}
