import { describe, expect, it } from "vitest";

import { countVacationWorkdays } from "@/lib/workzone/vacation";
import { formatMoney } from "@/lib/calculation/formatters";
import { orthodoxEasterSunday, publicHolidayKeys, regionConfig, resolveCountry, westernEasterSunday } from "./region";

const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

describe("region config", () => {
  it("defaults unknown values to Germany", () => {
    expect(resolveCountry(undefined)).toBe("DE");
    expect(resolveCountry("fr")).toBe("DE");
    expect(resolveCountry("al")).toBe("AL");
    expect(regionConfig("DE")).toMatchObject({ currency: "EUR", defaultVacationDays: 26, defaultVatPct: 19, defaultLanguage: "de" });
    expect(regionConfig("AL")).toMatchObject({ currency: "ALL", defaultVacationDays: 22, defaultVatPct: 20, defaultLanguage: "sq" });
  });

  it("computes Western and Orthodox Easter", () => {
    expect(key(westernEasterSunday(2026))).toBe("2026-04-05");
    expect(key(orthodoxEasterSunday(2026))).toBe("2026-04-12");
    expect(key(westernEasterSunday(2027))).toBe("2027-03-28");
    expect(key(orthodoxEasterSunday(2027))).toBe("2027-05-02");
  });

  it("keeps the German holiday list unchanged", () => {
    const de = publicHolidayKeys(2026, "DE");
    expect(de.has("2026-10-03")).toBe(true);
    expect(de.has("2026-04-06")).toBe(true); // Easter Monday
    expect(de.has("2026-11-28")).toBe(false);
  });

  it("lists Albanian holidays and moves weekend ones to the next working day", () => {
    const al = publicHolidayKeys(2026, "AL");
    for (const day of ["2026-01-01", "2026-01-02", "2026-03-20", "2026-05-01", "2026-05-27", "2026-10-19", "2026-12-08", "2026-12-25"]) {
      expect(al.has(day), day).toBe(true);
    }
    expect(al.has("2026-03-16")).toBe(true); // Dita e Verës (Sat 14.03)
    expect(al.has("2026-03-23")).toBe(true); // Nevruz (Sun 22.03)
    expect(al.has("2026-04-06")).toBe(true); // Catholic Easter Sunday -> Monday
    expect(al.has("2026-04-13")).toBe(true); // Orthodox Easter Sunday -> Monday
    expect(al.has("2026-11-30")).toBe(true); // Independence (Sat 28.11)
    expect(al.has("2026-12-01")).toBe(true); // Liberation (Sun 29.11), Monday already taken
    expect(al.has("2026-10-03")).toBe(false);
  });

  it("counts vacation workdays with the company's holidays", () => {
    const start = new Date(2026, 10, 23); // Mon 23.11.2026
    const end = new Date(2026, 11, 4); // Fri 04.12.2026
    expect(countVacationWorkdays(start, end)).toBe(10);
    expect(countVacationWorkdays(start, end, "DE")).toBe(10);
    expect(countVacationWorkdays(start, end, "AL")).toBe(8);
  });

  it("formats lek without decimals and keeps euro formatting", () => {
    expect(formatMoney(123456, "de", "EUR")).toBe(formatMoney(123456, "de"));
    expect(formatMoney(150000, "sq", "ALL")).toMatch(/1[\s.  ]?500/);
    expect(formatMoney(150000, "sq", "ALL")).toContain("ALL");
    expect(formatMoney(150000, "sq", "ALL")).not.toMatch(/,00|\.00/);
  });
});
