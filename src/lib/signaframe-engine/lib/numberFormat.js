export const DEFAULT_NUMBER_FORMAT = {
    thousands: '',
    decimal: '.',
    decimals: null,
};
/** Parses any user-typed numeric string into a JS number.
 *  Accepts both "1.234,56" and "1,234.56" by stripping every non-digit
 *  (except the last separator, which becomes the decimal point). */
export function parseNumberLoose(input) {
    if (input == null)
        return null;
    const s = String(input).trim();
    if (!s)
        return null;
    // Already a clean number?
    if (/^-?\d+(\.\d+)?$/.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    // Strip everything except digits, separators and sign.
    const cleaned = s.replace(/[^\d.,-]/g, '');
    if (!cleaned)
        return null;
    // Last separator wins as decimal separator.
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalized;
    if (lastComma === -1 && lastDot === -1) {
        normalized = cleaned;
    }
    else if (lastComma > lastDot) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
    }
    else {
        normalized = cleaned.replace(/,/g, '');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}
/** Formats a number using the given NumberFormat. Returns '' for invalid input. */
export function formatNumber(value, fmt) {
    const n = typeof value === 'number' ? value : parseNumberLoose(value);
    if (n == null)
        return value == null ? '' : String(value);
    const f = { ...DEFAULT_NUMBER_FORMAT, ...(fmt ?? {}) };
    const negative = n < 0;
    const abs = Math.abs(n);
    const rounded = f.decimals != null ? abs.toFixed(Math.max(0, Math.min(10, f.decimals))) : String(abs);
    const [intPart, decPart = ''] = rounded.split('.');
    const grouped = f.thousands
        ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, f.thousands)
        : intPart;
    const out = decPart ? `${grouped}${f.decimal}${decPart}` : grouped;
    return negative ? `-${out}` : out;
}
/** Returns a canonical numeric string ("." decimal, no grouping) suitable for
 *  storing in formData. Returns the original input unchanged if it can't be
 *  parsed as a number, so partial user input isn't destroyed. */
export function canonicalNumberString(input) {
    const n = parseNumberLoose(input);
    if (n == null)
        return input == null ? '' : String(input);
    return String(n);
}
