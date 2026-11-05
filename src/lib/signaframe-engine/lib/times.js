/**
 * Time-only field utilities.
 *
 * Canonical internal representation for `time` fields is a 24h string:
 *   "HH:mm"      (default)
 *   "HH:mm:ss"   (when the field precision includes seconds)
 *
 * Display / PDF / JSON formats are configured per field with the tokens:
 *   HH (00-23), hh (01-12), mm, ss, a (am/pm), A (AM/PM)
 */
export const DEFAULT_TIME_FORMAT = "HH:mm";
export const TIME_FORMAT_OPTIONS = [
    { value: "HH:mm", label: "24 horas — 14:30 (HH:mm)" },
    { value: "HH:mm:ss", label: "24 horas con segundos — 14:30:05 (HH:mm:ss)" },
    { value: "hh:mm A", label: "12 horas — 02:30 PM (hh:mm A)" },
    { value: "hh:mm:ss A", label: "12 horas con segundos — 02:30:05 PM (hh:mm:ss A)" },
    { value: "HH", label: "Solo hora — 14 (HH)" },
    { value: "mm", label: "Solo minutos — 30 (mm)" },
];
/** Step (precision) options, in seconds. */
export const TIME_STEP_OPTIONS = [
    { value: 1, label: "1 segundo" },
    { value: 60, label: "1 minuto" },
    { value: 300, label: "5 minutos" },
    { value: 600, label: "10 minutos" },
    { value: 900, label: "15 minutos" },
    { value: 1800, label: "30 minutos" },
    { value: 3600, label: "1 hora" },
];
/** Common IANA time zones offered first in the picker. */
const COMMON_TIME_ZONES = [
    "Europe/Madrid",
    "Atlantic/Canary",
    "Europe/Lisbon",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "UTC",
    "America/Mexico_City",
    "America/Bogota",
    "America/Lima",
    "America/Santiago",
    "America/Argentina/Buenos_Aires",
    "America/Sao_Paulo",
    "America/New_York",
    "America/Los_Angeles",
];
/** Full list of IANA time zones (browser provided), commons first. */
export function listTimeZones() {
    let all = [];
    try {
        const sv = Intl.supportedValuesOf;
        if (typeof sv === "function")
            all = sv("timeZone") ?? [];
    }
    catch {
        all = [];
    }
    if (!all.length)
        all = [...COMMON_TIME_ZONES];
    const rest = all.filter((z) => !COMMON_TIME_ZONES.includes(z)).sort();
    const commons = COMMON_TIME_ZONES.filter((z) => all.includes(z) || z === "UTC");
    return [...commons, ...rest];
}
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
/** Parses almost anything into time parts. Returns null when not parseable. */
export function parseTimeParts(input) {
    if (input == null)
        return null;
    let s = String(input).trim();
    if (!s)
        return null;
    // ISO date-time → keep the time portion (respecting an explicit offset by
    // converting to the local time of that offset is out of scope: the stored
    // wall-clock time is what the signer typed).
    const iso = s.match(/^\d{4}-\d{2}-\d{2}[T ](\d{1,2}:\d{2}(?::\d{2})?)/);
    if (iso)
        s = iso[1];
    const m = s.match(/^(\d{1,2})(?:[:.h](\d{1,2}))?(?:[:.](\d{1,2}))?\s*([aApP])\.?\s*[mM]?\.?$/);
    if (!m)
        return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const sec = m[3] ? parseInt(m[3], 10) : 0;
    const mer = m[4].toLowerCase();
    if (h < 1 || h > 12)
        return null;
    if (mer === "p" && h !== 12)
        h += 12;
    if (mer === "a" && h === 12)
        h = 0;
    if (min > 59 || sec > 59)
        return null;
    return { h, m: min, s: sec };
}
/** Parses a 24h-style string ("14:30", "14:30:05", "1430", "14"). */
function parse24(input) {
    const s = input.trim();
    let m = s.match(/^(\d{1,2})[:.h](\d{1,2})(?:[:.](\d{1,2}))?$/);
    if (m) {
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const sec = m[3] ? parseInt(m[3], 10) : 0;
        if (h > 23 || min > 59 || sec > 59)
            return null;
        return { h, m: min, s: sec };
    }
    m = s.match(/^(\d{2})(\d{2})(\d{2})?$/);
    if (m) {
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const sec = m[3] ? parseInt(m[3], 10) : 0;
        if (h > 23 || min > 59 || sec > 59)
            return null;
        return { h, m: min, s: sec };
    }
    m = s.match(/^(\d{1,2})$/);
    if (m) {
        const h = parseInt(m[1], 10);
        if (h > 23)
            return null;
        return { h, m: 0, s: 0 };
    }
    return null;
}
/** Parses any supported input (12h or 24h) into parts. */
export function parseAnyTime(input) {
    if (input == null)
        return null;
    let s = String(input).trim();
    if (!s)
        return null;
    // Strip a trailing timezone designator ("14:30:00Z", "14:30+02:00").
    s = s.replace(/\s*(Z|[+-]\d{2}:?\d{2})$/i, "");
    const iso = s.match(/^\d{4}-\d{2}-\d{2}[T ](.+)$/);
    if (iso)
        s = iso[1].trim();
    return parseTimeParts(s) ?? parse24(s);
}
/** Canonical 24h string. `withSeconds` controls the "HH:mm:ss" shape. */
export function toCanonicalTime(input, withSeconds = false) {
    const p = parseAnyTime(input);
    if (!p)
        return "";
    const base = `${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}`;
    return withSeconds ? `${base}:${String(p.s).padStart(2, "0")}` : base;
}
/** True when the configured format/step needs second-level precision. */
export function formatUsesSeconds(format, stepSeconds) {
    if (typeof stepSeconds === "number" && stepSeconds > 0 && stepSeconds % 60 !== 0)
        return true;
    return /ss/.test(format ?? "");
}
/** Rounds a canonical time to the nearest lower multiple of `stepSeconds`. */
export function snapTimeToStep(value, stepSeconds) {
    const p = parseAnyTime(value);
    if (!p)
        return value;
    const step = typeof stepSeconds === "number" && stepSeconds > 0 ? stepSeconds : 60;
    const total = p.h * 3600 + p.m * 60 + p.s;
    const snapped = Math.round(total / step) * step;
    const wrapped = clamp(snapped, 0, 24 * 3600 - 1);
    const h = Math.floor(wrapped / 3600);
    const m = Math.floor((wrapped % 3600) / 60);
    const s = wrapped % 60;
    const withSeconds = step % 60 !== 0;
    const base = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return withSeconds ? `${base}:${String(s).padStart(2, "0")}` : base;
}
/** Offset ("+02:00") of an IANA timezone at the current date. */
export function timeZoneOffset(timeZone, at = new Date()) {
    if (!timeZone) {
        const mins = -at.getTimezoneOffset();
        const sign = mins >= 0 ? "+" : "-";
        const abs = Math.abs(mins);
        return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
    }
    try {
        const dtf = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
        const part = dtf.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
        const m = part.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
        if (!m)
            return "+00:00";
        const sign = m[1].startsWith("-") ? "-" : "+";
        const h = Math.abs(parseInt(m[1], 10));
        const mm = m[2] ?? "00";
        return `${sign}${String(h).padStart(2, "0")}:${mm}`;
    }
    catch {
        return "+00:00";
    }
}
/** Current wall-clock time in a timezone, canonical 24h. */
export function nowInTimeZone(timeZone, withSeconds = false) {
    const now = new Date();
    try {
        const dtf = new Intl.DateTimeFormat("en-GB", {
            timeZone: timeZone || undefined,
            hour: "2-digit",
            minute: "2-digit",
            second: withSeconds ? "2-digit" : undefined,
            hour12: false,
        });
        return toCanonicalTime(dtf.format(now), withSeconds);
    }
    catch {
        return toCanonicalTime(now.toTimeString().slice(0, 8), withSeconds);
    }
}
/**
 * Formats a canonical (or loosely typed) time value using the configured
 * pattern. Returns "" when the value cannot be parsed.
 */
