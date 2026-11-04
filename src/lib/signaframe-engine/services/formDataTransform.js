/**
 * Transforms form data for API submission.
 *
 * Returns two parallel records:
 *  - pdf:  values used to fill the source PDF (uses option.pdfValue for select/radio).
 *  - json: values returned in the final JSON output (uses option.jsonValue for select/radio).
 *
 * Rules:
 * - Checkbox: checked → "X" in pdf, true in json; unchecked → omitted.
 * - Radio (single): checked → "X" in pdf, true in json; unchecked → omitted.
 * - Radio (grouped): leader stores selected member id → expanded to "X" (pdf) and true (json) on the chosen member.
 * - Select: stored value is the option label; expanded to pdfValue / jsonValue.
 * - Signature fields: never sent.
 * - Keys have the "field_" prefix stripped.
 */
import { resolveConcatTokens, formatDateValue, } from './concatEngine.js';
import { optionMatchKeys, optionMatchesParentChain, valuesToString } from './optionItem.js';
import { parseDateForDateInput } from '../lib/dates.js';
import { formatTimeForJson, formatTimeForPdf, toCanonicalTime, formatUsesSeconds, displayTimeFormat } from '../lib/times.js';
import { formatNumber, parseNumberLoose } from '../lib/numberFormat.js';
/**
 * Numeric fields must land in the JSON envelope as real numbers (`"peso": 95`)
 * and not as quoted strings. When a JSON number format is configured we keep it
 * only if the formatted text is still a valid JSON number (e.g. "95.50");
 * otherwise (thousands separators, comma decimals…) the string is preserved.
 */
function numberJsonValue(raw, parsed, fmt) {
    if (fmt) {
        const text = formatNumber(parsed ?? raw, fmt);
        const n = Number(text);
        return text.trim() !== '' && Number.isFinite(n) ? n : text;
    }
    if (parsed != null)
        return parsed;
    return raw == null ? '' : String(raw);
}
/**
 * Select options carry free-text values that may represent codes, numbers or
 * booleans. `selectJsonValueType` states how the chosen option's JSON value must
 * be typed in the output envelope. Unparseable values stay as text.
 */
