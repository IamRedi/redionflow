"use client";

import { Printer } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";

export function PrintButton() {
  const { currentLang } = useLanguage();
  const label = t("common.printPdf", currentLang);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      title={label}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-primary"
    >
      <Printer className="size-4" />
    </button>
  );
}
