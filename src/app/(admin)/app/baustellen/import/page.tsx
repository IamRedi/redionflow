import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCompanyMode } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { ImportForm } from "./import-form";

export default async function BaustellenImportPage({
  searchParams,
}: {
  searchParams: Promise<{ targetBaustelleId?: string; targetName?: string }>;
}) {
  const { targetBaustelleId, targetName } = await searchParams;
  const [currentLang, mode] = await Promise.all([resolveRequestLanguage(), getCompanyMode()]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("admin.baustellenImportHeading", currentLang, mode)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.baustellenImportSubtitle", currentLang, mode)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/baustellen">{t("admin.backToOverview", currentLang, mode)}</Link>
        </Button>
      </div>

      <ImportForm targetBaustelleId={targetBaustelleId} targetName={targetName} currentLang={currentLang} companyMode={mode} />
    </div>
  );
}
