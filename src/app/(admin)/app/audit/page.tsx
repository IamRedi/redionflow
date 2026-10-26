import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { listAuditEntries } from "@/lib/audit/log";
import { getCompanyMode } from "@/lib/db/company";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { reportLocale } from "@/lib/workzone/date-utils";

export const dynamic = "force-dynamic";

function formatWhen(value: Date, lang?: string) {
  return value.toLocaleString(reportLocale(lang), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AuditLogPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin-login");

  const companyProfileId = await getCurrentCompanyId();
  if (!companyProfileId) redirect("/admin-login");

  const [entries, mode, currentLang] = await Promise.all([
    listAuditEntries(companyProfileId, 200),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t("admin.auditHeading", currentLang, mode)}</h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.auditSubtitle", currentLang, mode)}
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border bg-card">
        {entries.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {t("admin.auditEmpty", currentLang, mode)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">{t("admin.auditColumnTime", currentLang, mode)}</th>
                <th className="px-4 py-2 text-left font-semibold">{t("admin.auditColumnActor", currentLang, mode)}</th>
                <th className="px-4 py-2 text-left font-semibold">{t("admin.auditColumnAction", currentLang, mode)}</th>
                <th className="px-4 py-2 text-left font-semibold">{t("admin.auditColumnDetails", currentLang, mode)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-b-0 align-top">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatWhen(entry.createdAt, currentLang)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      {entry.actorType}
                    </span>
                    {entry.actorId ? (
                      <div className="mt-1 text-muted-foreground">{entry.actorId}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-2">
                    <pre className="max-w-md whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
