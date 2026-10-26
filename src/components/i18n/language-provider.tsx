"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { LANGUAGE_COOKIE, LANGUAGE_STORAGE_KEY, normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/language";

type LanguageContextValue = {
  currentLang: SupportedLanguage;
  setLang: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang: SupportedLanguage;
}) {
  const router = useRouter();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(initialLang);

  function setLang(lang: string) {
    const normalized = normalizeLanguage(lang);
    if (!normalized) return;
    setCurrentLang(normalized);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      document.cookie = `${LANGUAGE_COOKIE}=${normalized}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
    router.refresh();
  }

  return <LanguageContext.Provider value={{ currentLang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
