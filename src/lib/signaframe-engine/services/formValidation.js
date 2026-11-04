import { parseVisibilityConfig } from '../components/FormDefinitionEditor.js';
import { optionMatchesParentChain, valuesToString } from './optionItem.js';
import { parseAnyTime } from '../lib/times.js';
export function computeRepeaterSumIssues(field, rawValue) {
    const cfg = field.repeaterConfig;
    if (!cfg)
        return [];
    let items = [];
    try {
        const parsed = typeof rawValue === 'string' && rawValue.trim().startsWith('[') ? JSON.parse(rawValue) : null;
        if (Array.isArray(parsed))
            items = parsed;
    }
    catch { /* ignore */ }
    const issues = [];
    for (const sf of cfg.fields ?? []) {
        const rule = sf.repeaterSumValidation;
        if (!rule || sf.type !== 'number')
            continue;
        let sum = 0;
        for (const it of items) {
            const raw = it?.values?.[sf.id];
            const n = raw == null || raw === '' ? 0 : Number(String(raw).replace(',', '.'));
            if (Number.isFinite(n))
                sum += n;
        }
        const target = Number(rule.value) || 0;
        let ok = true;
        if (rule.op === 'min')
            ok = sum >= target;
        else if (rule.op === 'max')
            ok = sum <= target;
        else if (rule.op === 'exact')
            ok = sum === target;
        if (!ok) {
            const def = rule.op === 'min'
                ? `La suma de "${sf.label}" debe ser ≥ ${target} (actual: ${sum})`
                : rule.op === 'max'
                    ? `La suma de "${sf.label}" debe ser ≤ ${target} (actual: ${sum})`
                    : `La suma de "${sf.label}" debe ser = ${target} (actual: ${sum})`;
            issues.push({
                subFieldId: sf.id,
                subLabel: sf.label,
                op: rule.op,
                expected: target,
                actual: sum,
                message: (rule.message && rule.message.trim()) || def,
            });
        }
    }
    return issues;
}
function validateRepeaterSums(field, rawValue) {
    return computeRepeaterSumIssues(field, rawValue).map((i) => i.message);
}
function parseRepeaterItems(rawValue) {
    try {
        const parsed = typeof rawValue === 'string' && rawValue.trim().startsWith('[') ? JSON.parse(rawValue) : null;
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** Missing required subfields inside repeater items / subitems. */
function validateRepeaterRequiredSubfields(field, rawValue) {
    const cfg = field.repeaterConfig;
    if (!cfg)
        return [];
    const items = parseRepeaterItems(rawValue);
    const msgs = [];
    const checkLevel = (subFields, values, itemLabel) => {
        for (const sf of subFields ?? []) {
            if (sf.hidden === true)
                continue;
            if (sf.type === 'button' || sf.type === 'signature' || sf.type === 'label')
                continue;
            if (sf.readOnly)
                continue;
            if (!isFieldVisible(sf, values, subFields))
                continue;
            if (isFieldDisabledByRule(sf, values, subFields))
                continue;
            const required = !!sf.required || isFieldRequiredByRule(sf, values, subFields);
            if (!required)
                continue;
            const v = values?.[sf.id] ?? '';
            const empty = sf.type === 'checkbox'
                ? !(v === 'true' || v === 'X')
                : String(v ?? '').trim() === '';
            if (empty) {
                msgs.push(`${itemLabel}: "${sf.label}" es obligatorio`);
            }
        }
    };
    const itemLabelBase = cfg.itemLabel?.trim() || 'Item';
    const childLabelBase = cfg.child?.itemLabel?.trim() || 'Subitem';
    items.forEach((it, i) => {
        const label = `${itemLabelBase} ${i + 1}`;
        checkLevel(cfg.fields, it?.values ?? {}, label);
        if (cfg.child) {
            (it?.children ?? []).forEach((ch, j) => {
                checkLevel(cfg.child?.fields, ch?.values ?? {}, `${label} › ${childLabelBase} ${j + 1}`);
            });
        }
    });
    return msgs;
}
function buildRadioGroups(fields) {
    const radioFields = fields.filter((f) => f.type === 'radio');
    const radioIds = new Set(radioFields.map((f) => f.id));
    const adjacency = new Map();
    radioFields.forEach((f) => adjacency.set(f.id, new Set()));
    radioFields.forEach((f) => {
        (f.radioGroupFields ?? []).forEach((tid) => {
            if (!radioIds.has(tid))
                return;
            adjacency.get(f.id)?.add(tid);
            adjacency.get(tid)?.add(f.id);
        });
    });
    const leaderByFieldId = new Map();
    const memberIdsByLeaderId = new Map();
    const visited = new Set();
    for (const f of radioFields) {
        if (visited.has(f.id))
            continue;
        const stack = [f.id];
        const component = new Set();
        visited.add(f.id);
        while (stack.length) {
            const cur = stack.pop();
            component.add(cur);
            for (const n of adjacency.get(cur) ?? []) {
                if (visited.has(n))
                    continue;
                visited.add(n);
                stack.push(n);
            }
        }
        const memberIds = radioFields.filter((rf) => component.has(rf.id)).map((rf) => rf.id);
        const leaderId = memberIds[0] ?? f.id;
        memberIds.forEach((mid) => leaderByFieldId.set(mid, leaderId));
        memberIdsByLeaderId.set(leaderId, memberIds);
    }
    return { leaderByFieldId, memberIdsByLeaderId };
}
function evaluateVisibilityRule(raw, formData, allFields, sections) {
    if (!raw)
        return true;
    const cfg = parseVisibilityConfig(raw);
    if (cfg.conditions.length === 0)
        return true;
    const radioMeta = allFields ? buildRadioGroups(allFields) : null;
    const radioFieldsById = new Map();
    if (allFields) {
        allFields.forEach((f) => {
            if (f.type === 'radio')
                radioFieldsById.set(f.id, f);
        });
    }
    const getEffectiveValue = (refFieldId) => {
        if (radioMeta && radioFieldsById.has(refFieldId)) {
            const leaderId = radioMeta.leaderByFieldId.get(refFieldId) ?? refFieldId;
            const members = radioMeta.memberIdsByLeaderId.get(leaderId) ?? [refFieldId];
            if (members.length > 1) {
                const leaderVal = formData[leaderId] ?? '';
                return leaderVal === refFieldId ? 'true' : '';
            }
            const own = formData[refFieldId] ?? '';
            return own === 'true' || own === 'X' ? 'true' : '';
        }
        return formData[refFieldId] ?? '';
    };
    const overrides = sections && sections.length ? computeButtonOverrides(sections, formData) : null;
    const check = (c) => {
        if (c.operator === 'visible' || c.operator === 'hidden') {
            // Container reference: __sec__:<id> or __sub__:<id>
            if (c.fieldId.startsWith('__sec__:') || c.fieldId.startsWith('__sub__:')) {
                const isSec = c.fieldId.startsWith('__sec__:');
                const targetId = c.fieldId.slice(isSec ? '__sec__:'.length : '__sub__:'.length);
                let containerVisible = c.operator === 'hidden';
                if (sections && sections.length) {
                    if (isSec) {
                        const sec = sections.find((s) => s.id === targetId);
                        if (sec) {
                            const manual = sec.hidden === true;
                            const ruleVis = evaluateVisibilityRule(sec.conditionalVisibility, formData, allFields, sections);
                            let vis = !manual && ruleVis;
                            if (overrides?.hideSections.has(targetId))
                                vis = false;
                            else if (overrides?.showSections.has(targetId))
                                vis = true;
                            containerVisible = vis;
                        }
                    }
                    else {
                        for (const s of sections) {
                            const sub = (s.subsections ?? []).find((x) => x.id === targetId);
                            if (!sub)
                                continue;
                            const secManual = s.hidden === true;
                            const secRule = evaluateVisibilityRule(s.conditionalVisibility, formData, allFields, sections);
                            let secVis = !secManual && secRule;
                            if (overrides?.hideSections.has(s.id))
                                secVis = false;
                            else if (overrides?.showSections.has(s.id))
                                secVis = true;
                            const subManual = sub.hidden === true;
                            const subRule = evaluateVisibilityRule(sub.conditionalVisibility, formData, allFields, sections);
                            let subVis = !subManual && subRule;
                            if (overrides?.hideSubsections.has(targetId))
                                subVis = false;
                            else if (overrides?.showSubsections.has(targetId))
                                subVis = true;
                            containerVisible = secVis && subVis;
                            break;
                        }
                    }
                }
                return c.operator === 'visible' ? containerVisible : !containerVisible;
            }
            const ref = allFields?.find((f) => f.id === c.fieldId);
            if (!ref)
                return c.operator === 'hidden';
            const manuallyHidden = ref.hidden === true;
            const ruleVisible = evaluateVisibilityRule(ref.conditionalVisibility, formData, allFields, sections);
            // Si conocemos las secciones, considerar también si el contenedor está oculto
            let containerVisible = true;
            if (sections && sections.length) {
                for (const sec of sections) {
                    const inOwn = (sec.fields ?? []).some((f) => f.id === ref.id);
                    const inSub = (sec.subsections ?? []).find((sub) => (sub.fields ?? []).some((f) => f.id === ref.id));
                    if (inOwn || inSub) {
                        const secManual = sec.hidden === true;
                        const secRule = evaluateVisibilityRule(sec.conditionalVisibility, formData, allFields, sections);
                        const secVis = !secManual && secRule;
                        let subVis = true;
                        if (inSub) {
                            const subManual = inSub.hidden === true;
                            const subRule = evaluateVisibilityRule(inSub.conditionalVisibility, formData, allFields, sections);
                            subVis = !subManual && subRule;
                        }
                        containerVisible = secVis && subVis;
                        break;
                    }
                }
            }
            const vis = !manuallyHidden && ruleVisible && containerVisible;
            return c.operator === 'visible' ? vis : !vis;
        }
        // Repeater subfield reference: __rep__:<repeaterId>:<scope>:<subFieldId>
        // Matches if ANY item (or child, when scope === 'child') has the subfield
        // value that satisfies the operator.
        if (c.fieldId.startsWith('__rep__:')) {
            const rest = c.fieldId.slice('__rep__:'.length);
            const firstSep = rest.indexOf(':');
            if (firstSep < 0)
                return false;
            const repId = rest.slice(0, firstSep);
            const tail = rest.slice(firstSep + 1);
            const secondSep = tail.indexOf(':');
            if (secondSep < 0)
                return false;
            const scope = tail.slice(0, secondSep);
            const subId = tail.slice(secondSep + 1);
            const raw = formData[repId] ??
                formData[`field_${repId}`] ??
                formData[repId.startsWith('field_') ? repId.slice(6) : `field_${repId}`] ??
                '';
            let items = [];
            try {
                const parsed = typeof raw === 'string' && raw.trim().startsWith('[') ? JSON.parse(raw) : null;
                if (Array.isArray(parsed))
                    items = parsed;
            }
            catch { /* ignore */ }
            const values = [];
            if (scope === 'child') {
                for (const it of items) {
                    for (const ch of it.children ?? [])
                        values.push(String(ch?.values?.[subId] ?? ''));
                }
            }
            else {
                for (const it of items)
                    values.push(String(it?.values?.[subId] ?? ''));
            }
            const evalOne = (v) => {
                if (c.operator === 'not_empty')
                    return v.trim() !== '';
                if (c.operator === 'empty')
                    return v.trim() === '';
                if (c.operator === 'equals')
                    return v === (c.value ?? '');
                if (c.operator === 'gt' || c.operator === 'lt') {
                    const a = parseFloat(String(v).replace(',', '.'));
                    const b = parseFloat(String(c.value ?? '').replace(',', '.'));
                    if (Number.isNaN(a) || Number.isNaN(b))
                        return false;
                    return c.operator === 'gt' ? a > b : a < b;
                }
                return false;
            };
            if (c.operator === 'empty') {
                // "empty" means no item has a value for the subfield.
                return values.length === 0 || values.every((v) => v.trim() === '');
            }
            // For the rest, satisfied if ANY item matches.
            return values.some(evalOne);
        }
        const v = getEffectiveValue(c.fieldId);
        if (c.operator === 'not_empty')
            return v.trim() !== '';
        if (c.operator === 'empty')
            return v.trim() === '';
        if (c.operator === 'equals')
            return v === (c.value ?? '');
        if (c.operator === 'gt' || c.operator === 'lt') {
            const a = parseFloat(String(v).replace(',', '.'));
            const b = parseFloat(String(c.value ?? '').replace(',', '.'));
            if (Number.isNaN(a) || Number.isNaN(b))
                return false;
            return c.operator === 'gt' ? a > b : a < b;
        }
        return true;
    };
    return cfg.logic === 'and' ? cfg.conditions.every(check) : cfg.conditions.some(check);
}
/**
 * Compute the visibility overrides forced by `button` fields with state `'active'`.
 */
export function computeButtonOverrides(sections, formData) {
    const out = {
        showFields: new Set(),
        hideFields: new Set(),
        showSections: new Set(),
        hideSections: new Set(),
        showSubsections: new Set(),
        hideSubsections: new Set(),
        clearFieldIds: new Set(),
    };
    if (!sections || sections.length === 0)
        return out;
    const sectionById = new Map();
    const subById = new Map();
    sections.forEach((s) => {
        sectionById.set(s.id, s);
        (s.subsections ?? []).forEach((sub) => subById.set(sub.id, sub));
    });
    const allFields = sections.flatMap((s) => getAllSectionFields(s));
    for (const f of allFields) {
        if (f.type !== 'button')
            continue;
        const cfg = f.buttonConfig;
        if (!cfg)
            continue;
        const bare = f.id.startsWith('field_') ? f.id.slice(6) : f.id;
        const state = String(formData[f.id] ?? formData[bare] ?? formData[`field_${bare}`] ?? '').trim();
        // Botón sólo activo cuando el usuario lo ha pulsado (state === 'active').
        // No se auto-activa por la presencia de valores en los destinos: el estado
        // del botón se persiste explícitamente en el bucket `__buttons`.
        if (state !== 'active')
            continue;
        (cfg.showFieldIds ?? []).forEach((id) => out.showFields.add(id));
        (cfg.showSectionIds ?? []).forEach((id) => out.showSections.add(id));
        (cfg.showSubsectionIds ?? []).forEach((id) => out.showSubsections.add(id));
        (cfg.hideFieldIds ?? []).forEach((id) => {
            out.hideFields.add(id);
            if (cfg.clearOnHide)
                out.clearFieldIds.add(id);
        });
        (cfg.hideSectionIds ?? []).forEach((id) => {
            out.hideSections.add(id);
            if (cfg.clearOnHide) {
                const sec = sectionById.get(id);
                if (sec)
                    getAllSectionFields(sec).forEach((ff) => out.clearFieldIds.add(ff.id));
            }
        });
        (cfg.hideSubsectionIds ?? []).forEach((id) => {
            out.hideSubsections.add(id);
            if (cfg.clearOnHide) {
                const sub = subById.get(id);
                if (sub)
                    (sub.fields ?? []).forEach((ff) => out.clearFieldIds.add(ff.id));
            }
        });
    }
    return out;
}
export function isFieldVisible(field, formData, allFields, overrides, sections) {
    if (overrides?.hideFields.has(field.id))
        return false;
    if (overrides?.showFields.has(field.id))
        return true;
    // A conditional-disable rule can be configured to hide the field instead of
    // just rendering it read-only.
    if (field.conditionalDisableHides &&
        isFieldDisabledByRule(field, formData, allFields, sections)) {
        return false;
    }
    return evaluateVisibilityRule(field.conditionalVisibility, formData, allFields, sections);
}
/**
 * "Editable si vacío": when the field is prefillable (optional/required) and no
 * prefilled value arrived, the field must stay editable no matter what other
 * rule (readOnly, conditionalDisable) would lock it — otherwise it would be
 * impossible to fill and stay blank. Defaults to enabled when not configured.
 */
export function isPrefillEditableWhenEmpty(field, formData) {
    const mode = typeof field.prefillMode === 'string' ? field.prefillMode.toLowerCase() : '';
    if (!(mode.startsWith('opt') || mode.startsWith('req')))
        return false;
    if (field.prefillEditableIfEmpty === false)
        return false;
    const raw = formData?.[field.id] ?? formData?.[`field_${field.id}`] ?? field.defaultValue ?? '';
    return String(raw ?? '').trim() === '';
}
/**
 * When the field has a `conditionalDisable` rule and its conditions match,
 * the field is rendered but disabled (read-only). Returns true when the field
 * should be disabled by the rule.
 */
export function isFieldDisabledByRule(field, formData, allFields, sections) {
    const raw = field.conditionalDisable;
    if (!raw)
        return false;
    if (isPrefillEditableWhenEmpty(field, formData))
        return false;
    return evaluateVisibilityRule(raw, formData, allFields, sections);
}
/**
 * When the field has a `conditionalRequired` rule and its conditions match,
 * the field becomes required regardless of its `required` flag.
 */
export function isFieldRequiredByRule(field, formData, allFields, sections) {
    const raw = field.conditionalRequired;
    if (!raw)
        return false;
    return evaluateVisibilityRule(raw, formData, allFields, sections);
}
function resolveFieldJsonValue(fieldId, formData, allFields) {
    if (!fieldId)
        return { field: null, jsonValue: '' };
    const field = allFields?.find((f) => f.id === fieldId) ?? null;
    const raw = String(formData[fieldId] ?? '').trim();
    if (!raw)
        return { field, jsonValue: '' };
    if (field && Array.isArray(field.options)) {
        const opt = field.options.find((o) => (typeof o === 'string' ? o === raw : (o.label ?? '') === raw));
        if (opt && typeof opt !== 'string') {
            return { field, jsonValue: (opt.jsonValue ?? opt.pdfValue ?? opt.label ?? raw).toString() };
        }
    }
    return { field, jsonValue: raw };
}
export function resolveDependentOptions(field, formData, allFields) {
    const parentFieldId = field.parentFieldId;
    if (!parentFieldId)
        return null;
    const { field: parentField, jsonValue: parentJsonValue } = resolveFieldJsonValue(parentFieldId, formData, allFields);
    const grandParentFieldId = field.grandParentFieldId;
    const { field: grandParentField, jsonValue: grandParentJsonValue } = resolveFieldJsonValue(grandParentFieldId, formData, allFields);
    const parentHasValue = parentJsonValue !== '';
    const opts = (field.options ?? []);
    const normalizedOpts = opts.map((o) => (typeof o === 'string' ? { label: o } : o));
    const visibleOptions = normalizedOpts.filter((o) => {
        const pv = valuesToString(o.parentValues);
        const gpv = valuesToString(o.grandParentValues);
        if (!pv && !gpv)
            return true;
        if (pv && !parentHasValue)
            return false;
        return optionMatchesParentChain({
            parentValues: pv,
            grandParentValues: gpv,
            parentValue: parentJsonValue,
            grandParentValue: grandParentJsonValue,
            useGrandParent: !!grandParentFieldId,
        });
    });
    return {
        parentField,
        parentJsonValue,
        parentHasValue,
        grandParentField,
        grandParentJsonValue,
        grandParentHasValue: grandParentJsonValue !== '',
        visibleOptions,
    };
}
/**
 * Returns true when the field is a dependent select whose parent has no value
 * (so the input is shown disabled and shouldn't be validated as required).
 */
export function isFieldDisabledByDependentParent(field, formData, allFields) {
    const info = resolveDependentOptions(field, formData, allFields);
    if (!info)
        return false;
    return !info.parentHasValue;
}
export function validateField(field, formData, radioGroups, allFields, sections) {
    if (field.type === 'button' || field.type === 'signature' || field.type === 'label')
        return { message: null };
    if (field.type === 'repeater') {
        if (field.hidden === true)
            return { message: null };
        if (!isFieldVisible(field, formData, allFields, undefined, sections))
            return { message: null };
        if (isFieldDisabledByRule(field, formData, allFields, sections))
            return { message: null };
        const raw = formData[field.id] ?? '';
        const msgs = validateRepeaterSums(field, raw);
        const cfg = field.repeaterConfig;
        const items = parseRepeaterItems(raw);
        const minItems = Number(cfg?.minItems ?? 0) || 0;
        if (minItems > 0 && items.length < minItems) {
            msgs.push(`Debes añadir al menos ${minItems} ${(cfg?.itemLabelPlural || cfg?.itemLabel || 'items')}`);
        }
        if (field.required && items.length === 0) {
            msgs.push('Este campo es obligatorio');
        }
        msgs.push(...validateRepeaterRequiredSubfields(field, raw));
        return { message: msgs.length > 0 ? msgs.join(' · ') : null };
    }
    const hiddenByVisibilityRule = !isFieldVisible(field, formData, allFields, undefined, sections) ||
        isFieldDisabledByRule(field, formData, allFields, sections) ||
        isFieldDisabledByDependentParent(field, formData, allFields);
    const isHidden = field.hidden === true ||
        hiddenByVisibilityRule;
    // Hidden / disabled fields: skip required checks. Regex validation only runs
    // when the field is hidden manually (hidden=true) — fields hidden by a
    // visibility/disable rule should not trigger regex errors at all.
    if (isHidden) {
        if (hiddenByVisibilityRule)
            return { message: null };
        const value = formData[field.id] ?? '';
        const trimmed = String(value).trim();
        if (trimmed !== '' && field.validationPattern) {
            try {
                const re = new RegExp(field.validationPattern);
                if (!re.test(trimmed)) {
                    const customMsg = field.validationErrorMessage?.trim() || null;
                    const msg = customMsg ?? 'No cumple el formato requerido';
                    return { message: msg, extraErrors: computeHighlightExtras(field, formData, msg) };
                }
            }
            catch { /* patrón inválido: ignorar */ }
        }
        return { message: null };
    }
    if (field.readOnly)
        return { message: null };
    const value = formData[field.id] ?? '';
    const requiredByRule = isFieldRequiredByRule(field, formData, allFields, sections);
    const effectiveRequired = !!field.required || requiredByRule;
    const customMsg = field.validationErrorMessage?.trim() || null;
    if (field.type === 'radio') {
        const leaderId = radioGroups.leaderByFieldId.get(field.id) ?? field.id;
        const members = radioGroups.memberIdsByLeaderId.get(leaderId) ?? [field.id];
        if (field.id !== leaderId)
            return { message: null };
        const memberFields = (allFields ?? []).filter((f) => members.includes(f.id));
        const groupRequired = memberFields.length > 0
            ? memberFields.some((f) => f.required || isFieldRequiredByRule(f, formData, allFields, sections))
            : effectiveRequired;
        if (!groupRequired)
            return { message: null };
        const someChecked = members.some((mid) => {
            const v = formData[mid] ?? '';
            return v === 'true' || v === 'X' || v === mid;
        });
        const leaderVal = formData[leaderId] ?? '';
        const grouped = members.length > 1 && (leaderVal !== '' && members.includes(leaderVal));
        if (someChecked || grouped)
            return { message: null };
        return { message: customMsg ?? 'Selecciona una opción' };
    }
    if (field.type === 'checkbox') {
        if (effectiveRequired && value !== 'true' && value !== 'X') {
            return { message: customMsg ?? 'Este campo es obligatorio' };
        }
        return { message: null };
    }
    const trimmed = String(value).trim();
    if (effectiveRequired && trimmed === '') {
        return { message: customMsg ?? 'Este campo es obligatorio' };
    }
    if (field.type === 'time' && trimmed !== '' && !parseAnyTime(trimmed)) {
        return { message: customMsg ?? 'Introduce una hora válida' };
    }
    if (trimmed !== '' && field.validationPattern) {
        let failed = false;
        try {
            const re = new RegExp(field.validationPattern);
            failed = !re.test(trimmed);
        }
        catch {
            // patrón inválido: ignorar
        }
        if (failed) {
            const msg = customMsg ?? 'No cumple el formato requerido';
            return { message: msg, extraErrors: computeHighlightExtras(field, formData, msg) };
        }
    }
    return { message: null };
}
function evalHighlightCondition(value, cond) {
    if (!cond)
        return true;
    const v = String(value ?? '');
    const target = String(cond.value ?? '');
    switch (cond.operator) {
        case 'empty': return v.trim() === '';
        case 'not_empty': return v.trim() !== '';
        case 'equals': return v === target;
        case 'notEquals': return v !== target;
        case 'startsWith': return v.startsWith(target);
        case 'endsWith': return v.endsWith(target);
        case 'gt':
        case 'lt': {
            const a = parseFloat(v.replace(',', '.'));
            const b = parseFloat(target.replace(',', '.'));
            if (Number.isNaN(a) || Number.isNaN(b))
                return false;
            return cond.operator === 'gt' ? a > b : a < b;
        }
        default: return true;
    }
}
function computeHighlightExtras(field, formData, msg) {
    const list = field.validationHighlights ?? [];
    const out = [];
    for (const h of list) {
        if (!h?.fieldId || h.fieldId === field.id)
            continue;
        const v = formData[h.fieldId] ?? '';
        if (!evalHighlightCondition(v, h.condition ?? null))
            continue;
        out.push({ fieldId: h.fieldId, message: msg });
    }
    return out;
}
export function isSectionVisible(section, formData, allFields, overrides) {
    if (overrides?.hideSections.has(section.id))
        return false;
    if (overrides?.showSections.has(section.id))
        return true;
    const raw = section.conditionalVisibility;
    if (!raw)
        return true;
    const pseudo = { conditionalVisibility: raw };
    return isFieldVisible(pseudo, formData, allFields);
}
export function isSubsectionVisible(subsection, formData, allFields, overrides) {
    if (overrides?.hideSubsections.has(subsection.id))
        return false;
    if (overrides?.showSubsections.has(subsection.id))
        return true;
    const raw = subsection.conditionalVisibility;
    if (!raw)
        return true;
    const pseudo = { conditionalVisibility: raw };
    return isFieldVisible(pseudo, formData, allFields);
}
/**
 * All fields belonging to a section, including those inside its subsections.
 * Use this anywhere you need the full flat list of fields for a section.
 */
export function getAllSectionFields(section) {
    const own = (section.fields ?? []);
    const nested = (section.subsections ?? []).flatMap((sub) => (sub.fields ?? []));
    return [...own, ...nested];
}
/** All fields across the whole definition, walking sections + subsections. */
export function getAllDefinitionFields(definition) {
    if (!definition)
        return [];
    return (definition.sections ?? []).flatMap((s) => getAllSectionFields(s));
}
/**
 * Build the set of field IDs that should be skipped during validation:
 * - fields inside hidden sections (manual or by visibility rule)
 * - fields inside hidden subsections (manual or by visibility rule)
 *
 * Field-level visibility/disable rules are handled inside validateField itself.
 */
export function collectHiddenFieldIds(definition, formData) {
    return collectHiddenFieldInfo(definition, formData).hidden;
}
/**
 * Same as collectHiddenFieldIds, but also reports which fields are hidden
 * because of a visibility rule (vs. manually hidden via `hidden=true`).
 * Fields hidden by rule must skip regex validation entirely.
 */
export function collectHiddenFieldInfo(definition, formData, overrides) {
    const hidden = new Set();
    const hiddenByRule = new Set();
    if (!definition)
        return { hidden, hiddenByRule };
    const ov = overrides ?? computeButtonOverrides(definition.sections, formData);
    const allFields = getAllDefinitionFields(definition);
    for (const section of definition.sections ?? []) {
        const shownByButton = ov.showSections.has(section.id);
        const manuallyHidden = !shownByButton && section.hidden === true;
        const ruleHidden = !manuallyHidden && !isSectionVisible(section, formData, allFields, ov);
        if (manuallyHidden || ruleHidden) {
            for (const f of getAllSectionFields(section)) {
                hidden.add(f.id);
                if (ruleHidden)
                    hiddenByRule.add(f.id);
            }
            continue;
        }
        for (const sub of section.subsections ?? []) {
            const subShown = ov.showSubsections.has(sub.id);
            const subManual = !subShown && sub.hidden === true;
            const subRule = !subManual && !isSubsectionVisible(sub, formData, allFields, ov);
            if (subManual || subRule) {
                for (const f of sub.fields ?? []) {
                    hidden.add(f.id);
                    if (subRule)
                        hiddenByRule.add(f.id);
                }
            }
        }
        for (const f of getAllSectionFields(section)) {
            if (ov.hideFields.has(f.id)) {
                hidden.add(f.id);
                hiddenByRule.add(f.id);
            }
        }
    }
    return { hidden, hiddenByRule };
}
export function validateFields(fields, formData, options) {
    const radioGroups = buildRadioGroups(fields);
    const errors = {};
    const hidden = options?.hiddenFieldIds;
    const hiddenByRule = options?.hiddenByRuleFieldIds;
    const sections = options?.sections ?? null;
    for (const f of fields) {
        let res;
        if (hidden?.has(f.id)) {
            // Hidden by a visibility rule: skip ALL validation (including regex).
            // Manually hidden: still run regex so highlight targets surface.
            res = { message: null };
            if (!hiddenByRule?.has(f.id)) {
                const value = formData[f.id] ?? '';
                const trimmed = String(value).trim();
                if (trimmed !== '' && f.validationPattern) {
                    try {
                        const re = new RegExp(f.validationPattern);
                        if (!re.test(trimmed)) {
                            const customMsg = f.validationErrorMessage?.trim() || null;
                            const msg = customMsg ?? 'No cumple el formato requerido';
                            res = { message: null, extraErrors: computeHighlightExtras(f, formData, msg) };
                        }
                    }
                    catch { /* ignore */ }
                }
            }
        }
        else {
            res = validateField(f, formData, radioGroups, fields, sections);
            if (res.message && !errors[f.id])
                errors[f.id] = res.message;
        }
        for (const ex of res.extraErrors ?? []) {
            if (hidden?.has(ex.fieldId))
                continue;
            if (!errors[ex.fieldId])
                errors[ex.fieldId] = ex.message;
        }
    }
    return errors;
}
export function validateSections(sections, formData) {
    const allFields = sections.flatMap((s) => getAllSectionFields(s));
    const definition = { sections };
    const { hidden, hiddenByRule } = collectHiddenFieldInfo(definition, formData);
    return validateFields(allFields, formData, { hiddenFieldIds: hidden, hiddenByRuleFieldIds: hiddenByRule, sections });
}
export function getFieldLabel(fields, fieldId) {
    return fields.find((f) => f.id === fieldId)?.label ?? fieldId;
}
