import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { de } from "./de";
import { MODE_OVERRIDES_INTERNAL } from "./mode-overrides";

/**
 * BDF-P8-007 anti-regression guardrails.
 *
 * These tests are cheap in CI (a few file reads) but catch four classes
 * of i18n regressions that repeatedly slipped into main:
 *
 *   1. Missing i18n keys — code calls `t("workzone.newKey")` but no
 *      dictionary contains it, so the UI renders the raw dot-notation.
 *   2. Mode-override drift — bau/personal DE grows an override but the
 *      matching key never lands in EN/IT/SQ/PL/RO, so BauFlow users on
 *      those languages see German fallbacks.
 *   3. Hardcoded `de-DE` locale — someone re-introduces
 *      `.toLocaleString("de-DE")` or `.toLocaleDateString("de-DE")`
 *      in a production surface, silently rendering German number/date
 *      format for every user.
 *   4. Broken dictionary leaves — empty strings, literal "undefined",
 *      or self-referential key paths that would render as raw text.
 *
 * The tests are strict but scoped: they only walk src/, skip generated
 * code and tests, and whitelist the shared locale helpers themselves.
 */

const REPO_ROOT = path.resolve(decodeURIComponent(new URL("../../..", import.meta.url).pathname));
const SRC_ROOT = path.join(REPO_ROOT, "src");

function walkFiles(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "generated" || entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    try {
      if (entry.isDirectory()) {
        walkFiles(full, out);
      } else if (entry.isFile()) {
        if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          out.push(full);
        }
      }
    } catch {
      // ignore transient dirs
    }
  }
  return out;
}

// Cache the file walk once. The tree is small enough that reading it
// during test collection is faster than doing it inside each test.
const ALL_SOURCE_FILES = walkFiles(SRC_ROOT);

function relFromRoot(absolute: string): string {
  return path.relative(REPO_ROOT, absolute).replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Guardrail 1 — every t("...") lookup in the codebase must exist in de.ts.
// ---------------------------------------------------------------------------

function hasKey(dict: any, path: string): boolean {
  const parts = path.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return false;
    if (!(p in cur)) return false;
    cur = cur[p];
  }
  return typeof cur === "string";
}

const T_CALL_PATTERN = /t\(\s*(?:"([a-zA-Z][a-zA-Z0-9_.]*)"|'([a-zA-Z][a-zA-Z0-9_.]*)')\s*[,)]/g;

function collectUsedKeys(): string[] {
  const keys = new Set<string>();
  for (const file of ALL_SOURCE_FILES) {
    const rel = relFromRoot(file);
    // Skip dictionary files (they contain literal path examples in comments).
    if (rel.startsWith("src/lib/i18n/")) continue;
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    T_CALL_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = T_CALL_PATTERN.exec(source))) {
      const key = match[1] ?? match[2] ?? "";
      // Must look like a namespaced key (at least one dot).
      if (!key.includes(".")) continue;
      if (key.length < 4) continue;
      keys.add(key);
    }
  }
  return [...keys];
}

