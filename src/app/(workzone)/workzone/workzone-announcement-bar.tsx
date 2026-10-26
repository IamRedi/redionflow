"use client";

import { Megaphone } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";

export function WorkzoneAnnouncementBar({
  message,
  authorName,
}: {
  message: string | null;
  authorName: string | null;
}) {
  const hasMessage = Boolean(message?.trim());
  const text = `${authorName?.trim() ? `${authorName.trim()}: ` : ""}${message?.trim() ?? ""}`;

  if (!hasMessage) return null;

  return (
    <div className="relative z-0 inline-flex min-h-9 min-w-0 max-w-full rounded-full border bg-background/75 px-3 py-1.5 shadow-sm backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <Megaphone className="size-4 shrink-0 text-brand-green" />
        <div className="min-w-0 max-w-[min(100%,64rem)] text-xs font-medium leading-5 text-foreground">
          <span className="break-words">{text}</span>
        </div>
      </div>
    </div>
  );
}
