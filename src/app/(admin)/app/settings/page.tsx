import { SettingsForm } from "./settings-form";
import { CompanyLogoForm } from "./company-logo-form";
import { safeCompanyLogo } from "@/lib/company-logo";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { decimalToNumber } from "@/lib/db/prisma-types";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { regionConfig, resolveCountry } from "@/lib/region";
import Link from "next/link";
import { wanwayEnabled } from "@/lib/fleet/wanway/service";
import { wanwayCopy } from "@/lib/fleet/wanway/copy";

export default async function SettingsPage() {
  const [company, mode, currentLang] = await Promise.all([
    getOrCreateDefaultCompany(),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);
  const overhead = company.overheadSettings;

  const defaultValues = {
    displayName: company.displayName,
    legalName: company.legalName,
    country: resolveCountry(company.country),
    bgkPct: overhead ? decimalToNumber(overhead.bgkPct) * 100 : 18,
    agkPct: overhead ? decimalToNumber(overhead.agkPct) * 100 : 10,
    riskPct: overhead ? decimalToNumber(overhead.riskPct) * 100 : 3,
    profitPct: overhead ? decimalToNumber(overhead.profitPct) * 100 : 6,
    vatPct: overhead ? decimalToNumber(overhead.vatPct) * 100 : regionConfig(company.country).defaultVatPct,
    bgkBase: (overhead?.bgkBase ?? "EK_TOTAL") as "EK_TOTAL" | "LABOR_ONLY",
    riskProfitMode: (overhead?.riskProfitMode ?? "SEPARATE") as "SEPARATE" | "COMBINED",
    applyVatByDefault: overhead?.applyVatByDefault ?? true,
    fleetGpsEnabled: company.fleetGpsEnabled,
    workerPhoneGpsEnabled: company.workerPhoneGpsEnabled,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.settingsHeading", currentLang, mode)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.settingsSubtitle", currentLang, mode)}
        </p>
      </div>

      <SettingsForm companyId={company.id} currentLang={currentLang} defaultValues={defaultValues} />

      <CompanyLogoForm currentLang={currentLang} logo={safeCompanyLogo(company.logoDataUrl)} companyName={company.displayName} />

      {wanwayEnabled() && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">{wanwayCopy(currentLang).integrations}</h2><Link href="/app/settings/integrations/wanway" className="mt-3 inline-block text-sm font-medium text-primary underline">{`${wanwayCopy(currentLang).title} →`}</Link></section>}

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <h2 className="text-base font-semibold">{t("admin.dataExportHeading", currentLang, mode)}</h2>
            <p className="text-sm text-muted-foreground">
              {t("admin.dataExportDescription", currentLang, mode)}
            </p>
          </div>
          <a
            href="/api/portability/export"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            {t("admin.downloadJson", currentLang, mode)}
          </a>
        </div>
      </div>
    </div>
  );
}

