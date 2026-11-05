"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Megaphone } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { updateWorkzoneAnnouncementAction } from "./announcement-actions";

export function TopbarAnnouncementButton({ message, className = "" }: { message: string | null; className?: string }) {
  const { currentLang } = useLanguage();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popupLeft, setPopupLeft] = useState(0);
  const [isPending, startTransition] = useTransition();

  function toggleEditor() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(360, window.innerWidth - 32);
      setPopupLeft(Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)) - rect.left);
    }
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const scroll = (event: Event) => {
      if (event.target === document || (event.target instanceof HTMLElement && event.target.matches('[data-testid="app-workspace-scroll"]'))) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", scroll, true); window.removeEventListener("keydown", escape); };
  }, [open]);

  function submitAnnouncement(formData: FormData) {
    startTransition(() => {
      void updateWorkzoneAnnouncementAction(formData).then(() => {
        setOpen(false);
      });
    });
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="icon"
        className={`size-9 rounded-full bg-background/85 text-foreground/80 shadow-sm hover:bg-muted hover:text-foreground ${className}`}
        title={t("workzone.announcementPlaceholder", currentLang)}
        aria-label={t("workzone.announcementPlaceholder", currentLang)}
        aria-expanded={open}
        onClick={toggleEditor}
      >
        <Megaphone className="size-4" />
      </Button>
      {open ? (
        <form
          action={submitAnnouncement}
          className="absolute top-full z-40 mt-2 grid w-[min(360px,calc(100vw-2rem))] gap-2 rounded-md border bg-background p-3 shadow-xl"
          style={{ left: popupLeft }}
        >
          <textarea
            name="message"
            rows={3}
            maxLength={220}
            defaultValue={message ?? ""}
            placeholder={t("workzone.announcementPlaceholderToday", currentLang)}
            className="min-h-20 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{t("workzone.announcementHint", currentLang)}</span>
            <Button type="submit" size="sm" disabled={isPending}>
              {t("workzone.publish", currentLang)}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
