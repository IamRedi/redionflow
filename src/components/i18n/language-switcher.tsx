"use client";

import { Languages } from "lucide-react";

import { t } from "@/lib/i18n";
import { cycleLanguage, type SupportedLanguage } from "@/lib/i18n/language";
import { useLanguage } from "./language-provider";

function label(lang: SupportedLanguage) {
  return lang.toUpperCase();
}

export function LanguageSwitcher() {
  const { currentLang, setLang } = useLanguage();
  const title = `${t("workzone.language", currentLang)}: ${label(currentLang)}`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border bg-background/80 px-2 text-[10px] font-semibold text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
      onClick={() => setLang(cycleLanguage(currentLang))}
    >
      <Languages className="size-3" />
      <span>{label(currentLang)}</span>
    </button>
  );
}
