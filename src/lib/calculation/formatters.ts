import type { Cents } from "./types";

/**
 * Map a UI language code (or full BCP-47 tag) to the locale used for
 * monetary formatting. Falls back to de-DE for legacy German usage.
 */
function currencyLocale(lang: string): string {
  if (lang.includes("-")) return lang;
  const normalized = lang.toLowerCase();
  if (normalized === "en") return "en-US";
  if (normalized === "it") return "it-IT";
  if (normalized === "sq") return "sq-AL";
  if (normalized === "pl") return "pl-PL";
  if (normalized === "ro") return "ro-RO";
  return "de-DE";
}

/**
 * Localise a stored unit token for display. Values like "pauschal" or
 * "Stk." live in the DB in German because they were seeded from
 * German-only catalog defaults; render them in the user's language
 * without mutating the underlying record.
 */
export function unitLabel(unit: string, lang: string = "de"): string {
  const trimmed = unit.trim();
  const normalized = trimmed.toLowerCase();
  const l = lang.toLowerCase();
  if (normalized === "pauschal") {
    if (l === "en") return "flat";
    if (l === "it") return "forfait";
    if (l === "sq") return "flat";
    if (l === "pl") return "ryczalt";
    if (l === "ro") return "forfetar";
    return "pauschal";
  }
  if (normalized === "stk." || normalized === "stk") {
    if (l === "en") return "pcs";
    if (l === "it") return "pz.";
    if (l === "sq") return "cop.";
    if (l === "pl") return "szt.";
    if (l === "ro") return "buc.";
    return "Stk.";
  }
  return trimmed;
}

export function formatEUR(cents: Cents, lang: string = "de"): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat(currencyLocale(lang), {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
