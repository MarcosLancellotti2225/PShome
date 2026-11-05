export function normalizeOption(raw) {
    if (raw == null)
        return null;
    if (typeof raw === "string") {
        const trimmed = raw;
        if (!trimmed)
            return null;
        return { label: trimmed, pdfValue: trimmed, jsonValue: trimmed };
    }
    const label = (raw.label ?? "").toString();
    if (!label)
        return null;
    const legacyValue = raw.value != null && raw.value !== "" ? String(raw.value) : label;
    const pdfValue = raw.pdfValue != null && raw.pdfValue !== "" ? String(raw.pdfValue) : legacyValue;
    const jsonValue = raw.jsonValue != null && raw.jsonValue !== "" ? String(raw.jsonValue) : legacyValue;
    return { label, pdfValue, jsonValue, value: legacyValue };
}
export function normalizeOptions(raw) {
    if (!raw)
        return [];
    return raw.map(normalizeOption).filter((o) => o !== null);
}
/**
 * Look up the OptionItem matching the user's selected value (which is the label).
 */
export function findOptionByLabel(options, label) {
    const opts = normalizeOptions(options);
    return opts.find((o) => o.label === label) ?? null;
}
/**
 * Returns equivalent normalized forms of a value so lookups succeed even
 * when the option uses a different numeric representation (e.g. "01" vs 1).
 */
export function optionMatchKeys(raw) {
    if (raw == null)
        return [];
    const trimmed = String(raw).trim();
    if (!trimmed)
        return [];
    const lower = trimmed.toLowerCase();
    const keys = new Set([trimmed, lower]);
    if (/^-?\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        if (Number.isFinite(n))
            keys.add(String(n));
    }
    return Array.from(keys);
}
function matchesOption(o, needles) {
    const candidates = [o.label, o.value, o.pdfValue, o.jsonValue].flatMap(optionMatchKeys);
    const set = new Set(candidates);
    return needles.some((n) => set.has(n));
}
/**
 * Resolve a raw incoming value (e.g. from inputDataJson prefill) to the option
 * label the renderer expects. Matches against jsonValue first, then pdfValue,
 * then label, case-insensitively, trimmed, and tolerant to leading zeros on
 * numeric values.
 */
export function findOptionLabelByValue(options, rawValue) {
    const needles = optionMatchKeys(rawValue);
    if (needles.length === 0)
        return null;
    const opts = normalizeOptions(options);
    const byJson = opts.find((o) => optionMatchKeys(o.jsonValue).some((k) => needles.includes(k)));
    if (byJson)
        return byJson.label;
    const byPdf = opts.find((o) => optionMatchKeys(o.pdfValue).some((k) => needles.includes(k)));
    if (byPdf)
        return byPdf.label;
    const byLegacyValue = opts.find((o) => optionMatchKeys(o.value).some((k) => needles.includes(k)));
    if (byLegacyValue)
        return byLegacyValue.label;
    const byLabel = opts.find((o) => optionMatchKeys(o.label).some((k) => needles.includes(k)));
    if (byLabel)
        return byLabel.label;
    return null;
}
/**
 * Normalizes an allowed-values field into trimmed entries.
 * Accepts both the compact string form ("01, 02" / "01>03") and the array form
 * (["01", "02"]) returned by the backend.
 */
export function toValuesArray(raw) {
    const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
    return parts.map((s) => String(s ?? '').trim()).filter((s) => s.length > 0);
}
/** Joins allowed values into the compact comma separated form used by the UI. */
export function valuesToString(raw) {
    return toValuesArray(raw).join(', ');
}
function splitAllowed(raw) {
    return toValuesArray(raw);
}
function valueMatches(candidate, target) {
    if (!target)
        return false;
    const targetKeys = new Set(optionMatchKeys(target));
    return optionMatchKeys(candidate).some((k) => targetKeys.has(k));
}
/**
 * Checks whether a dependent option is visible for the current parent (and,
 * optionally, grandparent) selection.
 *
 * Supported notations inside `parentValues`:
 *  - `01`          → matches when the parent's value is 01
 *  - `01>02`       → composite: grandparent must be 01 AND parent must be 02
 *  - `01, 02>03`   → any of the entries
 *
 * `grandParentValues` (separate column) is an additional AND filter applied on
 * the grandparent value when the field declares a grandparent field.
 */
export function optionMatchesParentChain(opts) {
    const { parentValue, grandParentValue = '', useGrandParent = false } = opts;
    const entries = splitAllowed(opts.parentValues);
    let parentOk = true;
    if (entries.length > 0) {
        parentOk = entries.some((entry) => {
            const [a, b] = entry.includes('>') ? entry.split('>').map((s) => s.trim()) : [null, entry];
            if (a != null) {
                // composite grandparent>parent
                if (!grandParentValue || !valueMatches(a, grandParentValue))
                    return false;
            }
            return valueMatches(b ?? '', parentValue);
        });
    }
    if (!parentOk)
        return false;
    if (useGrandParent) {
        const gpEntries = splitAllowed(opts.grandParentValues);
        if (gpEntries.length > 0) {
            if (!grandParentValue)
                return false;
            if (!gpEntries.some((c) => valueMatches(c, grandParentValue)))
                return false;
        }
    }
    return true;
}
