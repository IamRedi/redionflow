"use client";

import { useRef, useState, useTransition } from "react";
import { Megaphone } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { updateWorkzoneAnnouncementAction } from "./announcement-actions";

export function TopbarAnnouncementButton({ message }: { message: string | null }) {
  const { currentLang } = useLanguage();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("left");
  const [isPending, startTransition] = useTransition();

  function toggleEditor() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setSide(rect.left + rect.width / 2 > window.innerWidth / 2 ? "left" : "right");
    }
    setOpen((value) => !value);
  }

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
        className="size-9 rounded-full bg-background/85 text-foreground/80 shadow-sm hover:bg-muted hover:text-foreground"
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
          className={`absolute top-11 z-40 grid w-[min(360px,calc(100vw-2rem))] gap-2 rounded-md border bg-background p-3 shadow-xl ${
            side === "left" ? "right-0" : "left-0"
          }`}
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
