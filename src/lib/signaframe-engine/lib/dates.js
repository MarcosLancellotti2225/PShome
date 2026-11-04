/**
 * Date utilities.
 *
 * The backend returns timestamps in UTC, but some endpoints omit the trailing
 * "Z" (e.g. "2026-04-29T10:00:00" or "2026-04-29T10:00:00.123"). Without a
 * timezone designator, the JS `Date` constructor interprets such strings as
 * **local** time, which shifts the value by the user's UTC offset.
 *
 * `parseUtcDate` normalises any backend-provided string into a `Date` that
 * represents the correct UTC instant, so subsequent `format()` /
 * `toLocaleString()` calls render it in the browser's local timezone.
 */
export function parseUtcDate(input) {
    if (input == null || input === "")
        return new Date(NaN);
    if (input instanceof Date)
        return input;
    if (typeof input === "number")
        return new Date(input);
    let s = String(input).trim();
    // If it already has a timezone designator (Z or ±hh:mm / ±hhmm), trust it.
    const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    // Detect ISO-like date-time without timezone → treat as UTC.
    const isIsoNoTz = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s);
    if (!hasTz && isIsoNoTz) {
        s = s.replace(" ", "T") + "Z";
    }
    return new Date(s);
}
/**
 * Parses a date string according to a configured format pattern (using the
 * same tokens as `formatDateValue`: YYYY, YY, MM, DD, HH, mm, ss) and returns
 * it normalised as `YYYY-MM-DD` — the value expected by `<input type="date">`.
 *
 * Designed for prefilled values that may arrive in the project's configured
 * output format (e.g. "DD/MM/YYYY" -> "29/04/2026"). If the input already
 * looks like an ISO date or the format does not match, falls back to the
 * original value.
 */
export function parseDateForDateInput(value, format) {
    if (value == null)
        return "";
    const raw = String(value).trim();
    if (!raw)
        return "";
    const toIsoIfValid = (yearRaw, monthRaw, dayRaw) => {
        let year = typeof yearRaw === "number" ? yearRaw : parseInt(String(yearRaw), 10);
        if (year < 100)
            year += 2000;
        const month = typeof monthRaw === "number" ? monthRaw : parseInt(String(monthRaw), 10);
        const day = typeof dayRaw === "number" ? dayRaw : parseInt(String(dayRaw), 10);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day))
            return null;
        if (month < 1 || month > 12 || day < 1 || day > 31)
            return null;
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day)
            return null;
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };
    // Already in YYYY-MM-DD (possibly with time suffix) — strip any time part.
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch)
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const fmt = (format ?? "DD/MM/YYYY").trim() || "DD/MM/YYYY";
    // Build a regex from the format, capturing each token.
    const tokenRe = /YYYY|YY|MM|DD|HH|mm|ss/g;
    const tokens = [];
    let regexStr = "^";
    let last = 0;
    let m;
    while ((m = tokenRe.exec(fmt)) !== null) {
        const literal = fmt.slice(last, m.index);
        regexStr += literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const tok = m[0];
        tokens.push(tok);
        regexStr += tok === "YYYY" ? "(\\d{4})" : tok === "YY" ? "(\\d{2})" : "(\\d{1,2})";
        last = m.index + tok.length;
    }
    regexStr += fmt.slice(last).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
    const parts = raw.match(new RegExp(regexStr));
    if (parts) {
        let year = "";
        let month = "";
        let day = "";
        tokens.forEach((tok, idx) => {
            const val = parts[idx + 1];
            if (tok === "YYYY")
                year = val;
            else if (tok === "YY")
                year = String(2000 + parseInt(val, 10));
            else if (tok === "MM")
                month = val;
            else if (tok === "DD")
                day = val;
        });
        if (year && month && day) {
            const iso = toIsoIfValid(year, month, day);
            if (iso)
                return iso;
        }
    }
    {
        // Last resort: try a few common alternative formats.
        const alt = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
        if (alt) {
            const [, a, b, y] = alt;
            // Prefer day/month/year, but when the second segment cannot be a month
            // (e.g. backend prefill "5/19/2026"), interpret it as month/day/year.
            const dmy = toIsoIfValid(y, b, a);
            if (dmy)
                return dmy;
            const mdy = toIsoIfValid(y, a, b);
            if (mdy)
                return mdy;
        }
        return raw;
    }
}
