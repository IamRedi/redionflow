function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function parseVacationDate(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function nrwPublicHolidayKeys(year: number) {
  const easter = easterSunday(year);
  return new Set([
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-10-03`,
    `${year}-11-01`,
    `${year}-12-25`,
    `${year}-12-26`,
    localDateKey(addDays(easter, -2)),
    localDateKey(addDays(easter, 1)),
    localDateKey(addDays(easter, 39)),
    localDateKey(addDays(easter, 50)),
    localDateKey(addDays(easter, 60)),
  ]);
}

export const germanPublicHolidayKeys = nrwPublicHolidayKeys;

export function isVacationWorkday(date: Date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !nrwPublicHolidayKeys(date.getFullYear()).has(localDateKey(date));
}

export function countVacationWorkdays(start: Date, end: Date) {
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  for (let day = new Date(start); day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    if (isVacationWorkday(day)) count += 1;
  }
  return count;
}

export function vacationDateLabel(date: Date, lang?: string) {
  const locale = lang === "en" ? "en-US" : lang === "it" ? "it-IT" : lang === "sq" ? "sq-AL" : "de-DE";
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}
