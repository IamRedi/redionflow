"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, ExternalLink, X } from "lucide-react";

type Props = {
  url: string;
  label: string;
  closeLabel: string;
  newTabLabel: string;
  variant?: "icon" | "button";
};

/**
 * Opens the KiDraht Assistant inside BaumdienstFlow as a full-screen panel.
 * KiDraht stays its own app (own login with PIN); this only frames it.
 */
export function KidrahtLauncher({ url, label, closeLabel, newTabLabel, variant = "button" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={label}
          aria-label={label}
          className="inline-flex size-8 items-center justify-center rounded-full border border-teal-500/30 bg-gradient-to-br from-teal-500/20 to-orange-300/20 text-teal-700 shadow-sm transition hover:from-teal-500/30 hover:to-orange-300/30 dark:text-teal-300"
        >
          <BookOpenCheck className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 ring-1 ring-white/20 transition hover:from-teal-400 hover:to-teal-600 active:scale-[0.98]"
        >
          <BookOpenCheck className="size-4" />
          {label}
        </button>
      )}

      {open ? (
        <div role="dialog" aria-modal="true" aria-label="KiDraht" className="fixed inset-0 z-[3000] flex flex-col bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f2a33] shadow-2xl ring-1 ring-teal-400/20 sm:rounded-2xl">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3 text-white">
              <BookOpenCheck className="size-4 text-teal-300" />
              <span className="text-sm font-semibold tracking-wide">KiDraht</span>
              <span className="flex-1" />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={newTabLabel}
                aria-label={newTabLabel}
                className="inline-flex size-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title={closeLabel}
                aria-label={closeLabel}
                className="inline-flex size-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <iframe src={url} title="KiDraht" className="min-h-0 w-full flex-1 border-0 bg-[#0f2a33]" referrerPolicy="no-referrer" />
          </div>
        </div>
      ) : null}
    </>
  );
}
