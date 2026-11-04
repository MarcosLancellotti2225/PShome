import { parseDateForDateInput } from '../lib/dates.js';
import { resolvePrefillValue, coercePrefillValue, coercePrefillBoolean, coerceGroupedRadioPrefillBoolean, hasPrefillComparisonExpression, } from './prefillResolver.js';
import { findOptionLabelByValue, normalizeOptions, findOptionByLabel, valuesToString, optionMatchesParentChain, } from './optionItem.js';
import { formDataFromCaptured } from './formDataTransform.js';
import { resolveConcatTokens, } from './concatEngine.js';
import { toCanonicalTime, formatUsesSeconds, displayTimeFormat, nowInTimeZone, parseAnyTime } from '../lib/times.js';
const fieldDateFormat = (field) => field.jsonDateFormat ?? field.pdfDateFormat ?? field.dateFormat ?? null;
const resolveDateDefaultToken = (raw) => {
    const s = raw.trim();
    if (s === 'today') {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const m = s.match(/^today([+-])(\d+)$/);
    if (m) {
        const sign = m[1] === '+' ? 1 : -1;
        const n = parseInt(m[2], 10);
        const d = new Date();
        d.setDate(d.getDate() + sign * n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return s;
};
export const normalizeInitialFieldValue = (field, value) => {
    if (field.type === 'time') {
        const raw = String(value ?? '').trim();
        const withSeconds = formatUsesSeconds(displayTimeFormat(field), field.timeStep);
        const tz = field.timeZone ?? null;
        if (/^(now|ahora)$/i.test(raw))
            return nowInTimeZone(tz, withSeconds);
        const off = raw.match(/^now([+-])(\d+)$/i);
        if (off) {
            const base = parseAnyTime(nowInTimeZone(tz, true));
            if (base) {
                const delta = (off[1] === '+' ? 1 : -1) * parseInt(off[2], 10) * 60;
                let total = base.h * 3600 + base.m * 60 + base.s + delta;
                total = ((total % 86400) + 86400) % 86400;
                const h = Math.floor(total / 3600);
                const m = Math.floor((total % 3600) / 60);
                const s = total % 60;
                const str = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                return toCanonicalTime(str, withSeconds);
            }
        }
        return toCanonicalTime(raw, withSeconds) || raw;
    }
    if (field.type === 'date') {
        const resolved = resolveDateDefaultToken(String(value));
        return parseDateForDateInput(resolved, fieldDateFormat(field));
    }
    if (field.type === 'select') {
        // If the incoming value doesn't match any option for this select, return ''
        // instead of writing the raw value. Otherwise, fields that share a
        // `prefillKey` with another select (e.g. two variants pointing to the same
        // JSON path) would all receive the same value even when it doesn't belong
        // to their option set — leaking into autoFillConcat conditions on the
        // wrong field.
        const matched = findOptionLabelByValue(field.options, value);
        if (matched != null)
            return matched;
        const opts = normalizeOptions(field.options ?? null);
        return opts.length > 0 ? '' : String(value);
    }
    return String(value);
};
/** jsonValue (fallback pdfValue/label) for the label currently held by a field. */
const fieldJsonValue = (field, seed) => {
    if (!field)
        return '';
    const label = seed[field.id] ?? '';
    if (!label)
        return '';
    const opt = findOptionByLabel(field.options, label);
    return (opt?.jsonValue || opt?.pdfValue || opt?.label || label);
};
/**
 * Re-resolves prefilled values of dependent selects taking the parent (and
 * grandparent) chain into account. Without this, a raw code such as
 * `codigoDistrito: 3` would match the first option with that value across the
 * whole list instead of the one belonging to the selected cantón.
 */
export function resolveDependentSelectSeeds(allFields, seed, rawValues) {
    const byId = new Map(allFields.map((f) => [f.id, f]));
    const depth = (f, guard = 0) => {
        if (guard > 10)
            return guard;
        const pid = f.parentFieldId;
        const parent = pid ? byId.get(pid) : undefined;
        return parent ? depth(parent, guard + 1) + 1 : 0;
    };
    const dependents = allFields
        .filter((f) => f.type === 'select' && f.parentFieldId && rawValues.has(f.id))
        .sort((a, b) => depth(a) - depth(b));
    for (const f of dependents) {
        const raw = rawValues.get(f.id);
        const parentField = byId.get(f.parentFieldId);
        const grandParentFieldId = f.grandParentFieldId;
        const grandParentField = grandParentFieldId ? byId.get(grandParentFieldId) : undefined;
        const parentValue = fieldJsonValue(parentField, seed);
        const grandParentValue = fieldJsonValue(grandParentField, seed);
        const opts = (f.options ?? []);
        const normalized = opts.map((o) => (typeof o === 'string' ? { label: o } : o));
        const filterBy = (useGrandParent) => normalized.filter((o) => {
            const pv = valuesToString(o?.parentValues);
            const gpv = valuesToString(o?.grandParentValues);
            if (!pv && !gpv)
                return true;
            if (pv && !parentValue)
                return false;
            if (!useGrandParent) {
                // Sin abuelo resuelto: filtramos solo por el padre, quedándonos con la
                // parte "padre" de las entradas compuestas (abuelo>padre).
                if (!pv)
                    return true;
                const parentOnly = pv
                    .split(',')
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .map((e) => (e.includes('>') ? e.split('>').pop().trim() : e))
                    .join(', ');
                return optionMatchesParentChain({ parentValues: parentOnly, parentValue });
            }
            return optionMatchesParentChain({
                parentValues: pv,
                grandParentValues: gpv,
                parentValue,
                grandParentValue,
                useGrandParent: true,
            });
        });
        // El abuelo puede venir vacío (no configurado o sin valor precargado):
        // en ese caso degradamos a un filtrado solo por padre en lugar de
        // descartar todas las opciones.
        const useGrandParent = !!grandParentFieldId && grandParentValue !== '';
        let visible = filterBy(useGrandParent);
        if (visible.length === 0 && useGrandParent)
            visible = filterBy(false);
        if (visible.length === 0)
            continue;
        const matched = findOptionLabelByValue(visible, raw);
        seed[f.id] = matched ?? '';
    }
}
/**
 * Devuelve las rutas del envelope `__json` que deben emitirse como `null`
 * explícito: campos con `prefillKey` cuyo valor en el JSON de entrada es
 * exactamente `null` y que tienen configurada una `jsonOutputPath`.
 */
export function collectNullPrefilledJsonPaths(process, allFields) {
    const raw = process?.inputDataJson;
    if (!raw)
        return [];
    let parsed = null;
    try {
        parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw);
    }
    catch {
        return [];
    }
    if (!parsed || typeof parsed !== 'object')
        return [];
    const out = [];
    for (const f of allFields) {
        const pk = f.prefillKey?.trim();
        const path = f.jsonOutputPath?.trim();
        if (!pk || !path)
            continue;
        if (f.excludeFromJson)
            continue;
        if (resolvePrefillValue(parsed, pk) !== null)
            continue;
        out.push({ key: f.id.startsWith('field_') ? f.id.slice(6) : f.id, path });
    }
    return out;
}
/**
 * Build the initial form data record for a process, layering (lowest to highest
 * priority): defaults → prefill from `inputDataJson` → captured draft data.
 */
export function buildInitialFormData(process, allFields) {
    const seed = {};
    const fieldByIncomingKey = (key) => allFields.find((f) => f.id === key || f.id === `field_${key}` || (f.id.startsWith('field_') && f.id.slice(6) === key));
    const radioLeaderByMember = new Map();
    const radioGroupSize = new Map();
    for (const f of allFields) {
        if (f.type !== 'radio')
            continue;
        const siblings = f.radioGroupFields;
        if (siblings && siblings.length > 0 && !radioLeaderByMember.has(f.id)) {
            const members = [f.id, ...siblings];
            members.forEach((m) => radioLeaderByMember.set(m, f.id));
            radioGroupSize.set(f.id, members.length);
        }
    }
    const rawSelectValues = new Map();
    for (const f of allFields) {
        const dv = f.defaultValue;
        if (dv === undefined || dv === null || dv === '')
            continue;
        seed[f.id] = normalizeInitialFieldValue(f, dv);
        if (f.type === 'select')
            rawSelectValues.set(f.id, dv);
    }
    const prefilledRaw = process.inputDataJson;
    if (prefilledRaw) {
        try {
            const parsed = typeof prefilledRaw === 'string' ? JSON.parse(prefilledRaw) : prefilledRaw;
            for (const [k, v] of Object.entries(parsed ?? {})) {
                if (v == null || typeof v === 'object')
                    continue;
                const key = k.startsWith('field_') ? k.slice(6) : k;
                const targetField = fieldByIncomingKey(key);
                seed[targetField ? targetField.id : key] = targetField ? normalizeInitialFieldValue(targetField, v) : String(v);
                if (targetField?.type === 'select')
                    rawSelectValues.set(targetField.id, v);
            }
            const groupedRadioResults = new Map();
            for (const f of allFields) {
                const pk = f.prefillKey;
                if (!pk)
                    continue;
                const resolved = resolvePrefillValue(parsed, pk);
                if (resolved == null)
                    continue;
                if (f.type === 'radio') {
                    const leaderId = radioLeaderByMember.get(f.id);
                    const groupSize = leaderId ? radioGroupSize.get(leaderId) ?? 1 : 1;
                    const bool = leaderId && groupSize > 1
                        ? coerceGroupedRadioPrefillBoolean(resolved, hasPrefillComparisonExpression(pk))
                        : coercePrefillBoolean(resolved);
                    if (leaderId && groupSize > 1) {
                        const acc = groupedRadioResults.get(leaderId) ?? { sawFalse: false };
                        if (bool === true && acc.selected === undefined)
                            acc.selected = f.id;
                        if (bool === false)
                            acc.sawFalse = true;
                        groupedRadioResults.set(leaderId, acc);
                        continue;
                    }
                    if (bool !== undefined)
                        seed[f.id] = String(bool);
                    else {
                        const coerced = coercePrefillValue(resolved);
                        if (coerced != null && coerced.trim() !== '')
                            seed[f.id] = coerced;
                    }
                    continue;
                }
                if (f.type === 'checkbox' || f.type === 'boolean') {
                    const bool = coercePrefillBoolean(resolved);
                    if (bool !== undefined)
                        seed[f.id] = String(bool);
                    continue;
                }
                const coerced = coercePrefillValue(resolved);
                if (coerced != null && coerced.trim() !== '') {
                    seed[f.id] = normalizeInitialFieldValue(f, coerced);
                    if (f.type === 'select')
                        rawSelectValues.set(f.id, coerced);
                }
            }
            for (const [leaderId, acc] of groupedRadioResults) {
                if (acc.selected !== undefined)
                    seed[leaderId] = acc.selected;
                else if (acc.sawFalse)
                    delete seed[leaderId];
            }
        }
        catch { /* ignore malformed prefilled JSON */ }
    }
    resolveDependentSelectSeeds(allFields, seed, rawSelectValues);
    const capturedSeed = formDataFromCaptured(process.capturedData, allFields);
    for (const [k, v] of Object.entries(capturedSeed))
        seed[k] = v;
    return seed;
}
/**
 * Returns a new form data record with autoFillConcat fields resolved. Only
 * fills fields whose current value is empty, mirroring the "first run"
 * behaviour of `useFormRules`. Pure — safe to call from non-React code.
 */
export function applyAutoFillConcat(allFields, data) {
    const out = { ...data };
    const fieldsMap = new Map();
    allFields.forEach((f) => {
        fieldsMap.set(f.id, f);
        if (f.id.startsWith('field_'))
            fieldsMap.set(f.id.slice(6), f);
        else
            fieldsMap.set(`field_${f.id}`, f);
    });
    const autoFillTypes = new Set(['text', 'boolean', 'textarea', 'radio', 'checkbox', 'select']);
    for (const f of allFields) {
        const cfg = f.autoFillConcat;
        if (!cfg)
            continue;
        if (!autoFillTypes.has(f.type))
            continue;
        const currentRaw = out[f.id] ?? out[`field_${f.id}`] ?? '';
        if (String(currentRaw).trim() !== '')
            continue;
        const sep = cfg.separator ?? ' ';
        const tokens = cfg.parts && cfg.parts.length > 0
            ? cfg.parts
            : (cfg.sourceFieldIds ?? []).map((id) => ({ kind: 'field', fieldId: id }));
        if (tokens.length === 0)
            continue;
        const resolveFieldValue = (tok) => {
            const strippedId = tok.fieldId.startsWith('field_') ? tok.fieldId.slice(6) : tok.fieldId;
            const raw = out[tok.fieldId] ??
                out[`field_${tok.fieldId}`] ??
                out[strippedId] ??
                out[`field_${strippedId}`] ??
                '';
            const visible = String(raw ?? '').trim();
            const source = tok.valueSource ?? 'visible';
            if (!source || source === 'visible' || !visible)
                return visible;
            const srcField = fieldsMap.get(tok.fieldId) ?? fieldsMap.get(strippedId) ?? fieldsMap.get(`field_${strippedId}`);
            const opts = normalizeOptions(srcField?.options ?? null);
            if (opts.length === 0)
                return visible;
            const needle = visible.toLowerCase();
            const match = opts.find((o) => o.label.trim().toLowerCase() === needle ||
                o.jsonValue.trim().toLowerCase() === needle ||
                o.pdfValue.trim().toLowerCase() === needle);
            if (!match)
                return visible;
            return source === 'json' ? match.jsonValue : match.pdfValue;
        };
        try {
            const next = resolveConcatTokens(tokens, sep, {
                side: 'pdf',
                formData: out,
                resolveFieldValue,
            });
            if (next && next.trim() !== '')
                out[f.id] = next;
        }
        catch {
            /* ignore */
        }
    }
    return out;
}
