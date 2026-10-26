import type { Language } from "./index";

export const LANGUAGE_STORAGE_KEY = "bk_lang";
export const LANGUAGE_COOKIE = "bk_lang";
export const SUPPORTED_LANGUAGES = ["de", "en", "sq", "it", "pl", "ro"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (isSupportedLanguage(normalized)) return normalized;
  return null;
}

export function mapProfileLanguage(value: string | null | undefined): SupportedLanguage | null {
  const normalized = normalizeLanguage(value);
  if (normalized) return normalized;

  const upper = value?.trim().toUpperCase();
  if (upper === "DE") return "de";
  if (upper === "EN") return "en";
  if (upper === "SQ") return "sq";
  if (upper === "IT") return "it";
  if (upper === "PL") return "pl";
  if (upper === "RO") return "ro";

  return null;
}

export function resolveDefaultLanguageForUser(profileLanguage: string | null | undefined): SupportedLanguage {
  const normalized = mapProfileLanguage(profileLanguage);
  if (!normalized) return "de";
  return normalized;
}

export function readStoredLanguageOverride(): SupportedLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getCurrentLanguage(userLanguage?: string | null): SupportedLanguage {
  const stored = readStoredLanguageOverride();
  if (stored) return stored;
  return resolveDefaultLanguageForUser(userLanguage);
}

/**
 * Parse an Accept-Language header and return the first supported language.
 * Falls back to null if nothing matches. Q-values are respected loosely
 * (higher-priority entries win, order used as tiebreaker).
 */
export function pickLanguageFromAcceptHeader(header: string | null | undefined): SupportedLanguage | null {
  if (!header) return null;
  const entries = header
    .split(",")
    .map((raw, index) => {
      const [tag, ...params] = raw.trim().split(";").map((s) => s.trim());
      if (!tag) return null;
      const qParam = params.find((p) => p.startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((e): e is { tag: string; q: number; index: number } => e !== null && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of entries) {
    const base = tag.split("-")[0];
    if (isSupportedLanguage(base)) return base;
  }
  return null;
}

export function cycleLanguage(current: Language | string): SupportedLanguage {
  const normalized = normalizeLanguage(current) ?? "de";
  const index = SUPPORTED_LANGUAGES.indexOf(normalized);
  return SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length] ?? "de";
}
