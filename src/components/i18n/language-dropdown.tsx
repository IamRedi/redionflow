"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";

import { cn } from "@/lib/ui/cn";
import type { SupportedLanguage } from "@/lib/i18n/language";
import { useLanguage } from "./language-provider";

/**
 * Admin-side language dropdown.
 *
 * Shows four production languages (de, en, sq, it) as a compact
 * click-to-open menu. Worker surfaces continue to use the tiny cycle
 * button; the dropdown is intentionally admin-only so office users get a
 * fast pick without cycling.
 *
 * Storage: LanguageProvider persists the choice to a cookie + localStorage,
 * so the next request already renders in the picked language.
 */

type LanguageOption = {
  code: SupportedLanguage;
  label: string;
  flag: string;
};

const OPTIONS: LanguageOption[] = [
  { code: "de", label: "Deutsch",   flag: "🇩🇪" },
  { code: "en", label: "English",   flag: "🇬🇧" },
  { code: "sq", label: "Shqip",     flag: "🇦🇱" },
  { code: "it", label: "Italiano",  flag: "🇮🇹" },
];

export function LanguageDropdown() {
  const { currentLang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const active = OPTIONS.find((option) => option.code === currentLang) ?? OPTIONS[0];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-background/80 px-3 py-2 text-[13px] font-medium shadow-sm backdrop-blur transition hover:bg-muted",
          open && "bg-muted",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Languages className="size-3.5 text-muted-foreground" />
          <span className="text-base leading-none">{active.flag}</span>
          <span className="truncate">{active.label}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg"
        >
          {OPTIONS.map((option) => {
            const isActive = option.code === active.code;
            return (
              <li key={option.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setLang(option.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-muted",
                    isActive && "bg-muted font-semibold",
                  )}
                >
                  <span className="text-base leading-none">{option.flag}</span>
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {option.code}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
