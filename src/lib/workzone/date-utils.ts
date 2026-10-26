export const REPORT_TIME_ZONE = "Europe/Berlin";

export function reportLocale(lang?: string) {
  const selected = lang?.toLowerCase();
  if (selected === "en") return "en-US";
  if (selected === "it") return "it-IT";
  if (selected === "sq") return "sq-AL";
  if (selected === "ro") return "ro-RO";
  if (selected === "pl") return "pl-PL";
  return "de-DE";
}

/** Format a number using the caller's language locale — replaces
 * hardcoded `.toLocaleString("de-DE")` calls so counts render as
 * `1,234` for EN and `1.234` for DE/IT/SQ. */
export function formatCount(value: number, lang?: string): string {
  return value.toLocaleString(reportLocale(lang));
}

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = new Date(wanted);

  for (let i = 0; i < 3; i += 1) {
    const parts = zonedParts(utc);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const diff = actual - wanted;
    if (diff === 0) break;
    utc = new Date(utc.getTime() - diff);
  }

  return utc;
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function dateKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function monthKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function dayRange(key: string) {
  const parsed = parseDateKey(key);
  if (!parsed) {
    const fallback = new Date(NaN);
    return { start: fallback, end: fallback };
  }

  const start = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day);
  const end = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day + 1);
  return { start, end };
}

export function monthRange(key: string) {
  const [year, month] = key.split("-").map((part) => Number(part));
  if (!year || !month) {
    const fallback = new Date(NaN);
    return { start: fallback, end: fallback };
  }

  const start = zonedDateTimeToUtc(year, month, 1);
  const end = zonedDateTimeToUtc(year, month + 1, 1);
  return { start, end };
}

export function formatReportTime(date: Date | null, lang?: string) {
  return date ? date.toLocaleTimeString(reportLocale(lang), { timeZone: REPORT_TIME_ZONE, hour: "2-digit", minute: "2-digit" }) : "-";
}

export function formatReportDateTime(date: Date | null, lang?: string) {
  return date
    ? date.toLocaleString(reportLocale(lang), {
        timeZone: REPORT_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
}

export function formatReportDate(date: Date, lang?: string) {
  return date.toLocaleDateString(reportLocale(lang), {
    timeZone: REPORT_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatReportDay(date: Date, lang?: string) {
  return date.toLocaleDateString(reportLocale(lang), { timeZone: REPORT_TIME_ZONE, weekday: "short" });
}

/** Calendar arithmetic in the business timezone; the clock is injectable. */
export function isTomorrow(day: Date, clock: () => Date = () => new Date()) {
  const today = dateKey(clock());
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return day.getTime() === dayRange(next.toISOString().slice(0, 10)).start.getTime();
}
