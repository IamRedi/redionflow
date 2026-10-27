import Link from "next/link";
import { redirect } from "next/navigation";

import { PrintButton } from "@/components/print/PrintButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyMode } from "@/lib/db/company";
import { getFeatures } from "@/lib/mode-config";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import {
  baustelleStandort,
  formatReportDate,
  formatReportDateTime,
  formatReportTime,
  getWorkerDailyReport,
  groupDailyWorkByBaustelle,
  parseReportMessages,
  treeAction,
  treeExtraOrigin,
  treeExtra,
  treeHaltverbot,
  treeWorkerNote,
} from "@/lib/workzone/reporting";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { ReportNoteForm } from "../../report-note-form";
import { ReportPeriodPicker } from "../../report-period-picker";

export default async function DailyReportPage({ params }: { params: Promise<{ date: string }> }) {
  const current = await getCurrentWorker();
  if (!current) redirect("/workzone/login");
  const [currentLang, mode] = await Promise.all([resolveRequestLanguage(), getCompanyMode()]);
  const t = getTranslator(currentLang, mode);
  const showTreeFields = getFeatures(mode).trees;

  const { date } = await params;
  const report = await getWorkerDailyReport(current.id, date);
  if (!report.worker) redirect("/workzone/login");

  const groups = groupDailyWorkByBaustelle(report, currentLang);
  const reportDate = new Date(`${date}T00:00:00`);
  const noteMessages = parseReportMessages(report.note?.note, currentLang);

  return (
    <div className="mx-auto max-w-5xl space-y-4 print:max-w-none print:text-black">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline">
          <Link href="/workzone/profile">{t("report.back")}</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <ReportPeriodPicker mode="worker" reportType="day" initialValue={date} buttonLabel={t("report.showDay")} />
          <PrintButton />
        </div>
      </div>

      <Card className="border shadow-sm print:rounded-none print:border print:border-black print:bg-white print:shadow-none">
        <CardHeader className="border-b print:border-black print:px-4 print:py-3">
          <CardTitle>{t("report.dayReport")}</CardTitle>
          <div className="grid gap-1 text-sm text-muted-foreground print:grid-cols-2 print:text-black">
            <p>
              {t("report.name")}: {report.worker.firstName} {report.worker.lastName}
            </p>
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
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground print:text-black sm:grid-cols-2">
                  <p>
                    {t("report.workingTime")}:{" "}
                    {group.sessions.length
                      ? group.sessions
                          .map((session) => `${formatReportTime(session.startTime, currentLang)}-${formatReportTime(session.endTime, currentLang)}`)
                          .join(", ")
                      : "-"}
                  </p>
                  <p>{t("report.colleagues")}: {group.colleagues.length ? group.colleagues.join(", ") : "-"}</p>
                </div>
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

              {group.machinePresences.length > 0 ? (
                <div className="rounded-md border p-3 print:rounded-none print:border-black">
                  <h3 className="text-sm font-semibold">{t("report.machineGps")}</h3>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground print:text-black">
                    {group.machinePresences.map((presence) => (
                      <p key={presence.id}>
                        {presence.machine.nickname ?? presence.machine.name}
                        {presence.machine.targe ? ` (${presence.machine.targe})` : ""}: {formatReportTime(presence.enteredAt, currentLang)}-
                        {presence.leftAt ? formatReportTime(presence.leftAt, currentLang) : "live"}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {group.tasks.length > 0 ? (
                <table className="w-full border-collapse border text-left text-sm print:border-black">
                  <thead>
                    <tr className="border-b print:border-black print:bg-zinc-100">
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
                      {showTreeFields ? (
                        <>
                          <th className="border px-3 py-2 font-semibold print:border-black">{t("report.crownWidth")}</th>
                          <th className="border px-3 py-2 font-semibold print:border-black">{t("report.height")}</th>
                        </>
                      ) : null}
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
                        {showTreeFields ? (
                          <>
                            <td className="border px-3 py-2 print:border-black">{treeExtra(tree, ["crownWidth", "kronenbreite", "kronenBreite"])}</td>
                            <td className="border px-3 py-2 print:border-black">{treeExtra(tree, ["height", "hoehe", "lartesi"])}</td>
                          </>
                        ) : null}
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

          <div className="print:hidden">
            <ReportNoteForm workerId={current.id} type="DAILY" periodKey={date} initialNote={report.note?.note ?? ""} companyProfileId={current.companyProfileId} />
          </div>
          <section className="hidden space-y-2 print:block">
            <h2 className="font-semibold">{t("report.notes")}</h2>
            <div className="min-h-28 space-y-2 border border-black p-3">
              {noteMessages.map((message) => (
                <p key={message.id}>
                  <strong>{message.authorName}:</strong> {message.text}
                </p>
              ))}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
