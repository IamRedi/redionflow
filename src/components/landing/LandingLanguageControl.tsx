"use client";

import { useEffect, useMemo, useRef } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { LANGUAGE_COOKIE, LANGUAGE_STORAGE_KEY, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/language";
import type { LandingContent, LandingLanguage } from "./landing-content";
import { normalizeLandingLanguage } from "./landing-content";

function detectBrowserLanguage(): LandingLanguage {
  if (typeof window === "undefined") return "de";
  const candidates = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  for (const candidate of candidates) {
    const root = candidate.toLowerCase().split("-")[0];
    const normalized = normalizeLanguage(root);
    if (normalized) return normalized;
  }
  return "de";
}

function readStoredLandingLanguage(): LandingLanguage | null {
  if (typeof window === "undefined") return null;
  const stored = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  return stored;
}

function hasStoredLanguage() {
  if (typeof window === "undefined") return true;
  const hasLocal = Boolean(readStoredLandingLanguage());
  const hasCookie = document.cookie.split(";").some((part) => part.trim().startsWith(`${LANGUAGE_COOKIE}=`));
  return hasLocal || hasCookie;
}

export function LandingLanguageControl({ content }: { content: LandingContent["language"] }) {
  const { currentLang, setLang } = useLanguage();
  const autoAppliedRef = useRef(false);
  const selected = normalizeLandingLanguage(currentLang);
  const options = useMemo<Array<{ value: LandingLanguage; label: string }>>(
    () => [
      { value: "de", label: content.options.de },
      { value: "en", label: content.options.en },
      { value: "sq", label: content.options.sq },
      { value: "it", label: content.options.it },
      { value: "pl", label: content.options.pl },
      { value: "ro", label: content.options.ro },
    ],
    [content.options.de, content.options.en, content.options.it, content.options.pl, content.options.ro, content.options.sq],
  );

  useEffect(() => {
    if (autoAppliedRef.current) return;
    const stored = readStoredLandingLanguage();
    if (stored) {
      autoAppliedRef.current = true;
      if (stored !== selected) setLang(stored);
      return;
    }
    if (hasStoredLanguage()) return;
    const detected = detectBrowserLanguage();
    autoAppliedRef.current = true;
    if (detected !== selected) setLang(detected);
  }, [selected, setLang]);

  return (
    <div className="fixed left-3 top-3 z-[1000] flex max-w-[calc(100vw-7rem)] items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <label htmlFor="landing-language" className="whitespace-nowrap font-semibold text-foreground/80">
        {content.label}
      </label>
      <select
        id="landing-language"
        value={selected}
        onChange={(event) => setLang(event.target.value as SupportedLanguage)}
        title={content.auto}
        className="min-w-0 rounded-full border border-border/70 bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-emerald-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
