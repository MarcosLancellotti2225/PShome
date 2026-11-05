import { getAllSectionFields } from './formValidation.js';
import { formatDateValue } from './concatEngine.js';
import { formatTimeForPdf } from '../lib/times.js';
/** Returns the subfield values with date fields formatted using their PDF
 *  date format. Used both for slot mappings (which write to a target form
 *  field that ends up in the PDF) and for the overflow template rendering. */
function formatSubfieldValuesForPdf(subfields, values) {
    const out = { ...(values ?? {}) };
    for (const sf of subfields ?? []) {
        if (sf.type === 'time') {
            const rawTime = out[sf.id];
            if (rawTime == null || String(rawTime).trim() === '')
                continue;
            out[sf.id] = formatTimeForPdf(String(rawTime), sf) || String(rawTime);
            continue;
        }
        if (sf.type !== 'date')
            continue;
        const raw = out[sf.id];
        if (raw == null || String(raw).trim() === '')
            continue;
        const fmt = sf.pdfDateFormat ?? sf.dateFormat ?? null;
        if (!fmt)
            continue;
        out[sf.id] = formatDateValue(String(raw), fmt);
    }
    return out;
}
/** Marker delimiters used to safely re-append the overflow text to a target field
 *  without duplicating it on each re-render. */
const START_MARK = (rid) => `<<<rep:${rid}>>>`;
const END_MARK = (rid) => `<<<\/rep:${rid}>>>`;
export function parseRepeaterValue(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw;
    if (typeof raw !== 'string')
        return [];
    const trimmed = raw.trim();
    if (!trimmed.startsWith('['))
        return [];
    try {
        const v = JSON.parse(trimmed);
        return Array.isArray(v) ? v : [];
    }
    catch {
        return [];
    }
}
export function serializeRepeaterValue(items) {
    return JSON.stringify(items ?? []);
}
export function newRepeaterItem(cfg, prev) {
    const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const values = {};
    for (const f of cfg.fields ?? []) {
        if (prev && f.copyOnDuplicate && prev.values?.[f.id] != null && String(prev.values[f.id] ?? '') !== '') {
            values[f.id] = String(prev.values[f.id]);
        }
        else {
            values[f.id] = (f.defaultValue ?? '');
        }
    }
    return { id, values, children: [] };
}
function renderTemplate(tpl, ctx) {
    return tpl.replace(/\{([^}]+)\}/g, (_, key) => {
        const k = String(key).trim();
        return ctx[k] ?? '';
    });
}
function renderItemText(cfg, item, index) {
    const ov = cfg.overflow;
    if (!ov)
        return '';
    const parentValues = formatSubfieldValuesForPdf(cfg.fields, item.values);
    // Build children text first so we can inject it via the normal placeholder
    // substitution. Otherwise renderTemplate would replace {__children__} with
    // '' because it's not in ctx, and the later .replace() would never match.
    let childText = '';
    const child = cfg.child;
    if (child && (item.children?.length ?? 0) > 0 && ov.childTemplate) {
        const sep = ov.childSeparator ?? '; ';
        childText = (item.children ?? [])
            .map((c, i) => {
            const cVals = formatSubfieldValuesForPdf(child.fields, c.values);
            const cctx = { __index__: String(i + 1), ...cVals };
            return renderTemplate(ov.childTemplate ?? '', cctx);
        })
            .filter((s) => s.trim() !== '')
            .join(sep);
    }
    const ctx = {
        __index__: String(index),
        ...parentValues,
        __children__: childText,
    };
    return renderTemplate(ov.template ?? '', ctx);
}
function applyOverflow(formData, repeaterFieldId, ov, texts) {
    const target = ov.targetFieldId;
    if (!target)
        return;
    const sep = ov.separator ?? '\n';
    const start = START_MARK(repeaterFieldId);
    const end = END_MARK(repeaterFieldId);
    const block = texts.filter((t) => t.trim() !== '').join(sep);
    const wrapped = block ? `${start}${block}${end}` : '';
    const current = String(formData[target] ?? '');
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escapeRe(start)}[\\s\\S]*?${escapeRe(end)}`, 'g');
    const hadMarkers = re.test(current);
    re.lastIndex = 0;
    let cleaned = current.replace(re, '').replace(/\n{3,}/g, '\n\n').trimEnd();
    // If the current value has no markers but overflow is configured, assume the
    // value was loaded from a backend that stripped the markers (see
    // `stripRepeaterMarkers` in formDataTransform). In that case the entire
    // value was the previously-emitted overflow text — discard it to avoid
    // accumulating duplicates on each save/load cycle.
    if (!hadMarkers)
        cleaned = '';
    let next;
    if (ov.replace) {
        next = block;
    }
    else if (!wrapped) {
        next = cleaned;
    }
    else {
        next = cleaned ? `${cleaned}${sep}${wrapped}` : wrapped;
    }
    if (next !== current)
        formData[target] = next;
}
function expandPattern(pattern, vars) {
    return pattern.replace(/\{(\w+)\}/g, (_, k) => {
        const v = vars[k];
        return v == null ? '' : String(v);
    });
}
function patternRegex(pattern, indexNames) {
    const placeholders = new Set([...indexNames, 'sub']);
    let escaped = '';
    const re = /\{(\w+)\}/g;
    let last = 0;
    let m;
    while ((m = re.exec(pattern)) !== null) {
        escaped += pattern.slice(last, m.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (placeholders.has(m[1])) {
            escaped += m[1] === 'sub' ? '([A-Za-z0-9_\\-]+)' : '(\\d+)';
        }
        else {
            escaped += m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        last = m.index + m[0].length;
    }
    escaped += pattern.slice(last).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + escaped + '$');
}
/** Apply slot mappings (1..N items go to fixed fields) and overflow (rest goes to a
 *  target field using a template). Mutates `formData` in place. */
export function applyRepeaterToFormData(field, items, formData) {
    const cfg = field.repeaterConfig;
    if (!cfg)
        return;
    const slots = cfg.slotMappings ?? [];
    const usedItems = new Set();
    const emittedKeys = new Set();
    // Apply parent slot mappings.
    for (const slot of slots) {
        const idx = slot.index; // 1-based
        const item = items[idx - 1];
        const itemValues = item ? formatSubfieldValuesForPdf(cfg.fields, item.values) : {};
        for (const subId of Object.keys(slot.map ?? {})) {
            const targetId = slot.map[subId];
            if (!targetId)
                continue;
            formData[targetId] = item ? (itemValues[subId] ?? '') : '';
            emittedKeys.add(targetId);
        }
        if (item)
            usedItems.add(idx - 1);
    }
    // Apply parent slot pattern (auto-emit one field per item × subfield).
    // If `overflowThreshold` is set, only the first N items are emitted to slots;
    // the remaining items will fall through to the overflow target.
    if (cfg.slotPattern) {
        const threshold = typeof cfg.overflowThreshold === 'number' && cfg.overflowThreshold >= 0
            ? cfg.overflowThreshold
            : items.length;
        items.forEach((item, i) => {
            if (i >= threshold)
                return;
            const itemValues = formatSubfieldValuesForPdf(cfg.fields, item.values);
            for (const sf of cfg.fields ?? []) {
                const key = expandPattern(cfg.slotPattern, { i: i + 1, sub: sf.id });
                if (!key)
                    continue;
                formData[key] = itemValues[sf.id] ?? '';
                emittedKeys.add(key);
            }
            usedItems.add(i);
        });
        // Clear stale parent slots whose index exceeds current items count or threshold.
        const re = patternRegex(cfg.slotPattern, ['i']);
        for (const k of Object.keys(formData)) {
            if (emittedKeys.has(k))
                continue;
            if (re.test(k))
                formData[k] = '';
        }
    }
    // Apply child slot mappings.
    const childSlots = cfg.child?.slotMappings ?? [];
    const usedChildren = new Set(); // key: parentIdx0:childIdx0
    for (const slot of childSlots) {
        const pIdx = slot.parentIndex - 1;
        const cIdx = slot.index - 1;
        const parent = items[pIdx];
        const child = parent?.children?.[cIdx];
        const childValues = child ? formatSubfieldValuesForPdf(cfg.child?.fields, child.values) : {};
        for (const subId of Object.keys(slot.map ?? {})) {
            const targetId = slot.map[subId];
            if (!targetId)
                continue;
            formData[targetId] = child ? (childValues[subId] ?? '') : '';
            emittedKeys.add(targetId);
        }
        if (child)
            usedChildren.add(`${pIdx}:${cIdx}`);
    }
    // Apply child slot pattern (auto-emit one field per (parent, child, subfield)).
    if (cfg.child?.slotPattern) {
        const childPattern = cfg.child.slotPattern;
        const childFields = cfg.child.fields ?? [];
        items.forEach((item, i) => {
            (item.children ?? []).forEach((child, j) => {
                const childValues = formatSubfieldValuesForPdf(childFields, child.values);
                for (const sf of childFields) {
                    const key = expandPattern(childPattern, { i: i + 1, j: j + 1, sub: sf.id });
                    if (!key)
                        continue;
                    formData[key] = childValues[sf.id] ?? '';
                    emittedKeys.add(key);
                }
                usedChildren.add(`${i}:${j}`);
            });
        });
        // Clear stale child slots whose (i, j) no longer exist.
        const re = patternRegex(childPattern, ['i', 'j']);
        for (const k of Object.keys(formData)) {
            if (emittedKeys.has(k))
                continue;
            if (re.test(k))
                formData[k] = '';
        }
    }
    // Build overflow text: any item not fully covered by slot mappings goes to overflow.
    if (cfg.overflow) {
        const texts = [];
        items.forEach((item, i) => {
            if (usedItems.has(i)) {
                // Even if parent is in slot, its overflowing children may still need to go.
                const childOv = cfg.child;
                if (childOv && (item.children?.length ?? 0) > 0) {
                    const overflowChildren = (item.children ?? []).filter((_c, ci) => !usedChildren.has(`${i}:${ci}`));
                    if (overflowChildren.length > 0 && cfg.overflow?.childTemplate) {
                        const sep = cfg.overflow.childSeparator ?? '; ';
                        const childText = overflowChildren
                            .map((c, ci) => {
                            const cVals = formatSubfieldValuesForPdf(childOv.fields, c.values);
                            const cctx = { __index__: String(ci + 1), ...cVals };
                            return renderTemplate(cfg.overflow.childTemplate, cctx);
                        })
                            .filter((s) => s.trim() !== '')
                            .join(sep);
                        if (childText) {
                            const parentValues = formatSubfieldValuesForPdf(cfg.fields, item.values);
                            const head = renderTemplate('{__index__}', { __index__: String(i + 1), ...parentValues });
                            texts.push(`${head ? `[${parentValues[cfg.fields[0]?.id ?? ''] || ''}] ` : ''}${childText}`);
                        }
                    }
                }
                return;
            }
            texts.push(renderItemText(cfg, item, i + 1));
        });
        applyOverflow(formData, field.id, cfg.overflow, texts);
    }
}
/** Walk all sections, find repeater fields and apply their effect to `formData`.
 *  Returns the same `formData` reference (mutated). Safe to call on every change. */
export function applyAllRepeatersToFormData(sections, formData) {
    if (!sections)
        return formData;
    const all = sections.flatMap((s) => getAllSectionFields(s));
    for (const f of all) {
        if (f.type !== 'repeater' || !f.repeaterConfig)
            continue;
        const items = parseRepeaterValue(formData[f.id]);
        applyRepeaterToFormData(f, items, formData);
    }
    return formData;
}
/** Returns the list of field IDs that are managed by a repeater (slot mappings
 *  parent + child + overflow target). They should be treated as read-only and
 *  excluded from "missing required" checks (the repeater handles them). */
export function collectRepeaterManagedFieldIds(sections) {
    const out = new Set();
    if (!sections)
        return out;
    const all = sections.flatMap((s) => getAllSectionFields(s));
    for (const f of all) {
        const cfg = f.repeaterConfig;
        if (f.type !== 'repeater' || !cfg)
            continue;
        for (const slot of cfg.slotMappings ?? []) {
            Object.values(slot.map ?? {}).forEach((id) => id && out.add(id));
        }
        for (const slot of cfg.child?.slotMappings ?? []) {
            Object.values(slot.map ?? {}).forEach((id) => id && out.add(id));
        }
        if (cfg.overflow?.targetFieldId)
            out.add(cfg.overflow.targetFieldId);
    }
    return out;
}