function coerceSelectJsonValue(raw, type) {
    const text = raw == null ? '' : String(raw).trim();
    if (!type || type === 'text' || text === '')
        return raw;
    if (type === 'number') {
        const n = Number(text.replace(',', '.'));
        return Number.isFinite(n) ? n : raw;
    }
    const low = text.toLowerCase();
    if (['true', '1', 'si', 'sí', 'x', 'y', 'yes'].includes(low))
        return true;
    if (['false', '0', 'no', 'n'].includes(low))
        return false;
    return raw;
}
function tokenizePath(raw) {
    // First convert string-bracket notation to dot notation: a["b"] -> a.b
    const dotted = raw
        .replace(/\[\s*"([^"]+)"\s*\]/g, '.$1')
        .replace(/\[\s*'([^']+)'\s*\]/g, '.$1');
    const tokens = [];
    // Match either: bare identifier, [number], or .number  (in any order)
    const re = /([^.\[\]]+)|\[\s*(\d+)\s*\]/g;
    let m;
    while ((m = re.exec(dotted)) !== null) {
        if (m[2] !== undefined) {
            tokens.push({ key: m[2], isIndex: true });
        }
        else {
            const part = m[1];
            // Bare numeric segment via dot notation (a.0.b) → also treat as index.
            if (/^\d+$/.test(part))
                tokens.push({ key: part, isIndex: true });
            else
                tokens.push({ key: part, isIndex: false });
        }
    }
    return tokens;
}
// Characters that should never appear in a jq-style output path. If we find
// any of them we assume the user typed a JS expression / formula by mistake
// and we fall back to writing the value as a single flat key — otherwise the
// path would be split on `.` and produce nonsensical nested objects like
// `{ Math: { "floor((new Date() - new Date(datosFormulario": { … } } }`.
const INVALID_PATH_CHAR_RE = /[()\s+*/%<>!?,;:&|^=]/;
function isObjectLike(value) {
    return value != null && typeof value === 'object';
}
function setByPath(target, path, fallbackKey, value) {
    const raw = (path ?? "").trim();
    if (!raw) {
        target[fallbackKey] = value;
        return;
    }
    if (INVALID_PATH_CHAR_RE.test(raw)) {
        // Treat the whole string as a flat property name so the user can spot
        // their mistake at a glance instead of seeing a weird nested tree.
        target[raw] = value;
        return;
    }
    const tokens = tokenizePath(raw);
    if (tokens.length === 0) {
        target[fallbackKey] = value;
        return;
    }
    let cur = target;
    for (let i = 0; i < tokens.length - 1; i++) {
        const tok = tokens[i];
        const nextTok = tokens[i + 1];
        const childShouldBeArray = nextTok.isIndex;
        const accessKey = tok.isIndex ? Number(tok.key) : tok.key;
        const existing = cur[accessKey];
        let child;
        if (isObjectLike(existing) && Array.isArray(existing) === childShouldBeArray) {
            child = existing;
        }
        else if (Array.isArray(existing) && !childShouldBeArray) {
            // A later field may be configured as `personas.ocupacion` while earlier
            // fields already established `personas` as an array via `personas[0]...`.
            // Never replace the array with an object; write the index-less child path
            // into the first item instead so the captured JSON keeps its array shape.
            const first = existing[0];
            child = isObjectLike(first) && !Array.isArray(first) ? first : {};
            existing[0] = child;
        }
        else if (isObjectLike(existing) && !Array.isArray(existing) && childShouldBeArray) {
            // If an index-less path created an object first and a later indexed path
            // proves the node is an array, upgrade it without discarding the values.
            child = [existing];
            cur[accessKey] = child;
        }
        else {
            child = childShouldBeArray ? [] : {};
            cur[accessKey] = child;
        }
        cur = child;
    }
    const last = tokens[tokens.length - 1];
    const lastKey = last.isIndex ? Number(last.key) : last.key;
    cur[lastKey] = value;
}
function getByPath(source, path) {
    const raw = (path ?? '').trim();
    if (!raw || source == null || typeof source !== 'object')
        return undefined;
    const tokens = tokenizePath(raw);
    if (tokens.length === 0)
        return undefined;
    let cur = source;
    for (const tok of tokens) {
        if (cur == null || typeof cur !== 'object')
            return undefined;
        if (Array.isArray(cur) && !tok.isIndex) {
            cur = cur[0];
            if (cur == null || typeof cur !== 'object')
                return undefined;
        }
        const accessKey = tok.isIndex ? Number(tok.key) : tok.key;
        cur = cur[accessKey];
    }
    return cur;
}
const stripFieldPrefix = (id) => id.startsWith('field_') ? id.slice(6) : id;
function buildOptionLookup(options, parentJsonValue = '', grandParentJsonValue = '', useGrandParent = false) {
    const map = new Map();
    (options ?? []).forEach((opt) => {
        if (typeof opt === 'string') {
            const entry = { pdfValue: opt, jsonValue: opt };
            optionMatchKeys(opt).forEach((k) => { if (!map.has(k))
                map.set(k, entry); });
            if (!map.has(opt))
                map.set(opt, entry);
        }
        else if (opt && opt.label) {
            if (!optionPassesParents(opt, parentJsonValue, grandParentJsonValue, useGrandParent))
                return;
            const legacyValue = opt.value != null && opt.value !== '' ? String(opt.value) : opt.label;
            const pdfValue = opt.pdfValue && opt.pdfValue !== '' ? opt.pdfValue : legacyValue;
            const jsonValue = opt.jsonValue && opt.jsonValue !== '' ? opt.jsonValue : legacyValue;
            const entry = { pdfValue, jsonValue };
            // Match against configured values only (label / legacy value / pdfValue / jsonValue), tolerant
            // to case, whitespace and leading zeros on numeric values, so the form
            // value is correctly translated even when stored as the pdfValue/jsonValue.
            [opt.label, legacyValue, pdfValue, jsonValue].forEach((candidate) => {
                if (candidate == null || candidate === '')
                    return;
                optionMatchKeys(candidate).forEach((k) => { if (!map.has(k))
                    map.set(k, entry); });
            });
        }
    });
    return map;
}
function buildOptionLabelLookup(options, parentJsonValue = '', grandParentJsonValue = '', useGrandParent = false) {
    const map = new Map();
    (options ?? []).forEach((opt) => {
        if (typeof opt === 'string') {
            optionMatchKeys(opt).forEach((k) => { if (!map.has(k))
                map.set(k, opt); });
        }
        else if (opt && opt.label) {
            if (!optionPassesParents(opt, parentJsonValue, grandParentJsonValue, useGrandParent))
                return;
            const legacyValue = opt.value != null && opt.value !== '' ? String(opt.value) : opt.label;
            const pdfValue = opt.pdfValue && opt.pdfValue !== '' ? opt.pdfValue : legacyValue;
            const jsonValue = opt.jsonValue && opt.jsonValue !== '' ? opt.jsonValue : legacyValue;
            [opt.label, legacyValue, pdfValue, jsonValue].forEach((candidate) => {
                optionMatchKeys(candidate).forEach((k) => { if (!map.has(k))
                    map.set(k, opt.label); });
            });
        }
    });
    return map;
}
function optionPassesParents(opt, parentJsonValue, grandParentJsonValue, useGrandParent) {
    const pv = valuesToString(opt.parentValues);
    const gpv = valuesToString(opt.grandParentValues);
    if (!parentJsonValue && !gpv)
        return true;
    if (!pv && !gpv)
        return true;
    return optionMatchesParentChain({
        parentValues: pv,
        grandParentValues: gpv,
        parentValue: parentJsonValue,
        grandParentValue: grandParentJsonValue,
        useGrandParent,
    });
}
function parentValuesMatch(parentValues, parentJsonValue) {
    const allowed = (parentValues ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length === 0)
        return true;
    const parentKeys = new Set(optionMatchKeys(parentJsonValue));
    return allowed.some((candidate) => optionMatchKeys(candidate).some((k) => parentKeys.has(k)));
}
export function transformFormDataForApi(formData, fields, options) {
    const fieldById = new Map();
    fields.forEach((f) => {
        fieldById.set(f.id, f);
        if (f.id.startsWith('field_'))
            fieldById.set(f.id.slice(6), f);
        else
            fieldById.set(`field_${f.id}`, f);
    });
    // Build radio group membership: leaderId → memberIds
    const radioFields = fields.filter((f) => f.type === 'radio');
    const radioIds = new Set(radioFields.map((f) => f.id));
    const leaderByFieldId = new Map();
    const memberIdsByLeaderId = new Map();
    const adjacency = new Map();
    radioFields.forEach((f) => adjacency.set(f.id, new Set()));
    radioFields.forEach((f) => {
        (f.radioGroupFields ?? []).forEach((targetId) => {
            if (!radioIds.has(targetId))
                return;
            adjacency.get(f.id)?.add(targetId);
            adjacency.get(targetId)?.add(f.id);
        });
    });
    const visited = new Set();
    for (const field of radioFields) {
        if (visited.has(field.id))
            continue;
        const component = new Set();
        const queue = [field.id];
        while (queue.length) {
            const current = queue.pop();
            if (component.has(current))
                continue;
            component.add(current);
            visited.add(current);
            adjacency.get(current)?.forEach((n) => {
                if (!component.has(n))
                    queue.push(n);
            });
        }
        const memberIds = radioFields.filter((rf) => component.has(rf.id)).map((rf) => rf.id);
        const leaderId = memberIds[0] ?? field.id;
        memberIds.forEach((mid) => leaderByFieldId.set(mid, leaderId));
        memberIdsByLeaderId.set(leaderId, memberIds);
    }
    const pdf = {};
    const json = {};
    const buttons = {};
    const processedRadioLeaders = new Set();
    const normalizeTargetId = (id) => stripFieldPrefix(id);
    const hasSubmittedValueForTarget = (targetId) => {
        const bare = stripFieldPrefix(targetId);
        const targetField = fieldById.get(targetId) ?? fieldById.get(bare) ?? fieldById.get(`field_${bare}`);
        const keys = [targetId, bare, `field_${bare}`, targetField?.id].filter(Boolean);
        return keys.some((k) => {
            const v = formData[k];
            return v != null && String(v).trim() !== '';
        });
    };
    // Strips invisible repeater overflow markers (`<<<rep:fieldId>>>…<<</rep:fieldId>>>`)
    // from any string value so they never reach the PDF or JSON output.
    const REPEATER_MARKER_RE = /<<<\/?rep:[A-Za-z0-9_\-]+>>>/g;
    function stripRepeaterMarkers(v) {
        if (typeof v === 'string')
            return v.replace(REPEATER_MARKER_RE, '');
        return v;
    }
    function setBoth(key, pdfVal, jsonVal, fieldInfo) {
        pdf[key] = stripRepeaterMarkers(pdfVal);
        if (fieldInfo?.excludeFromJson)
            return;
        // JSON output is opt-in: a field only appears in the __json envelope when
        // it has an explicit `jsonOutputPath` configured. If the path is empty,
        // the field is omitted from JSON (PDF still receives it at the root).
        const path = (fieldInfo?.jsonOutputPath ?? '').trim();
        if (!path)
            return;
        setByPath(json, path, key, stripRepeaterMarkers(jsonVal));
    }
    function resolveSelectJsonValue(fieldId, seen = new Set()) {
        if (!fieldId || seen.has(fieldId))
            return '';
        seen.add(fieldId);
        const bare = stripFieldPrefix(fieldId);
        const field = fieldById.get(fieldId) ?? fieldById.get(bare) ?? fieldById.get(`field_${bare}`);
        const raw = formData[fieldId] ?? formData[bare] ?? formData[`field_${bare}`];
        if (raw == null || String(raw).trim() === '')
            return '';
        const lookup = buildOptionLookup(field?.options, resolveSelectJsonValue(field?.parentFieldId, new Set(seen)), resolveSelectJsonValue(field?.grandParentFieldId, new Set(seen)), !!field?.grandParentFieldId);
        for (const k of optionMatchKeys(raw)) {
            const mapped = lookup.get(k);
            if (mapped)
                return mapped.jsonValue;
        }
        return String(raw).trim();
    }
    for (const [rawKey, value] of Object.entries(formData)) {
        const key = rawKey.startsWith('field_') ? rawKey.slice(6) : rawKey;
        const field = fieldById.get(rawKey) ?? fieldById.get(key);
        const fieldType = field?.type;
        if (fieldType === 'signature' || fieldType === 'label')
            continue;
        if (fieldType === 'button') {
            const v = String(value ?? '').trim();
            buttons[key] = v === 'active' ? 'active' : '';
            continue;
        }
        // Helper: resolve checked values, honoring per-field overrides.
        const checkedValuesFor = (f) => {
            const pdf = f?.checkedPdfValue != null && f.checkedPdfValue !== ''
                ? f.checkedPdfValue
                : 'X';
            const json = f?.checkedJsonValue != null && f.checkedJsonValue !== ''
                ? f.checkedJsonValue
                : true;
            return { pdf, json };
        };
        if (fieldType === 'boolean') {
            const s = String(value ?? '').trim().toLowerCase();
            if (s === '')
                continue;
            const b = s === 'true' || s === '1' || s === 'x' || s === 'si' || s === 'sí';
            setBoth(key, b ? 'Sí' : 'No', b, field);
            continue;
        }
        if (fieldType === 'checkbox') {
            if (value === 'true' || value === true) {
                const v = checkedValuesFor(field);
                setBoth(key, v.pdf, v.json, field);
            }
            continue;
        }
        if (fieldType === 'radio') {
            const leaderId = leaderByFieldId.get(rawKey) ?? leaderByFieldId.get(key);
            if (leaderId && !processedRadioLeaders.has(leaderId)) {
                processedRadioLeaders.add(leaderId);
                const memberIds = memberIdsByLeaderId.get(leaderId) ?? [];
                const leaderKey = leaderId.startsWith('field_') ? leaderId.slice(6) : leaderId;
                const leaderField = fieldById.get(leaderId) ?? fieldById.get(leaderKey);
                const selectedValue = formData[leaderId] ?? formData[`field_${leaderId}`];
                if (memberIds.length > 1) {
                    memberIds.forEach((mid) => {
                        const midKey = mid.startsWith('field_') ? mid.slice(6) : mid;
                        if (String(selectedValue) === mid || String(selectedValue) === midKey) {
                            const memberField = fieldById.get(mid) ?? fieldById.get(midKey);
                            const v = checkedValuesFor(memberField);
                            setBoth(midKey, v.pdf, v.json, memberField);
                        }
                    });
                }
                else {
                    if (selectedValue === 'true' || selectedValue === true) {
                        const v = checkedValuesFor(leaderField);
                        setBoth(leaderKey, v.pdf, v.json, leaderField);
                    }
                }
            }
            continue;
        }
        if (fieldType === 'select' && field) {
            const lookup = buildOptionLookup(field.options, resolveSelectJsonValue(field.parentFieldId), resolveSelectJsonValue(field.grandParentFieldId), !!field.grandParentFieldId);
            const keys = optionMatchKeys(value);
            let mapped;
            for (const k of keys) {
                mapped = lookup.get(k);
                if (mapped)
                    break;
            }
            if (mapped) {
                setBoth(key, mapped.pdfValue, coerceSelectJsonValue(mapped.jsonValue, field.selectJsonValueType), field);
            }
            continue;
        }
        // Auto-fill by concatenation: recompute pdf and json values from tokens
        // so that select sources contribute their pdfValue/jsonValue (or visible
        // label) according to the configured `valueSource`.
        if (field?.autoFillConcat && (field.autoFillConcat.parts?.length || field.autoFillConcat.sourceFieldIds?.length)) {
            resolveConcatField(field, key);
            continue;
        }
        // Normal field
        if (fieldType === 'date' && typeof value === 'string' && value) {
            const pdfFmt = field?.pdfDateFormat ?? field?.dateFormat ?? null;
            const jsonFmt = field?.jsonDateFormat ?? field?.dateFormat ?? null;
            const pdfVal = formatDateValue(value, pdfFmt);
            const jsonVal = formatDateValue(value, jsonFmt);
            setBoth(key, pdfVal, jsonVal, field);
            continue;
        }
        if (fieldType === 'time' && typeof value === 'string' && value.trim() !== '') {
            const pdfVal = formatTimeForPdf(value, field) || value;
            const jsonVal = formatTimeForJson(value, field) || value;
            setBoth(key, pdfVal, jsonVal, field);
            continue;
        }
        if (fieldType === 'number' && value != null && String(value).trim() !== '') {
            const parsed = parseNumberLoose(value);
            const pdfVal = field?.pdfNumberFormat
                ? formatNumber(parsed ?? value, field.pdfNumberFormat)
                : (parsed != null ? String(parsed) : String(value));
            // JSON output must be a real numeric value, not a quoted string.
            // If a JSON number format is configured, keep it only when the formatted
            // text is still a valid JSON number (otherwise it must stay a string).
            const jsonVal = numberJsonValue(value, parsed, field?.jsonNumberFormat);
            setBoth(key, pdfVal, jsonVal, field);
            continue;
        }
        setBoth(key, value, value, field);
    }
    // Ensure every button has an entry in the bucket so the server's replacement
    // semantics reflect the current UI state (inactive buttons land as '').
    // We intentionally do NOT auto-activate buttons based on target data: the
    // active state must reflect the user's explicit interaction, otherwise
    // self-hiding "+ Add" style buttons disappear permanently after a reload.
    for (const f of fields) {
        if (f.type !== 'button')
            continue;
        const key = stripFieldPrefix(f.id);
        if (key in buttons)
            continue;
        buttons[key] = '';
    }
    // Concat fields may be hidden/virtual and therefore not present in formData.
    // Make sure every concat field is also resolved exactly once.
    const processedConcatIds = new Set();
    for (const [rawKey] of Object.entries(formData)) {
        const key = rawKey.startsWith('field_') ? rawKey.slice(6) : rawKey;
        const f = fieldById.get(rawKey) ?? fieldById.get(key);
        if (f?.autoFillConcat)
            processedConcatIds.add(f.id);
    }
    for (const f of fields) {
        if (!f.autoFillConcat)
            continue;
        if (processedConcatIds.has(f.id))
            continue;
        const key = f.id.startsWith('field_') ? f.id.slice(6) : f.id;
        resolveConcatField(f, key);
    }
    function resolveConcatField(field, key) {
        const cfg = field.autoFillConcat;
        const sep = cfg.separator ?? ' ';
        const tokens = cfg.parts && cfg.parts.length > 0
            ? cfg.parts
            : (cfg.sourceFieldIds ?? []).map((id) => ({ kind: 'field', fieldId: id }));
        const checkedValuesFor = (f) => {
            const p = f?.checkedPdfValue != null && f.checkedPdfValue !== '' ? f.checkedPdfValue : 'X';
            const j = f?.checkedJsonValue != null && f.checkedJsonValue !== '' ? f.checkedJsonValue : 'true';
            return { pdf: String(p), json: String(j) };
        };
        const resolveFieldValue = (tok, side) => {
            const src = fieldById.get(tok.fieldId) ?? fieldById.get(`field_${tok.fieldId}`);
            // Radio token: emit the configured checked value when this radio is selected.
            if (src?.type === 'radio') {
                const leaderId = leaderByFieldId.get(src.id) ?? src.id;
                const memberIds = memberIdsByLeaderId.get(leaderId) ?? [leaderId];
                const selectedValue = formData[leaderId] ?? formData[`field_${leaderId}`];
                let isChecked = false;
                if (memberIds.length > 1) {
                    const midKey = src.id.startsWith('field_') ? src.id.slice(6) : src.id;
                    isChecked = String(selectedValue) === src.id || String(selectedValue) === midKey;
                }
                else {
                    isChecked = selectedValue === 'true' || selectedValue === true;
                }
                if (!isChecked)
                    return '';
                const v = checkedValuesFor(src);
                return side === 'json' ? v.json : v.pdf;
            }
            const strippedId = tok.fieldId.startsWith('field_') ? tok.fieldId.slice(6) : tok.fieldId;
            const raw = formData[tok.fieldId] ??
                formData[`field_${tok.fieldId}`] ??
                formData[strippedId] ??
                formData[`field_${strippedId}`] ??
                '';
            const visible = String(raw ?? '').trim();
            if (!visible)
                return '';
            if (src && src.type === 'select') {
                const lookup = buildOptionLookup(src.options);
                let mapped;
                for (const k of optionMatchKeys(visible)) {
                    mapped = lookup.get(k);
                    if (mapped)
                        break;
                }
                if (mapped)
                    return side === 'json' ? mapped.jsonValue : mapped.pdfValue;
                return visible;
            }
            if (src?.type === 'checkbox') {
                if (visible !== 'true' && visible !== 'X')
                    return '';
                const v = checkedValuesFor(src);
                return side === 'json' ? v.json : v.pdf;
            }
            // Date source: honour the source field's configured PDF/JSON format
            // instead of leaking the raw ISO value into the concatenation.
            if (src?.type === 'date' && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(visible)) {
                const fmt = side === 'json'
                    ? (src.jsonDateFormat ?? src.dateFormat ?? null)
                    : (src.pdfDateFormat ?? src.dateFormat ?? null);
                return formatDateValue(visible, fmt);
            }
            if (src?.type === 'time' && visible.trim() !== '') {
                return (side === 'json' ? formatTimeForJson(visible, src) : formatTimeForPdf(visible, src)) || visible;
            }
            return visible;
        };
        const pdfVal = resolveConcatTokens(tokens, sep, {
            side: 'pdf',
            formData: formData,
            resolveFieldValue,
        });
        const jsonVal = resolveConcatTokens(tokens, sep, {
            side: 'json',
            formData: formData,
            resolveFieldValue,
        });
        // Fallback: if the concat sources resolve to empty (e.g. virtual/prefill
        // case where the source fields aren't present but the target itself was
        // pre-loaded from inputDataJson), use the stored formData value so the
        // prefill survives into __pdf / __json.
        let finalPdf = pdfVal;
        let finalJson = jsonVal;
        if (finalPdf === '' && finalJson === '') {
            // The stored-value fallback only covers the "virtual prefill" case: the
            // target was pre-loaded but none of its sources/conditions exist in the
            // current form data. If any referenced field IS part of the form, an
            // empty result is a real result (e.g. an unmet token condition) and the
            // field must be omitted instead of leaking a stale value.
            const referencedIds = new Set();
            for (const tok of tokens) {
                const anyTok = tok;
                if (anyTok.fieldId)
                    referencedIds.add(String(anyTok.fieldId));
                if (anyTok.repeaterFieldId)
                    referencedIds.add(String(anyTok.repeaterFieldId));
                if (anyTok.condition?.fieldId)
                    referencedIds.add(String(anyTok.condition.fieldId));
            }
            const isKnownSource = Array.from(referencedIds).some((id) => {
                const stripped = stripFieldPrefix(id);
                return (fieldById.has(id) ||
                    fieldById.has(`field_${stripped}`) ||
                    fieldById.has(stripped) ||
                    id in formData ||
                    `field_${stripped}` in formData ||
                    stripped in formData);
            });
            if (isKnownSource)
                return;
            const stored = formData[field.id] ?? formData[`field_${stripFieldPrefix(field.id)}`] ?? formData[stripFieldPrefix(field.id)];
            const storedStr = stored == null ? '' : String(stored).trim();
            if (storedStr === '')
                return;
            finalPdf = storedStr;
            finalJson = storedStr;
        }
        // Date fields resolved via concat (e.g. a `dateRef` token) still must honour
        // the configured PDF/JSON date formats — otherwise they leak the raw ISO value.
        if (field.type === 'date') {
            const isDateLike = (s) => /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s.trim());
            const pdfFmt = field.pdfDateFormat ?? field.dateFormat ?? null;
            const jsonFmt = field.jsonDateFormat ?? field.dateFormat ?? null;
            if (typeof finalPdf === 'string' && isDateLike(finalPdf))
                finalPdf = formatDateValue(finalPdf, pdfFmt);
            if (typeof finalJson === 'string' && isDateLike(finalJson))
                finalJson = formatDateValue(finalJson, jsonFmt);
        }
        // Numeric fields resolved via concat must also land in the JSON envelope as
        // real numbers, not quoted strings.
        let jsonOut = finalJson;
        if (field.type === 'number' && String(finalJson ?? '').trim() !== '') {
            jsonOut = numberJsonValue(finalJson, parseNumberLoose(finalJson), field.jsonNumberFormat ?? null);
        }
        setBoth(key, finalPdf, jsonOut, field);
    }
    // Repeater → JSON envelope: for any repeater field with a `jsonSlotPattern`
    // (or via the default pattern based on the field id), expand the pattern per
    // item × subfield (and per child) and write into the json envelope.
    for (const f of fields) {
        if (f.type !== 'repeater' || !f.repeaterConfig)
            continue;
        const bare = stripFieldPrefix(f.id);
        const raw = formData[f.id] ?? formData[bare] ?? formData[`field_${bare}`];
        let items = [];
        if (Array.isArray(raw))
            items = raw;
        else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
            try {
                const v = JSON.parse(raw);
                if (Array.isArray(v))
                    items = v;
            }
            catch { /* noop */ }
        }
        if (items.length === 0)
            continue;
        const expand = (pat, vars) => pat.replace(/\{(\w+)\}/g, (_, k) => {
            const v = vars[k];
            return v == null ? '' : String(v);
        });
        const cfg = f.repeaterConfig;
        const parentPattern = cfg.jsonSlotPattern || `${bare}[{i0}].{sub}`;
        const parentSubs = cfg.fields ?? [];
        const formatSubVal = (sf, raw) => {
            if (raw == null)
                return '';
            if (sf.type === 'time' && typeof raw === 'string' && raw.trim() !== '') {
                return formatTimeForJson(raw, sf) || raw;
            }
            if (sf.type === 'date' && typeof raw === 'string' && raw.trim() !== '') {
                const fmt = sf.jsonDateFormat ?? sf.dateFormat ?? null;
                if (fmt)
                    return formatDateValue(raw, fmt);
            }
            if (sf.type === 'number' && String(raw).trim() !== '') {
                return numberJsonValue(raw, parseNumberLoose(raw), sf.jsonNumberFormat ?? null);
            }
            if (sf.type === 'select' && String(raw).trim() !== '') {
                const mapped = buildOptionLookup(sf.options).get(String(raw).trim());
                const jsonRaw = mapped ? mapped.jsonValue : raw;
                return coerceSelectJsonValue(jsonRaw, sf.selectJsonValueType);
            }
            return raw;
        };
        items.forEach((item, i) => {
            for (const sf of parentSubs) {
                const path = expand(parentPattern, { i: i, i0: i, i1: i + 1, sub: sf.id });
                if (!path)
                    continue;
                const val = formatSubVal(sf, item?.values?.[sf.id]);
                setByPath(json, path, sf.id, val ?? '');
            }
        });
        const child = cfg.child;
        if (child && (child.fields?.length ?? 0) > 0) {
            const childPattern = child.jsonSlotPattern || `${bare}[{i0}].children[{j0}].{sub}`;
            const childSubs = child.fields ?? [];
            items.forEach((item, i) => {
                (item.children ?? []).forEach((c, j) => {
                    for (const sf of childSubs) {
                        const path = expand(childPattern, { i: i, i0: i, i1: i + 1, j: j, j0: j, j1: j + 1, sub: sf.id });
                        if (!path)
                            continue;
                        const val = formatSubVal(sf, c?.values?.[sf.id]);
                        setByPath(json, path, sf.id, val ?? '');
                    }
                });
            });
        }
    }
    // Valores NULL del JSON de entrada: si el campo que se pre-rellena desde esa
    // ruta no ha recibido ningún valor, la ruta de salida debe emitirse como
    // `null` explícito (y no omitirse), para no perder la información.
    for (const { key, path } of options?.nullJsonPaths ?? []) {
        const p = (path ?? '').trim();
        if (!p)
            continue;
        const existing = getByPath(json, p);
        if (existing !== undefined && existing !== '' && existing !== null)
            continue;
        setByPath(json, p, key, null);
    }
    return { pdf, json: orderJsonRootKeys(json), buttons };
}
/**
 * Garantiza un orden estable de las claves raíz del envelope `__json`:
 * primero `encabezado`, después `datosFormulario` y a continuación el resto
 * en su orden de inserción. El orden de las claves de un objeto JS depende del
 * orden en que los campos se procesan, por lo que sin esto la salida podía
 * alternar entre `{ datosFormulario, encabezado }` y `{ encabezado, datosFormulario }`.
 */