export function formatTimeValue(value, format, opts) {
    const p = parseAnyTime(value);
    if (!p)
        return "";
    const fmt = (format ?? DEFAULT_TIME_FORMAT).trim() || DEFAULT_TIME_FORMAT;
    const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
    const mer = p.h < 12 ? "AM" : "PM";
    let out = fmt.replace(/HH|hh|H|h|mm|ss|A|a/g, (tok) => {
        switch (tok) {
            case "HH": return String(p.h).padStart(2, "0");
            case "H": return String(p.h);
            case "hh": return String(h12).padStart(2, "0");
            case "h": return String(h12);
            case "mm": return String(p.m).padStart(2, "0");
            case "ss": return String(p.s).padStart(2, "0");
            case "A": return mer;
            case "a": return mer.toLowerCase();
            default: return tok;
        }
    });
    if (opts?.includeOffset)
        out += timeZoneOffset(opts.timeZone);
    return out;
}
export const displayTimeFormat = (f) => (f?.timeFormat ?? DEFAULT_TIME_FORMAT) || DEFAULT_TIME_FORMAT;
export const pdfTimeFormat = (f) => (f?.pdfTimeFormat ?? f?.timeFormat ?? DEFAULT_TIME_FORMAT) || DEFAULT_TIME_FORMAT;
/** JSON output is normalized 24h by default (documented contract). */
export const jsonTimeFormat = (f) => (f?.jsonTimeFormat ?? (formatUsesSeconds(displayTimeFormat(f), f?.timeStep) ? "HH:mm:ss" : DEFAULT_TIME_FORMAT)) ||
    DEFAULT_TIME_FORMAT;
export function formatTimeForPdf(value, f) {
    return formatTimeValue(value, pdfTimeFormat(f));
}
export function formatTimeForJson(value, f) {
    return formatTimeValue(value, jsonTimeFormat(f), {
        timeZone: f?.timeZone ?? null,
        includeOffset: f?.timeIncludeOffset ?? false,
    });
}
