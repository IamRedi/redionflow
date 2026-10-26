"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { normalizeLandingLanguage } from "./landing-content";

const sections = [
  { id: "overview", key: "overview" },
  { id: "betrieb", key: "operation" },
  { id: "verwaltung", key: "management" },
  { id: "smart", key: "smart" },
] as const;

const labels = {
  de: { overview: "Ueberblick", operation: "Tagesbetrieb", management: "Verwaltung", smart: "Smart Flow" },
  en: { overview: "Overview", operation: "Daily work", management: "Management", smart: "Smart Flow" },
  it: { overview: "Panoramica", operation: "Lavoro giornaliero", management: "Gestione", smart: "Smart Flow" },
  pl: { overview: "Przeglad", operation: "Dzien pracy", management: "Zarzadzanie", smart: "Smart Flow" },
  ro: { overview: "Prezentare", operation: "Ziua de lucru", management: "Administrare", smart: "Smart Flow" },
  sq: { overview: "Pamje", operation: "Dita e punes", management: "Administrim", smart: "Smart Flow" },
} as const;

// BDF-P8-007 Phase 2: aria-labels routed through the same per-language
// dictionary the visible labels already use. Screen-reader users see the
// nav landmark announcement in their selected office language instead of
// English regardless of the switcher.
const ariaLabels = {
  de: {
    desktop: "Landing-Bereiche",
    toggle: "Bereichsnavigation umschalten",
    mobile: "Landing-Bereiche (Mobil)",
  },
  en: {
    desktop: "Landing page sections",
    toggle: "Toggle section navigation",
    mobile: "Landing page sections mobile",
  },
  it: {
    desktop: "Sezioni della pagina di destinazione",
    toggle: "Attiva/disattiva la navigazione tra sezioni",
    mobile: "Sezioni della pagina di destinazione (mobile)",
  },
  pl: {
    desktop: "Sekcje strony powitalnej",
    toggle: "Przelacz nawigacje sekcji",
    mobile: "Sekcje strony powitalnej (mobilne)",
  },
  ro: {
    desktop: "Sectiuni pagina de intrare",
    toggle: "Comuta navigarea intre sectiuni",
    mobile: "Sectiuni pagina de intrare (mobil)",
  },
  sq: {
    desktop: "Seksionet e faqes hyrese",
    toggle: "Ndrysho navigimin e seksioneve",
    mobile: "Seksionet e faqes hyrese (celular)",
  },
} as const;

export function SideNavigation() {
  const { currentLang } = useLanguage();
  const landingLang = normalizeLandingLanguage(currentLang);
  const [activeSection, setActiveSection] = useState<string>(sections[0].id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        root: null,
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.12, 0.24, 0.36, 0.48, 0.6],
      },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      <nav
        aria-label={ariaLabels[landingLang].desktop}
        className="fixed left-3 top-[5.2rem] z-[900] hidden md:block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="absolute left-0 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/88 text-foreground/72 shadow-sm backdrop-blur transition hover:text-foreground"
            aria-label={ariaLabels[landingLang].toggle}
            aria-expanded={open}
          >
            <ChevronRight className={`size-4 transition ${open ? "rotate-180" : ""}`} />
          </button>

          <div
            className={`ml-3 overflow-hidden rounded-lg border border-border/60 bg-background/90 shadow-sm backdrop-blur transition-all duration-200 ${
              open ? "w-[10.5rem] px-3 py-3 opacity-100" : "w-0 px-0 py-0 opacity-0"
            }`}
          >
            <div className="flex flex-col items-stretch gap-1.5">
              {sections.map((section) => {
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      scrollToSection(section.id);
                      setOpen(false);
                    }}
                    className={`rounded-md px-3 py-2 text-left text-xs font-semibold transition ${
                      isActive
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-foreground/70 hover:bg-emerald-500/10 hover:text-foreground"
                    }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {labels[landingLang][section.key]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <nav
        aria-label={ariaLabels[landingLang].mobile}
        className="fixed inset-x-3 top-[4.75rem] z-[900] overflow-x-auto rounded-lg border border-border/70 bg-background/90 px-2 py-2 shadow-sm backdrop-blur no-scrollbar md:hidden"
      >
        <div className="flex items-center gap-1.5">
          {sections.map((section) => {
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-foreground/70 hover:bg-emerald-500/10 hover:text-foreground"
                }`}
                aria-current={isActive ? "true" : undefined}
              >
                {labels[landingLang][section.key]}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
