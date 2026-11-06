import { buildInitialFormData, applyAutoFillConcat, collectNullPrefilledJsonPaths } from './services/buildInitialFormData.js';
import { transformFormDataForApi } from './services/formDataTransform.js';
import { getAllSectionFields, collectHiddenFieldInfo, validateFields } from './services/formValidation.js';
import { computeSignatureVisibility } from './services/signatureVisibility.js';
import { resolvePrefillValue } from './services/prefillResolver.js';
import { normalizeOptions } from './services/optionItem.js';
const bare = (id) => (id.startsWith('field_') ? id.slice(6) : id);
function withAliases(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        out[k] = v;
        out[k.startsWith('field_') ? k.slice(6) : `field_${k}`] = v;
    }
    return out;
}
export function simulate(input) {
    const def = input.formDefinition;
    const allFields = (def?.sections ?? []).flatMap((s) => getAllSectionFields(s));
    const process = {
        inputDataJson: input.payload ? JSON.stringify(input.payload) : null,
        capturedData: null,
    };
    // 1. Prefill + defaults
    const seeded = buildInitialFormData(process, allFields);
    const prefilledIds = new Set(Object.entries(seeded)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([k]) => bare(k)));
    // 2. Edits del usuario (ganan sobre el prefill, en ambas formas de id)
    let data = withAliases(seeded);
    for (const [k, v] of Object.entries(input.edits ?? {})) {
        data[k] = v;
        data[k.startsWith('field_') ? k.slice(6) : `field_${k}`] = v;
    }
    // 3. autoFillConcat
    data = withAliases(applyAutoFillConcat(allFields, data));
    // 4. Ocultos por regla → vacíos
    const { hiddenByRule } = collectHiddenFieldInfo(def ?? null, data);
    const subset = {};
    const editedIds = new Set(Object.keys(input.edits ?? {}).map(bare));
    for (const [k, v] of Object.entries(data)) {
        const hasValue = v != null && String(v).trim() !== '';
        if (hasValue || editedIds.has(bare(k)))
            subset[k] = v;
    }
    for (const id of hiddenByRule) {
        for (const k of [id, bare(id), `field_${bare(id)}`])
            if (k in subset)
                subset[k] = '';
    }
    // 5. Cierre de grupos radio
    const included = new Set(Object.keys(subset).map(bare));
    let changed = true;
    while (changed) {
        changed = false;
        for (const f of allFields) {
            if (f.type !== 'radio' || !included.has(bare(f.id)))
                continue;
            for (const sib of (f.radioGroupFields ?? [])) {
                if (!included.has(bare(sib))) {
                    included.add(bare(sib));
                    changed = true;
                }
            }
        }
    }
    const allowed = allFields.filter((f) => included.has(bare(f.id)));
    // 6. Transform (mismo código que el front)
    const out = transformFormDataForApi(subset, allowed, {
        nullJsonPaths: collectNullPrefilledJsonPaths(process, allFields),
    });
    const signatureVisibility = computeSignatureVisibility([
        { templateId: input.templateId ?? 'simulacion', formDefinition: def, data },
    ]);
    const { hidden } = collectHiddenFieldInfo(def ?? null, data);
    const validationErrors = validateFields(allFields, data, {
        hiddenFieldIds: hidden,
        hiddenByRuleFieldIds: hiddenByRule,
        sections: def?.sections ?? null,
    });
    const issues = diagnose(allFields, input.payload, validationErrors, hiddenByRule);
    const diff = input.expectedJson ? diffJson(input.expectedJson, out.json) : null;
    if (diff) {
        for (const d of diff) {
            issues.push({
                level: 'error',
                code: `JSON_${d.kind.toUpperCase()}`,
                path: d.path,
                message: d.kind === 'faltante'
                    ? `Falta en el JSON emitido (esperado ${fmt(d.expected)})`
                    : d.kind === 'sobrante'
                        ? `Sale en el JSON pero no se esperaba (${fmt(d.actual)})`
                        : `Esperado ${fmt(d.expected)}, sale ${fmt(d.actual)}`,
            });
        }
    }
    return {
        json: out.json,
        pdf: out.pdf,
        buttons: out.buttons,
        signatureVisibility,
        formData: data,
        hiddenByRule: [...hiddenByRule],
        validationErrors,
        issues,
        diff,
        stats: {
            fields: allFields.length,
            prefilled: allFields.filter((f) => prefilledIds.has(bare(f.id))).length,
            hiddenByRule: hiddenByRule.size,
            pdfValues: Object.values(out.pdf).filter((v) => v != null && String(v) !== '').length,
            jsonLeaves: leafPaths(out.json).length,
        },
    };
}
// ───────────────────────── diagnósticos ─────────────────────────
function fmt(v) {
    if (v === undefined)
        return '(nada)';
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
}
/** Path base de un prefillKey: sin `| split(...)` ni comparaciones. */
function prefillBasePath(key) {
    return key.split('|')[0].split(/\s*(?:===|!==|==|!=)\s*/)[0].trim().replace(/^\./, '');
}
function normPath(p) {
    return p.replace(/\[(\d+)\]/g, '.$1').replace(/\["([^"]+)"\]/g, '.$1').replace(/^\./, '');
}
export function leafPaths(obj, prefix = '') {
    if (obj === null || typeof obj !== 'object')
        return prefix ? [{ path: prefix, value: obj }] : [];
    const out = [];
    // Array.from y no .map: un arreglo con huecos (personas[2] sin personas[1]) deja agujeros en .map.
    const entries = Array.isArray(obj) ? Array.from(obj, (v, i) => [String(i), v]) : Object.entries(obj);
    if (entries.length === 0 && prefix)
        return [{ path: prefix, value: obj }];
    for (const [k, v] of entries) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object')
            out.push(...leafPaths(v, p));
        else
            out.push({ path: p, value: v });
    }
    return out;
}
function diagnose(fields, payload, validationErrors, hiddenByRule) {
    const issues = [];
    // A. Prefill que no matchea ninguna opción (causa típica de secciones en blanco)
    for (const f of fields) {
        const pk = f.prefillKey;
        if (!pk || !payload)
            continue;
        if (f.type !== 'select' && f.type !== 'radio')
            continue;
        const raw = resolvePrefillValue(payload, pk);
        if (raw == null || typeof raw === 'boolean' || String(raw).trim() === '')
            continue;
        if (f.type === 'radio')
            continue; // radios: el valor se compara por grupo, no por opción
        const opts = normalizeOptions((f.options ?? null));
        if (opts.length === 0)
            continue;
        const needle = String(raw).trim().toLowerCase();
        const hit = opts.some((o) => o.label.trim().toLowerCase() === needle ||
            o.jsonValue.trim().toLowerCase() === needle ||
            o.pdfValue.trim().toLowerCase() === needle);
        if (!hit) {
            issues.push({
                level: 'error',
                code: 'PREFILL_SIN_OPCION',
                fieldId: f.id,
                path: prefillBasePath(pk),
                message: `El payload trae ${fmt(raw)} y ninguna opción del select coincide: el campo queda vacío`,
            });
        }
    }
    // B. prefillKey que apunta a algo que el payload no trae
    if (payload) {
        for (const f of fields) {
            const pk = f.prefillKey;
            if (!pk)
                continue;
            const base = prefillBasePath(pk);
            if (resolvePrefillValue(payload, base) === undefined) {
                issues.push({
                    level: 'info',
                    code: 'PREFILL_AUSENTE',
                    fieldId: f.id,
                    path: base,
                    message: 'El payload no trae este dato; el campo arranca vacío',
                });
            }
        }
    }
    // C. Datos del payload que ningún campo consume
    if (payload) {
        const keys = fields
            .map((f) => f.prefillKey)
            .filter(Boolean)
            .map((k) => normPath(prefillBasePath(k)));
        for (const { path } of leafPaths(payload)) {
            if (path.startsWith('encabezado.'))
                continue;
            const covered = keys.some((k) => path === k || path.startsWith(k + '.'));
            if (!covered) {
                issues.push({
                    level: 'warning',
                    code: 'PAYLOAD_SIN_USO',
                    path,
                    message: 'Llega en el payload pero ningún campo lo precarga',
                });
            }
        }
    }
    // D. Validación: obligatorios vacíos, formatos, etc.
    for (const [fid, msg] of Object.entries(validationErrors)) {
        const f = fields.find((x) => x.id === fid);
        issues.push({
            level: 'warning',
            code: 'VALIDACION',
            fieldId: fid,
            message: `${f?.label ? `"${f.label}": ` : ''}${msg}`,
        });
    }
    // E. Obligatorio oculto por regla (la persona nunca lo va a poder completar)
    for (const f of fields) {
        if (f.required && hiddenByRule.has(f.id)) {
            issues.push({
                level: 'info',
                code: 'OBLIGATORIO_OCULTO',
                fieldId: f.id,
                message: 'Es obligatorio pero queda oculto por regla con este payload',
            });
        }
    }
    return issues;
}
export function diffJson(expected, actual) {
    const e = new Map(leafPaths(expected).map((x) => [x.path, x.value]));
    const a = new Map(leafPaths(actual).map((x) => [x.path, x.value]));
    const out = [];
    for (const [p, v] of e) {
        if (!a.has(p))
            out.push({ path: p, kind: 'faltante', expected: v });
        else if (JSON.stringify(a.get(p)) !== JSON.stringify(v))
            out.push({ path: p, kind: 'distinto', expected: v, actual: a.get(p) });
    }
    for (const [p, v] of a)
        if (!e.has(p))
            out.push({ path: p, kind: 'sobrante', actual: v });
    return out;
}
