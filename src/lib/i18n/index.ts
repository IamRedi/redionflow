import type { CompanyMode } from "@/lib/mode-config";
import { de, en, it, pl, ro, sq } from "./dictionaries";
import { resolveModeOverride } from "./mode-overrides";

export const translations = {
  de,
  sq,
  en,
  it,
  pl,
  ro,
} as const;

export type Language = keyof typeof translations;
export type { TranslationKey } from "./dictionaries";

function resolvePath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (
      current &&
      typeof current === "object" &&
      key in current
    ) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
}

/**
 * T-029: `t()` is mode-aware. Callers that have the company mode in scope
 * (server components after `getCompanyMode()`) should pass it as the third
 * arg so BauFlow tenants get construction-friendly wording.
 *
 * Callers that omit `mode` (or pass `baumdienst`) get the original strings —
 * fully backwards compatible.
 *
 * Fallback order: mode override (target lang) → base translation (target
 * lang) → base English (unless target is English, then German) → base German.
 */
export function t(path: string, lang?: string, mode?: CompanyMode): string {
  const override = resolveModeOverride(mode, lang ?? "de", path);
  if (override) return override;

  const selected = lang && lang in translations ? translations[lang as Language] : de;
  const value = resolvePath(selected, path);
  const englishFallback = resolvePath(en, path);
  const finalFallback = resolvePath(de, path);

  if (typeof value === "string") {
    if (
      lang &&
      lang !== "de" &&
      typeof finalFallback === "string" &&
      value === finalFallback &&
      typeof englishFallback === "string" &&
      englishFallback !== finalFallback
    ) {
      return englishFallback;
    }
    return value;
  }
  if (typeof englishFallback === "string") return englishFallback;
  if (typeof finalFallback === "string") return finalFallback;

  return path;
}

/**
 * Convenience factory for surfaces that repeatedly translate strings with
 * the same lang + mode context (server components, page layouts).
 */
export function getTranslator(lang?: string, mode?: CompanyMode) {
  return (path: string) => t(path, lang, mode);
}
