"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { planCopy } from "./plan-copy";

/** Small info button on a site: glows when today's plan has a note for it; a tap opens the note. */
export function PlanNoteButton({ note, siteName, className = "size-8" }: { note: string | null | undefined; siteName: string; className?: string }) {
  const { currentLang } = useLanguage();
  const c = planCopy(currentLang);
  const [open, setOpen] = useState(false);
  const text = note?.trim() ?? "";
  if (!text) return null;
  return (
    <>
      <button type="button" data-testid="plan-note-button" title={c.siteNote} aria-label={`${c.siteNote}: ${siteName}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); event.preventDefault(); setOpen(true); }}
        className={`relative grid shrink-0 place-items-center rounded-lg border border-orange-500/60 bg-orange-500/15 text-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.45)] transition hover:bg-orange-500/25 dark:text-orange-300 ${className}`}>
        <Info className="size-3.5" aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-orange-500" aria-hidden />
      </button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/45 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={c.siteNote} data-testid="plan-note-dialog" onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-300"><Info className="size-5" aria-hidden /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.siteNote}</p>
                <p className="truncate text-sm font-semibold">{siteName}</p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-muted px-3 py-2.5 text-sm">{text}</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-3 h-10 w-full rounded-xl border text-sm font-semibold hover:bg-muted">{c.close}</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
