import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print/PrintButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCompanyMode } from "@/lib/db/company";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import {
  baustelleStandort,
  coneActivity,
  type DailyReportActivity,
  formatReportDate,
  formatReportDateTime,
  getAdminDailyReport,
  inventoryActivity,
  treeAction,
  treeExtraOrigin,
  treeExtra,
  treeHaltverbot,
  treeWorkerNote,
} from "@/lib/workzone/reporting";

export default async function AdminOwnDayReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) notFound();
  const [currentLang, mode] = await Promise.all([resolveRequestLanguage(), getCompanyMode()]);
  const t = getTranslator(currentLang, mode);

  const { date } = await params;
  const report = await getAdminDailyReport(currentAdmin.id, date);
  if (!report.admin) notFound();

  const byBaustelle = new Map<
    string,
    {
      baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown };
      tasks: typeof report.tasks;
      trees: typeof report.trees;
      activities: DailyReportActivity[];
    }
  >();

  const ensureGroup = (baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown } | null | undefined) => {
    if (!baustelle) return null;
    if (!byBaustelle.has(baustelle.id)) byBaustelle.set(baustelle.id, { baustelle, tasks: [], trees: [], activities: [] });
    return byBaustelle.get(baustelle.id) ?? null;
  };

  for (const task of report.tasks) {
    ensureGroup(task.baustelle)?.tasks.push(task);
  }
  for (const tree of report.trees) {
    ensureGroup(tree.baustelle)?.trees.push(tree);
  }
  for (const movement of report.inventoryMovements) {
    ensureGroup(movement.baustelle)?.activities.push(inventoryActivity(movement, currentLang));
  }
  for (const movement of report.coneMovements) {
    const activity = coneActivity(movement, currentLang);
    if (!activity) continue;
    ensureGroup(movement.baustelle)?.activities.push(activity);
  }
  const groups = [...byBaustelle.values()]
    .map((group) => ({ ...group, activities: group.activities.sort((a, b) => a.time.getTime() - b.time.getTime()) }))
    .sort((a, b) => a.baustelle.name.localeCompare(b.baustelle.name));
  const reportDate = new Date(`${date}T00:00:00`);

  return (
    <div className="mx-auto max-w-5xl space-y-4 print:max-w-none print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline">
          <Link href="/app/dashboard">{t("report.back")}</Link>
        </Button>
        <PrintButton />
      </div>

      <Card className="border shadow-sm print:rounded-none print:border print:border-black print:bg-white print:shadow-none">
        <CardHeader className="border-b print:border-black print:px-4 print:py-3">
          <CardTitle>{t("report.adminDailyReport")}</CardTitle>
          <div className="grid gap-1 text-sm text-muted-foreground print:grid-cols-2 print:text-black">
            <p>{t("report.name")}: {report.admin.name ?? report.admin.email}</p>
            <p>{t("report.date")}: {formatReportDate(reportDate, currentLang)}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm print:px-4 print:py-4">
          {groups.length === 0 ? <p className="text-muted-foreground print:text-black">{t("report.noWorkForDay")}</p> : null}

          {groups.map((group) => (
            <section key={group.baustelle.id} className="break-inside-avoid space-y-3">
              <div className="print-fill rounded-md border p-3 print:rounded-none print:border-black">
                <h2 className="font-semibold">{group.baustelle.name}</h2>
                <p className="text-xs text-muted-foreground print:text-black">{t("report.location")}: {baustelleStandort(group.baustelle)}</p>
              </div>

              {group.activities.length > 0 ? (
                <div className="grid gap-2">
                  {group.activities.map((activity) => (
                    <div key={activity.id} className="rounded-md border bg-muted/20 p-3 print:rounded-none print:border-black print:bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground print:text-black">{formatReportDateTime(activity.time, currentLang)}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground print:text-black">{activity.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {group.tasks.length > 0 ? (
                <table className="w-full border-collapse border text-left text-sm print:border-black">
                  <thead>
                    <tr className="print:bg-zinc-100">
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.task")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="border px-3 py-2 print:border-black">{task.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              {group.trees.length > 0 ? (
                <table className="w-full border-collapse border text-left text-sm print:border-black">
                  <thead>
                    <tr className="print:bg-zinc-100">
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.id")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.species")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.diameter")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.crownWidth")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.height")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.note")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.halt")}</th>
                      <th className="border px-3 py-2 font-semibold print:border-black">{t("report.work")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.trees.map((tree) => (
                      <tr key={tree.id}>
                        <td className="border px-3 py-2 print:border-black">
                          {tree.treeId}
                          {treeExtraOrigin(tree, currentLang) ? <div className="text-[11px] text-amber-700 print:text-black">{treeExtraOrigin(tree, currentLang)}</div> : null}
                        </td>
                        <td className="border px-3 py-2 print:border-black">{tree.species || "-"}</td>
                        <td className="border px-3 py-2 print:border-black">{tree.diameter ?? "-"}</td>
                        <td className="border px-3 py-2 print:border-black">{treeExtra(tree, ["crownWidth", "kronenbreite", "kronenBreite"])}</td>
                        <td className="border px-3 py-2 print:border-black">{treeExtra(tree, ["height", "hoehe", "lartesi"])}</td>
                        <td className="border px-3 py-2 print:border-black">{treeWorkerNote(tree)}</td>
                        <td className="border px-3 py-2 print:border-black">{treeHaltverbot(tree) ? "🅿️🚫" : "-"}</td>
                        <td className="border px-3 py-2 print:border-black">{treeAction(tree, currentLang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