export function orderJsonRootKeys(json) {
    const PRIORITY = ['encabezado', 'datosFormulario'];
    const ordered = {};
    for (const key of PRIORITY) {
        if (Object.prototype.hasOwnProperty.call(json, key))
            ordered[key] = json[key];
    }
    for (const key of Object.keys(json)) {
        if (PRIORITY.includes(key))
            continue;
        ordered[key] = json[key];
    }
    return ordered;
}
/**
 * Reverse of `transformFormDataForApi` (best-effort) used to seed the form
 * UI from `capturedData` returned by the backend.
 *
 * `capturedData` may have one of two shapes:
 *  - Legacy:  { fieldId: rawValue, ... }
 *  - Current: { __pdf: { fieldId: pdfValue, ... }, __json: {...} }
 *
 * For UI population we always prefer `__pdf`, then translate per field type:
 *  - select  → resolve the option whose pdfValue matches and use its label
 *  - checkbox/radio → "X" → "true" so the renderer marks them as checked
 *  - other   → use the raw string
 */
export function formDataFromCaptured(captured, fields) {
    const out = {};
    if (!captured || typeof captured !== 'object')
        return out;
    const pdfMap = captured.__pdf && typeof captured.__pdf === 'object'
        ? captured.__pdf
        : captured;
    const jsonMap = captured.__json && typeof captured.__json === 'object'
        ? captured.__json
        : null;
    const fieldByKey = new Map();
    fields.forEach((f) => {
        fieldByKey.set(f.id, f);
        // Index also with/without the optional `field_` prefix so lookups by the
        // stripped key (as returned by the API) succeed. These canonical aliases
        // must always win over PDF source names.
        if (f.id.startsWith('field_'))
            fieldByKey.set(f.id.slice(6), f);
        else
            fieldByKey.set(`field_${f.id}`, f);
    });
    fields.forEach((f) => {
        const sourceName = f.sourceMeta?.sourceName;
        if (sourceName && !fieldByKey.has(sourceName))
            fieldByKey.set(sourceName, f);
        (f.sourceMeta?.sourceNames ?? []).forEach((name) => {
            if (name && !fieldByKey.has(name))
                fieldByKey.set(name, f);
        });
    });
    // Build radio-group membership (mirrors transformFormDataForApi).
    const radioFields = fields.filter((f) => f.type === 'radio');
    const radioIds = new Set(radioFields.map((f) => f.id));
    const adjacency = new Map();
    radioFields.forEach((f) => adjacency.set(f.id, new Set()));
    radioFields.forEach((f) => {
        (f.radioGroupFields ?? []).forEach((targetId) => {
            if (!radioIds.has(targetId))
                return;
            adjacency.get(f.id)?.add(targetId);
            adjacency.get(targetId)?.add(f.id);
        });
    });
    const leaderByFieldId = new Map();
    const memberCountByLeaderId = new Map();
    const visitedRadios = new Set();
    for (const rf of radioFields) {
        if (visitedRadios.has(rf.id))
            continue;
        const component = new Set();
        const queue = [rf.id];
        while (queue.length) {
            const cur = queue.pop();
            if (component.has(cur))
                continue;
            component.add(cur);
            visitedRadios.add(cur);
            adjacency.get(cur)?.forEach((n) => {
                if (!component.has(n))
                    queue.push(n);
            });
        }
        const memberIds = radioFields.filter((m) => component.has(m.id)).map((m) => m.id);
        const leaderId = memberIds[0] ?? rf.id;
        memberIds.forEach((mid) => leaderByFieldId.set(mid, leaderId));
        memberCountByLeaderId.set(leaderId, memberIds.length);
    }
    const capturedValueForField = (field) => {
        const bare = stripFieldPrefix(field.id);
        if (field.id in pdfMap)
            return pdfMap[field.id];
        if (bare in pdfMap)
            return pdfMap[bare];
        if (`field_${bare}` in pdfMap)
            return pdfMap[`field_${bare}`];
        const sourceName = field.sourceMeta?.sourceName;
        if (sourceName && sourceName in pdfMap)
            return pdfMap[sourceName];
        for (const name of field.sourceMeta?.sourceNames ?? []) {
            if (name && name in pdfMap)
                return pdfMap[name];
        }
        return undefined;
    };
    // Cuántos campos comparten cada `jsonOutputPath`. Cuando dos variantes
    // (p. ej. dos listas mutuamente excluyentes) escriben en la misma ruta JSON,
    // el valor del envelope NO identifica a cuál pertenece: hidratar por esa
    // ruta rellenaría ambas. En ese caso exigimos que el campo tenga su propia
    // entrada en `__pdf` (que sí está indexada por id de campo).
    const jsonPathUsage = new Map();
    fields.forEach((f) => {
        if (f.excludeFromJson)
            return;
        const p = (f.jsonOutputPath ?? '').trim();
        if (!p)
            return;
        jsonPathUsage.set(p, (jsonPathUsage.get(p) ?? 0) + 1);
    });
    const capturedJsonValueForField = (field) => {
        if (!jsonMap || field.excludeFromJson)
            return undefined;
        const path = (field.jsonOutputPath ?? '').trim();
        if (!path)
            return undefined;
        if ((jsonPathUsage.get(path) ?? 0) > 1) {
            const own = capturedValueForField(field);
            if (own == null || String(own).trim() === '')
                return undefined;
        }
        return getByPath(jsonMap, path);
    };
    const resolveCapturedSelectJsonValue = (field, seen = new Set()) => {
        if (!field || seen.has(field.id))
            return '';
        seen.add(field.id);
        const jsonRaw = capturedJsonValueForField(field);
        if (jsonRaw != null && String(jsonRaw).trim() !== '')
            return String(jsonRaw).trim();
        const raw = capturedValueForField(field);
        if (raw == null || String(raw).trim() === '')
            return '';
        const bareParent = field.parentFieldId ? stripFieldPrefix(field.parentFieldId) : '';
        const parentField = bareParent ? fieldByKey.get(field.parentFieldId) ?? fieldByKey.get(bareParent) ?? fieldByKey.get(`field_${bareParent}`) : undefined;
        const parentJson = resolveCapturedSelectJsonValue(parentField, seen);
        const bareGrand = field.grandParentFieldId ? stripFieldPrefix(field.grandParentFieldId) : '';
        const grandField = bareGrand
            ? fieldByKey.get(field.grandParentFieldId) ?? fieldByKey.get(bareGrand) ?? fieldByKey.get(`field_${bareGrand}`)
            : undefined;
        const grandJson = grandField ? resolveCapturedSelectJsonValue(grandField, new Set(seen)) : '';
        const lookups = parentJson
            ? [buildOptionLookup(field.options, parentJson, grandJson, !!field.grandParentFieldId), buildOptionLookup(field.options, '')]
            : [buildOptionLookup(field.options, '')];
        for (const lookup of lookups) {
            for (const k of optionMatchKeys(raw)) {
                const mapped = lookup.get(k);
                if (mapped)
                    return mapped.jsonValue;
            }
        }
        return String(raw).trim();
    };
    const selectFields = fields.filter((f) => f.type === 'select');
    const pendingSelectIds = new Set(selectFields.map((f) => f.id));
    const hydrateSelect = (field, seen = new Set()) => {
        if (out[field.id] != null) {
            pendingSelectIds.delete(field.id);
            return true;
        }
        if (seen.has(field.id))
            return false;
        seen.add(field.id);
        const bareParent = field.parentFieldId ? stripFieldPrefix(field.parentFieldId) : '';
        const parentField = bareParent
            ? fieldByKey.get(field.parentFieldId) ?? fieldByKey.get(bareParent) ?? fieldByKey.get(`field_${bareParent}`)
            : undefined;
        if (parentField?.type === 'select' && !hydrateSelect(parentField, seen)) {
            pendingSelectIds.delete(field.id);
            return false;
        }
        const parentJsonValue = parentField ? resolveCapturedSelectJsonValue(parentField) : '';
        // Try with parent filter first; if it fails, fall back to unfiltered lookup
        // so dependent lists still hydrate even when parentValues don't perfectly
        // match the parent's resolved jsonValue (legacy data, pdfValue vs jsonValue).
        const bareGrandParent = field.grandParentFieldId ? stripFieldPrefix(field.grandParentFieldId) : '';
        const grandParentField = bareGrandParent
            ? fieldByKey.get(field.grandParentFieldId) ?? fieldByKey.get(bareGrandParent) ?? fieldByKey.get(`field_${bareGrandParent}`)
            : undefined;
        const grandParentJsonValue = grandParentField ? resolveCapturedSelectJsonValue(grandParentField) : '';
        const revFiltered = buildOptionLabelLookup(field.options, parentJsonValue, grandParentJsonValue, !!field.grandParentFieldId);
        const revAll = parentJsonValue ? buildOptionLabelLookup(field.options, '') : revFiltered;
        const rawCandidates = [capturedJsonValueForField(field), capturedValueForField(field)];
        for (const rev of [revFiltered, revAll]) {
            for (const raw of rawCandidates) {
                if (raw == null || String(raw).trim() === '')
                    continue;
                for (const k of optionMatchKeys(raw)) {
                    const label = rev.get(k);
                    if (label) {
                        out[field.id] = label;
                        pendingSelectIds.delete(field.id);
                        return true;
                    }
                }
            }
        }
        // Captured value present but no option matched: for selects with a defined
        // option set, do NOT hydrate the raw value. Otherwise a stale/foreign value
        // can remain in the UI and make autoFillConcat conditions pass for the
        // wrong select when two selects share the same prefill key.
        if ((field.options?.length ?? 0) > 0) {
            pendingSelectIds.delete(field.id);
            return false;
        }
        // If a select has no configured options, keep the raw value as a legacy
        // fallback because there is no option set to validate against.
        for (const raw of rawCandidates) {
            if (raw == null || String(raw).trim() === '')
                continue;
            out[field.id] = String(raw);
            pendingSelectIds.delete(field.id);
            return true;
        }
        pendingSelectIds.delete(field.id);
        return false;
    };
    while (pendingSelectIds.size > 0) {
        let progressed = false;
        for (const field of selectFields) {
            if (!pendingSelectIds.has(field.id))
                continue;
            hydrateSelect(field);
            progressed = true;
        }
        if (!progressed)
            break;
    }
    // Restore button states (e.g. show/hide section overrides) from envelope.
    if (captured.__buttons && typeof captured.__buttons === 'object') {
        for (const [k, v] of Object.entries(captured.__buttons)) {
            const bare = k.startsWith('field_') ? k.slice(6) : k;
            const f = fieldByKey.get(k) ?? fieldByKey.get(bare);
            out[f?.id ?? bare] = String(v).trim() === 'active' ? 'active' : '';
        }
    }
    for (const [rawKey, rawVal] of Object.entries(pdfMap)) {
        if (rawKey === '__pdf' || rawKey === '__json' || rawKey === '__buttons')
            continue;
        if (rawVal == null)
            continue;
        const key = rawKey.startsWith('field_') ? rawKey.slice(6) : rawKey;
        const field = fieldByKey.get(rawKey) ?? fieldByKey.get(key);
        const value = String(rawVal);
        if (!field) {
            out[key] = value;
            continue;
        }
        const customChecked = String(field.checkedPdfValue ?? '').trim().toLowerCase();
        const isCheckedValue = (v) => {
            const n = v.trim().toLowerCase();
            if (customChecked && n === customChecked)
                return true;
            return n === 'x' || n === 'true' || n === '1';
        };
        if (field.type === 'boolean') {
            const n = value.trim().toLowerCase();
            if (n === '')
                continue;
            out[field.id] = (n === 'sí' || n === 'si' || n === 'true' || n === 'x' || n === '1') ? 'true' : 'false';
            continue;
        }
        if (field.type === 'checkbox') {
            if (isCheckedValue(value)) {
                out[field.id] = 'true';
            }
            continue;
        }
        if (field.type === 'radio') {
            // Checked? Determine if this radio belongs to a group; if so, set the
            // leader's value to the chosen member id (matching the renderer model).
            if (!isCheckedValue(value))
                continue;
            const leaderId = leaderByFieldId.get(field.id) ?? field.id;
            const groupSize = memberCountByLeaderId.get(leaderId) ?? 1;
            if (groupSize > 1) {
                out[leaderId] = field.id;
            }
            else {
                out[field.id] = 'true';
            }
            continue;
        }
        if (field.type === 'select') {
            hydrateSelect(field);
            continue;
        }
        if (field.type === 'signature' || field.type === 'label')
            continue;
        if (field.type === 'date') {
            const fmt = field.pdfDateFormat ?? field.dateFormat ?? null;
            out[field.id] = parseDateForDateInput(value, fmt);
            continue;
        }
        if (field.type === 'time') {
            out[field.id] = toCanonicalTime(value, formatUsesSeconds(displayTimeFormat(field), field.timeStep)) || value;
            continue;
        }
        out[field.id] = value;
    }
    // Fallback for fields that only exist in the structured __json envelope.
    // __pdf remains preferred for UI hydration, but captured __json is still
    // authoritative over the original prefill when __pdf is missing/incomplete.
    for (const field of fields) {
        if (out[field.id] != null)
            continue;
        if (field.type === 'signature' || field.type === 'button' || field.type === 'label')
            continue;
        if (field.type === 'select') {
            hydrateSelect(field);
            continue;
        }
        const jsonRaw = capturedJsonValueForField(field);
        if (jsonRaw == null || String(jsonRaw).trim() === '')
            continue;
        if (field.type === 'date') {
            const fmt = field.jsonDateFormat ?? field.dateFormat ?? null;
            out[field.id] = parseDateForDateInput(String(jsonRaw), fmt);
            continue;
        }
        if (field.type === 'time') {
            out[field.id] =
                toCanonicalTime(jsonRaw, formatUsesSeconds(displayTimeFormat(field), field.timeStep)) || String(jsonRaw);
            continue;
        }
        if (field.type === 'boolean') {
            const n = String(jsonRaw).trim().toLowerCase();
            out[field.id] = (n === 'true' || n === '1' || n === 'sí' || n === 'si' || n === 'x') ? 'true' : 'false';
            continue;
        }
        out[field.id] = String(jsonRaw);
    }
    return out;
}
