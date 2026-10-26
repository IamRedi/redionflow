import type { CompanyMode } from "@/lib/mode-config";
import bauDe from "@/locales/bau/de.json";
import bauEn from "@/locales/bau/en.json";
import bauIt from "@/locales/bau/it.json";
import bauPl from "@/locales/bau/pl.json";
import bauRo from "@/locales/bau/ro.json";
import bauSq from "@/locales/bau/sq.json";
import type { SparseDictionary } from "./dictionaries";

/**
 * T-029 — BauFlow terminology polish.
 *
 * Sparse override maps (`src/locales/<mode>/<lang>.json`) applied ON TOP of the base translation dictionary
 * when a company runs in a non-baumdienst mode. The base language files
 * (de/en/pl/ro/sq) stay canonical; overrides only replace strings that
 * would otherwise leak tree-work language into a construction workspace.
 *
 * Adding a new override is safe: if a key is missing from an override
 * map, the base translation is used. Fall-back order:
 *   mode override (target lang) → base translation (target lang) → base German
 *
 * Only override on shared surfaces that stay visible when the tree
 * modules are hidden by `modeConfig.trees=false`. If a string is only
 * shown inside a tree-gated component, it does not need an override.
 */

type BaumdienstModeOverrides = never;

const MODE_OVERRIDES: Partial<Record<CompanyMode, Record<string, SparseDictionary>>> = {
  bau: { de: bauDe, en: bauEn, sq: bauSq, it: bauIt, pl: bauPl, ro: bauRo },
};

export function resolveModeOverride(
  mode: CompanyMode | undefined,
  lang: string,
  path: string,
): string | undefined {
  if (!mode || mode === "baumdienst") return undefined;
  const langMap = MODE_OVERRIDES[mode]?.[lang];
  if (!langMap) return undefined;

  const segments = path.split(".");
  let current: unknown = langMap;
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

// Kept exported for tests / dev-tools that want the full override tree.
export const MODE_OVERRIDES_INTERNAL = MODE_OVERRIDES;

export type { BaumdienstModeOverrides };
