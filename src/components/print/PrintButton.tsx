"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function PrintButton() {
  const { currentLang } = useLanguage();

  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      {t("common.printPdf", currentLang)}
    </Button>
  );
}
