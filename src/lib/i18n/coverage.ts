/**
 * BDF-P8-007 — i18n coverage helpers.
 *
 * The language dictionaries (`src/locales/*.json`) fall back to German
 * for every key they do not translate (see `dictionaries.ts`), so every
 * language has the same **key shape** as German. What differs is the string
 * *values*: any leaf whose value equals the German string has not been
 * explicitly translated and will show up as German in the UI.
 *
 * This module measures that gap so the parity test can lock the current
 * progress and fail if a future change regresses coverage. It is pure —
 * no Prisma, no Next.js — and safe to run in unit tests.
 */

import { de, en, it, pl, ro, sq } from "./dictionaries";

type NestedDict = { [key: string]: NestedDict | string | undefined };

export type CoverageReport = {
  totalLeaves: number;
  /** Leaves that are present but whose value equals the German source. */
  germanFallbackCount: number;
  /** Leaves absent entirely (should be 0 because of `...de` spread). */
  missingCount: number;
  /**
   * `translatedCount / totalLeaves`, rounded to two decimals. 1.0 means
   * every leaf has an explicit non-German value.
   */
  coverage: number;
};

function walkLeaves(
  target: NestedDict,
  source: NestedDict,
  onLeaf: (targetValue: string | undefined, sourceValue: string) => void,
): void {
  for (const [key, sourceValue] of Object.entries(source)) {
    if (sourceValue === undefined) continue;
    const targetValue = target[key];
    if (typeof sourceValue === "string") {
      onLeaf(typeof targetValue === "string" ? targetValue : undefined, sourceValue);
      continue;
    }
    if (typeof sourceValue === "object" && sourceValue !== null) {
      const nextTarget =
        typeof targetValue === "object" && targetValue !== null
          ? (targetValue as NestedDict)
          : {};
      walkLeaves(nextTarget, sourceValue, onLeaf);
    }
  }
}

export function measureCoverage(target: NestedDict, source: NestedDict = de): CoverageReport {
  let totalLeaves = 0;
  let germanFallbackCount = 0;
  let missingCount = 0;

  walkLeaves(target, source, (targetValue, sourceValue) => {
    totalLeaves++;
    if (targetValue === undefined) {
      missingCount++;
      germanFallbackCount++;
      return;
    }
    if (targetValue === sourceValue) germanFallbackCount++;
  });

  const translated = totalLeaves - germanFallbackCount;
  const coverage = totalLeaves === 0 ? 1 : Math.round((translated / totalLeaves) * 10000) / 10000;
  return { totalLeaves, germanFallbackCount, missingCount, coverage };
}

export const LANGUAGE_DICTIONARIES = { de, en, it, sq, pl, ro } as const;
export type MeasuredLanguage = Exclude<keyof typeof LANGUAGE_DICTIONARIES, "de">;

/**
 * Snapshot the coverage of every non-German dictionary against `de`.
 * Used by the parity test to lock the baseline.
 */
export function measureAllCoverage(): Record<MeasuredLanguage, CoverageReport> {
  return {
    en: measureCoverage(en as unknown as NestedDict),
    it: measureCoverage(it as unknown as NestedDict),
    sq: measureCoverage(sq as unknown as NestedDict),
    pl: measureCoverage(pl as unknown as NestedDict),
    ro: measureCoverage(ro as unknown as NestedDict),
  };
}
