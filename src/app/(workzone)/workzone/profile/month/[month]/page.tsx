import Link from "next/link";
import { redirect } from "next/navigation";

import { PrintButton } from "@/components/print/PrintButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyMode } from "@/lib/db/company";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { formatReportTime, getWorkerMonthlyReport, monthlySessionRows, parseReportMessages } from "@/lib/workzone/reporting";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { ReportNoteForm } from "../../report-note-form";
import { ReportPeriodPicker } from "../../report-period-picker";

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }) {
  const [{ month }, currentLang] = await Promise.all([params, resolveRequestLanguage()]);
  const t = getTranslator(currentLang);
  return {
    title: `${t("report.brandName")} - ${t("report.monthly")} ${month}`,
  };
}

export default async function MonthlyReportPage({ params }: { params: Promise<{ month: string }> }) {
  const current = await getCurrentWorker();
  if (!current) redirect("/workzone/login");
  const [currentLang, mode] = await Promise.all([resolveRequestLanguage(), getCompanyMode()]);
  const t = getTranslator(currentLang, mode);

  const { month } = await params;
  const report = await getWorkerMonthlyReport(current.id, month);
  if (!report.worker) redirect("/workzone/login");

  const rows = monthlySessionRows(report, month, currentLang);
  const total = rows.reduce((sum, row) => sum + row.totalHours, 0);
  const noteMessages = parseReportMessages(report.note?.note, currentLang);
  const adminTimeRows = noteMessages
    .filter((message) => message.authorRole === "Admin" && message.text.startsWith("KOHE|"))
    .map((message) => {
      const [, startIso, endIso] = message.text.split("|");
      const start = new Date(startIso ?? "");
      const end = new Date(endIso ?? "");
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      return {
        id: message.id,
        date: start.toLocaleDateString(currentLang === "en" ? "en-US" : currentLang === "it" ? "it-IT" : currentLang === "sq" ? "sq-AL" : currentLang === "ro" ? "ro-RO" : currentLang === "pl" ? "pl-PL" : "de-DE", { day: "2-digit", month: "2-digit" }),
        start: formatReportTime(start, currentLang),
        end: formatReportTime(end, currentLang),
      };
    })
    .filter((row): row is { id: string; date: string; start: string; end: string } => Boolean(row));

  return (
    <div className="mx-auto max-w-6xl space-y-4 print:max-w-none print:text-black">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline">
          <Link href="/workzone/profile">{t("report.back")}</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <ReportPeriodPicker mode="worker" reportType="month" initialValue={month} buttonLabel={t("report.showMonth")} />
          <PrintButton />
        </div>
      </div>

      <Card className="border shadow-sm print:rounded-none print:border print:border-black print:bg-white print:shadow-none">
        <CardHeader className="border-b print:border-black print:px-4 print:py-3">
          <div className="hidden text-center text-sm font-semibold print:block">{t("report.brandName")}</div>
          <CardTitle>
            {t("report.monthly")} {month}
          </CardTitle>
          <div className="grid gap-1 text-sm text-muted-foreground print:grid-cols-2 print:text-black">
            <p>
              {t("report.name")}: {report.worker.firstName} {report.worker.lastName}
            </p>
            <p>
              {t("report.month")}: {month}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm print:space-y-3 print:px-4 print:py-3">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="stundenzettel-table w-full min-w-[760px] border-collapse border text-left text-sm print:min-w-0 print:border-black">
              <thead>
                <tr className="print:bg-zinc-100">
                  <th className="border px-3 py-2 font-semibold print:border-black">{t("report.number")}</th>
                  <th className="border px-3 py-2 font-semibold print:border-black">{t("report.day")}</th>
                  <th className="border px-3 py-2 font-semibold print:border-black">{t("report.start")}</th>
                  <th className="border px-3 py-2 font-semibold print:border-black">{t("report.end")}</th>
                  <th className="border px-3 py-2 font-semibold print:border-black">{t("report.break")}</th>
                  <th className="border px-3 py-2 font-semibold print:border-black">{t("report.siteLocation")}</th>
                  <th className="border px-3 py-2 text-right font-semibold print:border-black">{t("report.hours")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date}>
                    <td className="border px-3 py-2 print:border-black">{row.dayOfMonth}</td>
                    <td className="border px-3 py-2 print:border-black">{row.dayName}</td>
                    <td className="border px-3 py-2 print:border-black">{formatReportTime(row.startTime, currentLang)}</td>
                    <td className="border px-3 py-2 print:border-black">{formatReportTime(row.endTime, currentLang)}</td>
                    <td className="border px-3 py-2 print:border-black">{row.hasWork ? `${row.breakMinutes} min` : "-"}</td>
                    <td className="border px-3 py-2 print:border-black">{row.locations}</td>
                    <td className="border px-3 py-2 text-right print:border-black">{row.hasWork ? row.totalHours.toFixed(2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="print:bg-zinc-100">
                  <td className="border px-3 py-2 font-semibold print:border-black" colSpan={6}>
                    {t("report.total")}
                  </td>
                  <td className="border px-3 py-2 text-right font-semibold print:border-black">{total.toFixed(2)} {t("report.hourShort")}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <section className="grid gap-12 pt-8 print:grid-cols-2">
            <div className="border-t border-black pt-2 text-sm">{t("report.employerCompany")}</div>
            <div className="border-t border-black pt-2 text-sm">{t("report.employeeCompany")}</div>
          </section>
        </CardContent>
      </Card>

      <div className="print:hidden">
        <ReportNoteForm workerId={current.id} type="MONTHLY" periodKey={month} initialNote={report.note?.note ?? ""} companyProfileId={current.companyProfileId} />
      </div>

      <Card className="border shadow-sm print:break-before-page print:rounded-none print:border print:border-black print:bg-white print:shadow-none">
        <CardHeader className="border-b print:border-black print:px-4 print:py-3">
          <div className="hidden text-center text-sm font-semibold print:block">{t("report.brandName")}</div>
          <CardTitle>{t("report.adminAttachmentTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm print:space-y-4 print:px-4 print:py-3">
          <section className="rounded-md border bg-muted/20 p-3 print:rounded-none print:border-black print:bg-white">
            <h2 className="text-sm font-semibold">{t("report.fromAdmin")}</h2>
            <div className="mt-1 space-y-1 text-sm">
              {adminTimeRows.length ? (
                adminTimeRows.map((row) => (
                  <p key={row.id}>
                    {row.date} {t("report.fromAdminInline")} · {row.start} - {row.end}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground print:text-black">{t("report.noAdminTimeRows")}</p>
              )}
            </div>
          </section>

          <section className="space-y-1">
            <h2 className="font-semibold">{t("report.adminWorkerNotes")}</h2>
            <div className="min-h-24 rounded-md border p-2 text-xs text-muted-foreground print:rounded-none print:border-black print:text-black">
              {noteMessages.length ? (
                noteMessages.map((message) => (
                  <p key={message.id}>
                    <strong>{message.authorName}:</strong> {message.text}
                  </p>
                ))
              ) : (
                <p>{t("report.noNotes")}</p>
              )}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
