import Link from "next/link";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, HardHat, MapPinned, Wrench } from "lucide-react";

import { WorkerHoursToggleChart } from "@/app/(admin)/app/dashboard/worker-hours-toggle-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoReadonlyBadge } from "@/components/demo/demo-readonly-badge";
import { getCompanyMode, getOrCreateDefaultCompany } from "@/lib/db/company";
import { getDashboardSnapshotForWeek } from "@/lib/dashboard/dashboard-snapshot";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import type { CompanyMode } from "@/lib/mode-config";

function formatHours(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function formatCount(value: number) {
  return value.toLocaleString("de-DE");
}

function HoverName({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`group/hover relative ${className ?? ""}`}>
      <div className="truncate">{text}</div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[240px] -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-md group-hover/hover:block">
        {text}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof HardHat;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card shadow-sm shadow-emerald-950/5">
      <CardHeader className="relative p-2.5 pb-2 sm:p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardDescription className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</CardDescription>
            <CardTitle className="mt-1.5 text-xl leading-none tabular-nums sm:text-2xl">{formatCount(value)}</CardTitle>
          </div>
          <span
            title={description}
            className="inline-flex rounded-2xl border border-emerald-500/15 bg-background/90 p-1.5 text-emerald-700 shadow-sm dark:text-emerald-300"
          >
            <Icon className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-0 sm:p-3 sm:pt-0">
        <div
          title={description}
          className="inline-flex max-w-full rounded-full border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          <span className="truncate">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactMetric({
  label,
  value,
  hint,
  accent = false,
  compact = false,
  center = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  compact?: boolean;
  center?: boolean;
}) {
  return (
    <div
      title={hint}
      className={`rounded-2xl border shadow-sm ${
        accent ? "border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.10] via-background to-background" : "border-border/70 bg-background/80"
      } ${compact ? "px-2.5 py-2.5" : "px-3 py-3"}`}
    >
      <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${center ? "text-center" : ""}`}>{label}</div>
      <div
        className={`mt-1.5 font-semibold tabular-nums text-foreground ${compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"} ${center ? "text-center" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function WeeklyHoursTable({
  columns,
  rows,
  currentLang,
  mode,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{
    id: string;
    label: string;
    total: number;
    days: Array<{
      key: string;
      value: number;
      workers: Array<{ id: string; label: string; hours: number }>;
    }>;
  }>;
  currentLang: Language;
  mode: CompanyMode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("admin.weeklyHoursEmpty", currentLang, mode)}</p>;
  }

  return (
    <div className="max-w-full overflow-visible rounded-2xl border border-border/70 bg-background/70 shadow-sm">
      <div className="max-w-full overflow-x-auto overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="min-w-full border-separate border-spacing-0 text-[10px] leading-4">
          <thead>
            <tr className="bg-muted/35">
              <th className="sticky left-0 z-[1] border-b bg-muted/60 px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("admin.weeklyHoursSite", currentLang, mode)}
              </th>
              {columns.map((column) => (
                <th key={column.key} className="min-w-[62px] border-b px-1.5 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="inline-flex rounded-md bg-background px-1.5 py-0.5">{column.label}</span>
                </th>
              ))}
              <th className="min-w-[76px] border-b px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("common.total", currentLang, mode)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className={rowIndex % 2 === 0 ? "bg-background/90" : "bg-muted/10"}>
                <td className="sticky left-0 border-b bg-inherit px-3 py-2.5 align-top">
                  <HoverName text={row.label} className="max-w-[200px] text-[11px] font-semibold text-foreground" />
                </td>
                {row.days.map((day, dayIndex) => (
                  <td key={day.key} className={`border-b px-1.5 py-2 text-center tabular-nums ${dayIndex >= 5 ? "bg-amber-500/5" : ""}`}>
                    <div className="group/cell relative inline-flex">
                      <span
                        className={`inline-flex min-w-[42px] justify-center rounded-md px-1.5 py-0.5 font-medium ${
                          day.value > 0 ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-muted-foreground"
                        }`}
                      >
                        {day.value > 0 ? `${formatHours(day.value)}${t("common.hourShort", currentLang, mode)}` : "-"}
                      </span>
                      {day.value > 0 && day.workers.length > 0 ? (
                        <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-lg border bg-background px-2.5 py-2.5 text-left text-[10px] shadow-lg group-hover/cell:block">
                          <div>
                            {day.workers.map((worker) => (
                              <div key={worker.id} className="flex items-center justify-between gap-2 text-foreground">
                                <span className="truncate">{worker.label}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{`${formatHours(worker.hours)}${t("common.hourShort", currentLang, mode)}`}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                ))}
                <td className="border-b px-3 py-2 text-right">
                  <span className="inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {`${formatHours(row.total)} ${t("common.hourShort", currentLang, mode)}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgressBarChart({
  rows,
  currentLang,
  mode,
}: {
  rows: Array<{ id: string; label: string; value: number; hint: string; detail?: string }>;
  currentLang: Language;
  mode: CompanyMode;
}) {
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("admin.keineAktivenBaustellen", currentLang, mode)}</p>;
  return (
    <div className="flex h-[260px] min-w-0 flex-col rounded-[28px] border border-border/70 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground">{t("admin.siteProgress", currentLang, mode)}</div>
        <div className="text-[11px] text-muted-foreground">{t("admin.siteProgressSub", currentLang, mode)}</div>
      </div>
      <div className="flex-1 max-w-full overflow-x-auto rounded-2xl border border-border/60 bg-background/75 px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max h-full items-end gap-2.5">
          {rows.map((row) => {
            const height = max > 0 ? Math.max(16, Math.round((row.value / max) * 100)) : 16;
            const hue = 28 + row.value;
            return (
              <div key={row.id} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                <div className="text-[9px] font-semibold tabular-nums text-muted-foreground">{row.value}%</div>
                <div className="flex h-24 w-full items-end justify-center rounded-xl bg-muted/25 px-1 pb-1">
                  <div className="w-full rounded-t-md" style={{ height: `${height}%`, backgroundColor: `hsl(${hue} 62% 43%)` }} aria-hidden="true" />
                </div>
                <HoverName text={row.label} className="w-full px-1 text-center text-[10px] font-medium text-foreground" />
                <div className="text-[9px] font-medium tabular-nums text-muted-foreground">{row.detail ?? "-"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthlyHoursTrend({
  points,
  currentLang,
  mode,
}: {
  points: Array<{ key: string; label: string; fullLabel: string; value: number }>;
  currentLang: Language;
  mode: CompanyMode;
}) {
  if (points.length === 0) return <p className="text-sm text-muted-foreground">{t("admin.monthlyTrendEmpty", currentLang, mode)}</p>;
  const max = Math.max(...points.map((point) => point.value), 0);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const activeDays = points.filter((point) => point.value > 0).length;
  const average = activeDays > 0 ? total / activeDays : 0;
  return (
    <div className="flex h-[260px] min-w-0 flex-col rounded-[28px] border border-border/70 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{t("admin.monatstrendStunden", currentLang, mode)}</div>
          <div className="text-[11px] text-muted-foreground">{t("admin.monatstrendStundenSub", currentLang, mode)}</div>
        </div>
        <div title={t("admin.averageWorkdayHint", currentLang, mode)} className="text-right">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("admin.durchschnitt", currentLang, mode)}</div>
          <div className="text-sm font-semibold tabular-nums text-foreground">{`${formatHours(average)} ${t("common.hourShort", currentLang, mode)}`}</div>
        </div>
      </div>
      <div className="flex-1 max-w-full overflow-x-auto overflow-y-visible overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max h-full items-end gap-1.5 overflow-visible rounded-2xl border border-border/60 bg-background/75 px-3 py-3">
          {points.map((point, index) => {
            const height = max > 0 ? Math.max(10, Math.round((point.value / max) * 100)) : 10;
            const intensity = max > 0 ? point.value / max : 0;
            const gradient = `linear-gradient(180deg, hsl(${165 - intensity * 24} 72% ${72 - intensity * 10}%) 0%, hsl(${198 - intensity * 16} 74% ${45 - intensity * 10}%) 100%)`;
            return (
              <div key={point.key} className="group/trend relative flex w-3 shrink-0 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end rounded-md bg-muted/35">
                  <div className="w-full rounded-md" style={{ height: `${height}%`, background: gradient, opacity: point.value > 0 ? 1 : 0.28 }} aria-hidden="true" />
                </div>
                <div className={`text-[8px] ${index % 2 === 0 ? "text-muted-foreground" : "text-muted-foreground/70"}`}>{point.label}</div>
                <div className="pointer-events-none absolute bottom-[calc(100%-0.25rem)] left-1/2 z-30 hidden -translate-x-1/2 rounded-lg border bg-background px-2 py-1 text-[10px] font-medium whitespace-nowrap text-foreground shadow-lg group-hover/trend:block">
                  {[point.fullLabel, `${formatHours(point.value)} ${t("common.hourShort", currentLang, mode)}`].join(" · ")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function DemoDashboardPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const params = await searchParams;
  const rawWeek = Number(params.week ?? "0");
  const weekOffset = Number.isFinite(rawWeek) ? Math.min(0, Math.trunc(rawWeek)) : 0;
  const [company, mode, currentLang] = await Promise.all([
    getOrCreateDefaultCompany(),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);
  const snapshot = await getDashboardSnapshotForWeek(company.id, weekOffset, currentLang);

  const statCards = [
    { key: "active-workers", title: t("admin.aktiveMitarbeiter", currentLang, mode), value: snapshot.stats.activeWorkers, description: t("admin.aktiveMitarbeiterSub", currentLang, mode), icon: HardHat },
    { key: "unavailable-workers", title: t("admin.nichtVerfuegbar", currentLang, mode), value: snapshot.stats.unavailableWorkers, description: t("admin.nichtVerfuegbarSub", currentLang, mode), icon: BriefcaseBusiness },
    { key: "active-baustellen", title: t("admin.aktiveBaustellen", currentLang, mode), value: snapshot.stats.activeBaustellen, description: t("admin.aktiveBaustellenSub", currentLang, mode), icon: MapPinned },
    { key: "completed-baustellen", title: t("admin.heuteAbgeschlossen", currentLang, mode), value: snapshot.stats.completedBaustellenToday, description: t("admin.heuteAbgeschlossenSub", currentLang, mode), icon: Wrench },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <div className="overflow-hidden rounded-[28px] border border-border/80 bg-background/85 shadow-lg shadow-emerald-950/5 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/[0.08] via-background to-background px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">{t("admin.publicDemo", currentLang, mode)}</div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t("admin.dashboardHeading", currentLang, mode)}</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t("admin.dashboardSubtitle", currentLang, mode)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DemoReadonlyBadge />
            <span className="inline-flex rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm">
              {t("admin.statAsOf", currentLang, mode)}: {new Date(snapshot.generatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card shadow-sm shadow-emerald-950/5">
          <CardHeader className="p-3.5 pb-2.5 sm:p-4 sm:pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t("admin.betriebHeute", currentLang, mode)}</CardTitle>
                <CardDescription className="mt-1 text-[11px]">{t("admin.betriebHeuteSub", currentLang, mode)}</CardDescription>
              </div>
              <span className="rounded-full border border-emerald-500/15 bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{t("admin.focus", currentLang, mode)}</span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5 p-3.5 pt-0 sm:gap-3 sm:p-4 sm:pt-0">
            {statCards.map((card) => (
              <KpiCard key={card.key} title={card.title} value={card.value} description={card.description} icon={card.icon} />
            ))}
            <div className="col-span-2">
              <CompactMetric label={t("admin.mitarbeiterHeute", currentLang, mode)} value={formatCount(snapshot.stats.workersWorkedToday)} hint={t("admin.mitarbeiterHeuteSub", currentLang, mode)} accent compact />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-emerald-500/[0.08] via-card to-card shadow-sm shadow-emerald-950/5">
          <CardHeader className="p-3.5 pb-2.5 sm:p-4 sm:pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t("admin.heuteImFokus", currentLang, mode)}</CardTitle>
                <CardDescription className="mt-1 text-[11px]">{t("admin.heuteImFokusSub", currentLang, mode)}</CardDescription>
              </div>
              <span className="rounded-full border border-emerald-500/15 bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{t("admin.live", currentLang, mode)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3.5 pt-0 sm:space-y-3 sm:p-4 sm:pt-0">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <CompactMetric label={t("admin.netto", currentLang, mode)} value={`${formatHours(snapshot.stats.totalWorkHoursToday)} ${t("common.hourShort", currentLang, mode)}`} hint={t("admin.workHoursTodayHint", currentLang, mode)} accent compact center />
              <CompactMetric label={t("admin.pause", currentLang, mode)} value={`${formatHours(snapshot.stats.totalPauseHoursToday)} ${t("common.hourShort", currentLang, mode)}`} hint={t("admin.breaksRecordedHint", currentLang, mode)} compact center />
              <CompactMetric label={t("admin.brutto", currentLang, mode)} value={`${formatHours(snapshot.stats.totalGrossHoursToday)} ${t("common.hourShort", currentLang, mode)}`} hint={t("admin.grossHoursHint", currentLang, mode)} compact center />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <CompactMetric label={t("admin.woche", currentLang, mode)} value={`${formatHours(snapshot.stats.totalWorkHoursWeek)} ${t("common.hourShort", currentLang, mode)}`} hint={t("admin.currentWeekHint", currentLang, mode)} compact center />
              <CompactMetric label={t("admin.monat", currentLang, mode)} value={`${formatHours(snapshot.stats.totalWorkHoursMonth)} ${t("common.hourShort", currentLang, mode)}`} hint={t("admin.currentMonthHint", currentLang, mode)} compact center />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="min-w-0"><MonthlyHoursTrend points={snapshot.charts.monthHoursTrend} currentLang={currentLang} mode={mode} /></div>
        <div className="min-w-0"><ProgressBarChart rows={snapshot.charts.baustellenProgress} currentLang={currentLang} mode={mode} /></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm shadow-black/5">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">{t("admin.weeklyHoursBySite", currentLang, mode)}</CardTitle>
                <CardDescription className="mt-1 text-[11px]">{t("admin.weeklyHoursBySiteSub", currentLang, mode).replace("{week}", snapshot.selectedWeek.label)}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!snapshot.selectedWeek.isCurrent ? (
                  <Link
                    href={snapshot.selectedWeek.offset === -1 ? "/demo/dashboard" : `/demo/dashboard?week=${snapshot.selectedWeek.offset + 1}`}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition hover:text-foreground"
                    title={t("admin.newerWeek", currentLang, mode)}
                    aria-label={t("admin.newerWeek", currentLang, mode)}
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                ) : null}
                <Link
                  href={`/demo/dashboard?week=${snapshot.selectedWeek.offset - 1}`}
                  className="inline-flex size-8 items-center justify-center rounded-full border border-border/70 bg-background/90 text-muted-foreground transition hover:text-foreground"
                  title={t("admin.previousWeek", currentLang, mode)}
                  aria-label={t("admin.previousWeek", currentLang, mode)}
                >
                  <ChevronLeft className="size-4" />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="h-[340px] min-h-0 overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <WeeklyHoursTable rows={snapshot.charts.weekHoursByBaustelle} columns={snapshot.charts.weekHoursColumns} currentLang={currentLang} mode={mode} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm shadow-black/5">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{t("admin.topWorkersByHours", currentLang, mode)}</CardTitle>
              <CardDescription className="mt-1 text-[11px]">{t("admin.topWorkersByHoursSub", currentLang, mode)}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="h-[340px] min-h-0 overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <WorkerHoursToggleChart weekly={snapshot.charts.workerHours.weekly} monthly={snapshot.charts.workerHours.monthly} currentLang={currentLang} companyMode={mode} embedded />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-border/80 bg-card/85 shadow-sm shadow-black/5">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{t("admin.safetyStock", currentLang, mode)}</CardTitle>
              <CardDescription className="mt-1 text-[11px]">{t("admin.safetyStockSub", currentLang, mode)}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <CompactMetric label={t("common.total", currentLang, mode)} value={formatCount(snapshot.stats.safetyInventory.totalAvailable)} hint={t("admin.allAvailableHint", currentLang, mode)} accent />
              <CompactMetric label={t("admin.signs", currentLang, mode)} value={formatCount(snapshot.stats.safetyInventory.signAvailable)} hint={t("admin.categorySignHint", currentLang, mode)} />
              <CompactMetric label={t("admin.plates", currentLang, mode)} value={formatCount(snapshot.stats.safetyInventory.plateAvailable)} hint={t("admin.categoryPlateHint", currentLang, mode)} />
              <CompactMetric label={t("admin.fences", currentLang, mode)} value={formatCount(snapshot.stats.safetyInventory.fenceAvailable)} hint={t("admin.categoryFenceHint", currentLang, mode)} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 bg-card/85 shadow-sm shadow-black/5">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{t("admin.machinesAndStatus", currentLang, mode)}</CardTitle>
              <CardDescription className="mt-1 text-[11px]">{t("admin.machinesAndStatusSub", currentLang, mode)}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <CompactMetric
                label={t("admin.machinesActive", currentLang, mode)}
                value={formatCount(snapshot.stats.machineStatus.active)}
                hint={t("admin.machineStatusHint", currentLang, mode)
                  .replace("{active}", formatCount(snapshot.stats.machineStatus.active))
                  .replace("{inactive}", formatCount(snapshot.stats.machineStatus.inactive))}
                accent
              />
              <CompactMetric label={t("admin.dataStatus", currentLang, mode)} value={snapshot.todayKey} hint={t("admin.dashboardCacheHint", currentLang, mode)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
