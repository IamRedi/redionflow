/**
 * Country settings per company: currency, public holidays, default vacation
 * allowance, VAT and the default language for new people.
 *
 * Germany (DE) is the original market and stays the default. Albania (AL)
 * was added for the first pilot firm outside Germany. Everything here is
 * pure and dependency-free so client components can import it.
 */

export const COMPANY_COUNTRIES = ["DE", "AL"] as const;
export type CompanyCountry = (typeof COMPANY_COUNTRIES)[number];

export type RegionConfig = {
  country: CompanyCountry;
  /** ISO 4217 currency code used for every amount the company sees. */
  currency: "EUR" | "ALL";
  /** Paid leave per year in working days (Mon-Fri) for a new worker. */
  defaultVacationDays: number;
  /** Standard VAT rate in percent, used as the default for new settings. */
  defaultVatPct: number;
  /** UI and assistant language for new workers and admins. */
  defaultLanguage: "de" | "sq";
};

const REGIONS: Record<CompanyCountry, RegionConfig> = {
  DE: { country: "DE", currency: "EUR", defaultVacationDays: 26, defaultVatPct: 19, defaultLanguage: "de" },
  // Albania: Labour Code art. 92(2) (as amended, State Labour Inspectorate
  // summary 2025) gives at least 22 working days of paid leave; VAT is 20 %.
  AL: { country: "AL", currency: "ALL", defaultVacationDays: 22, defaultVatPct: 20, defaultLanguage: "sq" },
};

export function resolveCountry(raw: string | null | undefined): CompanyCountry {
  const value = String(raw ?? "").trim().toUpperCase();
  return (COMPANY_COUNTRIES as readonly string[]).includes(value) ? (value as CompanyCountry) : "DE";
}

export function regionConfig(country: string | null | undefined): RegionConfig {
  return REGIONS[resolveCountry(country)];
}

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Gregorian (Western) Easter Sunday, anonymous Gregorian algorithm. */
export function westernEasterSunday(year: number) {
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

/** Orthodox Easter Sunday as a Gregorian date (Meeus Julian algorithm, valid 1900-2099). */
export function orthodoxEasterSunday(year: number) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  // Julian -> Gregorian offset is 13 days between 1900 and 2099.
  return addDays(new Date(year, month - 1, day), 13);
}

/**
 * Eid al-Fitr (Bajrami i Madh) and Eid al-Adha (Kurban Bajrami) follow the
 * lunar calendar; the Albanian government announces the exact day each
 * year. These are the expected dates and must be checked once a year.
 */
const ALBANIA_EID_DAYS: Record<number, string[]> = {
  2026: ["2026-03-20", "2026-05-27"],
  2027: ["2027-03-10", "2027-05-16"],
  2028: ["2028-02-27", "2028-05-05"],
};

/** Germany (North Rhine-Westphalia, where the first customers are). */
function germanHolidayKeys(year: number) {
  const easter = westernEasterSunday(year);
  return new Set([
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-10-03`,
    `${year}-11-01`,
    `${year}-12-25`,
    `${year}-12-26`,
    dateKey(addDays(easter, -2)),
    dateKey(addDays(easter, 1)),
    dateKey(addDays(easter, 39)),
    dateKey(addDays(easter, 50)),
    dateKey(addDays(easter, 60)),
  ]);
}

/**
 * Albania, law 7651/1992 on public holidays as amended. A holiday that falls
 * on a Saturday or Sunday moves to the next free working day.
 */
function albanianHolidayKeys(year: number) {
  const base = [
    new Date(year, 0, 1),
    new Date(year, 0, 2),
    new Date(year, 2, 14), // Dita e Verës
    new Date(year, 2, 22), // Nevruzi
    westernEasterSunday(year),
    orthodoxEasterSunday(year),
    new Date(year, 4, 1),
    new Date(year, 9, 19), // Dita e Nënë Terezës
    new Date(year, 10, 28), // Dita e Pavarësisë
    new Date(year, 10, 29), // Dita e Çlirimit
    new Date(year, 11, 8), // Dita Kombëtare e Rinisë
    new Date(year, 11, 25),
    ...(ALBANIA_EID_DAYS[year] ?? []).map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y!, m! - 1, d!);
    }),
  ].sort((left, right) => left.getTime() - right.getTime());

  const keys = new Set(base.map(dateKey));
  for (const day of base) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) continue;
    let substitute = addDays(day, weekday === 6 ? 2 : 1);
    while (keys.has(dateKey(substitute)) || substitute.getDay() === 0 || substitute.getDay() === 6) {
      substitute = addDays(substitute, 1);
    }
    keys.add(dateKey(substitute));
  }
  return keys;
}

export function publicHolidayKeys(year: number, country: string | null | undefined = "DE") {
  return resolveCountry(country) === "AL" ? albanianHolidayKeys(year) : germanHolidayKeys(year);
}
