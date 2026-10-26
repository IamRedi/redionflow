import { describe, expect, it } from "vitest";

import { measureAllCoverage } from "./coverage";

/**
 * BDF-P8-007 — anti-drift snapshot of the i18n dictionaries.
 *
 * We lock the current gap between each non-German dictionary and the
 * German source. Any PR that adds a German key without translating it in
 * `en`, `it`, or `sq` — the four first-class office languages — bumps
 * `germanFallbackCount` above the ceiling below and fails CI.
 *
 * Bounds are tight ceilings, not exact matches. As translations land,
 * the numbers below should be **lowered** in the same PR that shrinks
 * the gap.
 *
 * Policy (owner-confirmed 2026-07-24):
 *   - First-class office languages: de (source), en, it, sq. Coverage
 *     ceilings track any regression.
 *   - Worker-only languages: pl, ro. Only worker profile + workzone
 *     surfaces are user-facing; the rest legitimately falls back to
 *     German (or English via the `t()` fallback chain), so the ceiling
 *     stays high on purpose.
 */

// Baseline captured on 2026-07-24 by `npm run i18n:coverage`, updated
// 2026-07-31 twice: first when PR #24 (safetyEquipment + focus)
// bumped pl/ro by 8, then again after the full BDF-P8-007 batch merged
// (baustelleStatus*, inspectionStatus*, companyLogoAlt, etc.).
const CEILING: Record<"en" | "it" | "sq" | "pl" | "ro", number> = {
  en: 448,
  it: 408,
  sq: 332,
  pl: 1153,
  ro: 1152,
};

describe("i18n coverage snapshot (BDF-P8-007)", () => {
  const measurements = measureAllCoverage();

  // Ceiling for absent-key count. First-class office languages must have
  // full key shape (0). Worker-only languages (pl/ro) are allowed a small
  // baseline of orphan keys because they are written as sparse
  // dictionaries; the `t()` fallback chain resolves them safely.
  const MISSING_CEILING: Record<"en" | "it" | "sq" | "pl" | "ro", number> = {
    en: 0,
    it: 0,
    sq: 0,
    pl: 1,
    ro: 1,
  };

  for (const lang of Object.keys(MISSING_CEILING) as Array<keyof typeof MISSING_CEILING>) {
    it(`${lang}: missingCount must not exceed the baseline ceiling (${MISSING_CEILING[lang]})`, () => {
      const report = measurements[lang];
      expect(
        report.missingCount,
        `${lang} omits ${report.missingCount} German key(s) from its shape (ceiling ${MISSING_CEILING[lang]}). ` +
          "Add the missing sub-objects to match the German dictionary shape, or lower the ceiling if the drop is intentional.",
      ).toBeLessThanOrEqual(MISSING_CEILING[lang]);
    });
  }

  for (const lang of Object.keys(CEILING) as Array<keyof typeof CEILING>) {
    it(`${lang}: germanFallbackCount must not exceed the baseline ceiling (${CEILING[lang]})`, () => {
      const report = measurements[lang];
      expect(
        report.germanFallbackCount,
        `${lang} has ${report.germanFallbackCount} keys still falling back to German. ` +
          `Ceiling is ${CEILING[lang]}. Either translate more keys and lower the ceiling in this file, ` +
          "or (if the number went up) translate the newly-added German keys before merging.",
      ).toBeLessThanOrEqual(CEILING[lang]);
    });
  }

  it("first-class office languages (en/it/sq) meet at least 65% translation coverage", () => {
    for (const lang of ["en", "it", "sq"] as const) {
      const report = measurements[lang];
      expect(
        report.coverage,
        `${lang} coverage is ${(report.coverage * 100).toFixed(1)}%; office languages must stay >=65%`,
      ).toBeGreaterThanOrEqual(0.65);
    }
  });
});
