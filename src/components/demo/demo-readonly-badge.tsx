import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export async function DemoReadonlyBadge({ compact = false }: { compact?: boolean }) {
  const currentLang = await resolveRequestLanguage();

  return (
    <div
      className={
        compact
          ? "inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300"
          : "inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300"
      }
    >
      {t("admin.publicDemo", currentLang)}
    </div>
  );
}
