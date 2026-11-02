import { publicHolidayKeys } from "@/lib/region";

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

export function parseVacationDate(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function nrwPublicHolidayKeys(year: number) {
  return publicHolidayKeys(year, "DE");
}

export const germanPublicHolidayKeys = nrwPublicHolidayKeys;

export function isVacationWorkday(date: Date, country: string | null | undefined = "DE") {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !publicHolidayKeys(date.getFullYear(), country).has(localDateKey(date));
}

export function countVacationWorkdays(start: Date, end: Date, country: string | null | undefined = "DE") {
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  for (let day = new Date(start); day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    if (isVacationWorkday(day, country)) count += 1;
  }
  return count;
}

export function vacationDateLabel(date: Date, lang?: string) {
  const locale = lang === "en" ? "en-US" : lang === "it" ? "it-IT" : lang === "sq" ? "sq-AL" : "de-DE";
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}