describe("i18n guardrail: every used t() key exists in de.ts", () => {
  it("has no missing base translation keys", () => {
    const used = collectUsedKeys();
    const missing = used.filter((key) => !hasKey(de, key));
    if (missing.length > 0) {
      throw new Error(
        `Found ${missing.length} t() call site(s) whose key is missing from de.ts.\n` +
          `Fix by adding the key to src/lib/i18n/de.ts (and ideally to en/it/sq).\n\n` +
          `Missing keys:\n  ${missing.slice(0, 40).join("\n  ")}` +
          (missing.length > 40 ? `\n  … +${missing.length - 40} more` : ""),
      );
    }
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Guardrail 2 — bau/personal mode overrides must have the same key set
// across all six supported languages. If DE adds a key, others must too,
// otherwise BauFlow leaks tree terminology into other locales.
// ---------------------------------------------------------------------------

function collectOverrideKeyPaths(dict: any, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(dict ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.add(p);
    else if (v && typeof v === "object") for (const sub of collectOverrideKeyPaths(v, p)) out.add(sub);
  }
  return out;
}

describe("i18n guardrail: bau/personal mode overrides have parity across languages", () => {
  for (const mode of ["bau", "personal"] as const) {
    it(`${mode} override sets match across de/en/it/sq/pl/ro`, () => {
      const byLang = MODE_OVERRIDES_INTERNAL[mode] ?? {};
      const dePaths = collectOverrideKeyPaths((byLang as any).de);
      const gaps: string[] = [];
      for (const lang of ["en", "it", "sq", "pl", "ro"]) {
        const langPaths = collectOverrideKeyPaths((byLang as any)[lang]);
        for (const key of dePaths) {
          if (!langPaths.has(key)) gaps.push(`${mode}.${lang}.${key}`);
        }
      }
      if (gaps.length > 0) {
        throw new Error(
          `Found ${gaps.length} bau/personal override key(s) present in DE but missing in another language.\n` +
            `Fix by mirroring the DE override into the missing language block(s) in src/lib/i18n/mode-overrides.ts.\n\n` +
            `Gaps:\n  ${gaps.slice(0, 40).join("\n  ")}` +
            (gaps.length > 40 ? `\n  … +${gaps.length - 40} more` : ""),
        );
      }
      expect(gaps).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Guardrail 3 — no hardcoded "de-DE" / "de-CH" locale in production code.
// The shared helpers reportLocale(), currencyLocale(), weekRangeLocale()
// are the only allowed places to write a literal German locale.
// ---------------------------------------------------------------------------

const ALLOWED_DEDE_FILES = new Set([
  // Central locale helpers — the rest of the codebase should call through
  // these (reportLocale / currencyLocale / weekRangeLocale) instead of
  // hardcoding a locale string.
  "src/lib/workzone/date-utils.ts",
  "src/lib/calculation/formatters.ts",
  "src/lib/dashboard/dashboard-snapshot.ts",
  // Legacy standalone helper that still takes a locale string parameter.
  "src/lib/workzone/vacation.ts",
  // -------------------------------------------------------------------------
  // Grandfathered surfaces migrated in the BDF-P8-007 remediation series
  // (PRs #25, #26, #29, #30, #31). The literal appears in these files
  // exclusively inside helper thread-throughs (e.g. `.toLocaleString(lang
  // === "de" ? "de-DE" : lang)`) or comments referring to the German
  // fallback. If you add a new occurrence outside those PRs, this test
  // will still fail — the rule for new code is: always route through
  // formatCount / formatEUR / reportLocale.
  //
  // As those PRs merge into main, we can shrink this list. It should be
  // empty when every surface uses the helpers.
  "src/app/(admin)/app/admin/machines/[machineId]/page.tsx",
  "src/app/(admin)/app/admin/page.tsx",
  "src/app/(admin)/app/admin/safety-overview-section.tsx",
  "src/app/(admin)/app/admin/workers/[workerId]/month/[month]/page.tsx",
  "src/app/(admin)/app/audit/page.tsx",
  "src/app/(admin)/app/baustellen/import/actions.ts",
  "src/app/(admin)/app/baustellen/page.tsx",
  "src/app/(admin)/app/dashboard/dashboard-refresh-controls.tsx",
  "src/app/(admin)/app/dashboard/page.tsx",
  "src/app/(admin)/app/dashboard/worker-hours-toggle-chart.tsx",
  "src/app/(admin)/app/fleet-gps/[machineId]/page.tsx",
  "src/app/(admin)/app/fleet-gps/page.tsx",
  "src/app/(admin)/app/inventory/page.tsx",
  "src/app/(admin)/app/machines/[machineId]/page.tsx",
  "src/app/(admin)/app/machines/page.tsx",
  "src/app/(admin)/app/projects/page.tsx",
  "src/app/(workzone)/workzone/admin-profile/[adminId]/page.tsx",
  "src/app/(workzone)/workzone/baustellen/[baustelleId]/safety-equipment-panel.tsx",
  "src/app/(workzone)/workzone/hr-actions.ts",
  "src/app/(workzone)/workzone/machine-actions.ts",
  "src/app/(workzone)/workzone/machine-sidebar.tsx",
  "src/app/(workzone)/workzone/profile/month/[month]/page.tsx",
  "src/app/(workzone)/workzone/profile/report-note-form.tsx",
  "src/app/(workzone)/workzone/profile/worker-inventory.tsx",
  "src/app/(workzone)/workzone/profile/worker-profile-view.tsx",
  "src/app/demo/baustellen/[baustelleId]/page.tsx",
  "src/app/demo/dashboard/page.tsx",
  "src/app/demo/machines/[machineId]/page.tsx",
  "src/app/display/dashboard/page.tsx",
  "src/components/assistant/team-assistant.tsx",
  "src/components/demo/demo-machine-rail.tsx",
  "src/components/demo/demo-worker-profile.tsx",
  "src/components/display/display-refresh-controls.tsx",
  "src/lib/assistant/admin-tools.ts",
  "src/lib/export/baustelle-export.ts",
]);

const LOCALE_LITERAL = /"de-(?:DE|CH|AT)"/;

describe("i18n guardrail: no hardcoded de-DE locale outside the whitelist", () => {
  it("only the whitelisted helper files may embed the literal", () => {
    const offenders: string[] = [];
    for (const file of ALL_SOURCE_FILES) {
      const rel = relFromRoot(file);
      if (ALLOWED_DEDE_FILES.has(rel)) continue;
      if (!/^src\/(app|components|lib)\//.test(rel)) continue;
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (LOCALE_LITERAL.test(source)) offenders.push(rel);
    }
    if (offenders.length > 0) {
      throw new Error(
        `Found ${offenders.length} file(s) with a hardcoded German locale.\n` +
          `Use formatCount(value, lang) / reportLocale(lang) / formatEUR(cents, lang) instead so numbers and dates render in the user's language.\n\n` +
          `Offenders:\n  ${offenders.join("\n  ")}\n\n` +
          `If a file genuinely needs to embed "de-DE" (e.g. it is a locale helper), add it to ALLOWED_DEDE_FILES in this test.`,
      );
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Guardrail 4 — the German dictionary must never contain empty strings,
// the literal "undefined", or a leaf that itself is a valid dot-notation
// key (a common copy-paste bug that would render as raw text).
// ---------------------------------------------------------------------------

function collectLeaves(dict: any, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(dict ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push([p, v]);
    else if (v && typeof v === "object") out.push(...collectLeaves(v, p));
  }
  return out;
}

describe("i18n guardrail: DE dictionary leaves are non-empty", () => {
  it("no empty string or literal 'undefined' at a leaf", () => {
    const bad = collectLeaves(de).filter(([, v]) => v.trim() === "" || v === "undefined" || v === "null");
    expect(bad.map(([p]) => p)).toEqual([]);
  });

  it("no leaf value accidentally holds another key's dot-path", () => {
    // A common bug: someone types `save: "common.save"` instead of the
    // actual translation. Catch by looking for a leaf value that itself
    // looks like a valid dot-notation key path.
    const bad = collectLeaves(de).filter(([path, value]) => {
      if (!/^[a-z][a-zA-Z]+(\.[a-zA-Z][a-zA-Z0-9]+)+$/.test(value)) return false;
      return hasKey(de, value) && value !== path;
    });
    expect(bad.map(([p]) => p)).toEqual([]);
  });
});
