import { SafetyOverviewSection } from "@/app/(admin)/app/admin/safety-overview-section";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export default async function SafetyAdminPage() {
  const currentLang = await resolveRequestLanguage();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("admin.safetyPageTitle", currentLang)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.safetyPageDescription", currentLang)}
        </p>
      </div>

      <SafetyOverviewSection currentLang={currentLang} />
    </div>
  );
}
