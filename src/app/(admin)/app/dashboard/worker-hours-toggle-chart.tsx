"use client";

import { useMemo, useState } from "react";

import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { reportLocale } from "@/lib/workzone/date-utils";

type WorkerHoursRow = {
  id: string;
  label: string;
  total: number;
};

type WorkerHoursToggleChartProps = {
  weekly: WorkerHoursRow[];
  monthly: WorkerHoursRow[];
  currentLang?: Language;
  companyMode?: CompanyMode;
  embedded?: boolean;
};

function formatHours(value: number, lang?: string) {
  return value.toLocaleString(reportLocale(lang), {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function barColor(value: number, max: number) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const hue = 28 + (120 * ratio);
  const saturation = 78 - ratio * 18;
  const lightness = 56 - ratio * 16;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function HoverName({ text }: { text: string }) {
  return (
    <div className="group/hover relative w-full">
      <div className="truncate text-center">{text}</div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[220px] -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-md group-hover/hover:block">
        {text}
      </div>
    </div>
  );
}

export function WorkerHoursToggleChart({
  weekly,
  monthly,
  currentLang = "de",
  companyMode = "baumdienst",
  embedded = false,
}: WorkerHoursToggleChartProps) {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const rows = period === "weekly" ? weekly : monthly;
  const max = Math.max(...rows.map((row) => row.total), 0);

  const summary = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return t("admin.workerHoursSummary", currentLang, companyMode)
      .replace("{count}", rows.length.toLocaleString(reportLocale(currentLang)))
      .replace("{hours}", formatHours(total, currentLang));
  }, [companyMode, currentLang, rows]);

  if (rows.length === 0) {
    return (
      <div className={`rounded-2xl border border-border/70 bg-background/70 p-4 ${embedded ? "h-full" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            {!embedded ? <div className="text-sm font-semibold text-foreground">{t("admin.topWorkersByHours", currentLang, companyMode)}</div> : null}
            <div className="text-[11px] text-muted-foreground">{t("admin.workerHoursEmpty", currentLang, companyMode)}</div>
          </div>
          <div className="inline-flex rounded-lg border bg-background p-1 text-[11px]">
            <button type="button" className="rounded-md px-2 py-1 font-medium">
              {t("admin.woche", currentLang, companyMode)}
            </button>
            <button type="button" className="rounded-md px-2 py-1 font-medium">
              {t("admin.monat", currentLang, companyMode)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border/70 bg-background/70 p-4 ${embedded ? "flex h-full min-h-0 flex-col" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          {!embedded ? <div className="text-sm font-semibold text-foreground">{t("admin.topWorkersByHours", currentLang, companyMode)}</div> : null}
          <div className="text-[11px] text-muted-foreground">{summary}</div>
        </div>
        <div className="inline-flex rounded-full border border-border/70 bg-background/90 p-1 text-[11px] shadow-sm">
          <button
            type="button"
            onClick={() => setPeriod("weekly")}
            className={`rounded-md px-2 py-1 font-medium transition ${period === "weekly" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-muted-foreground"}`}
          >
            {t("admin.woche", currentLang, companyMode)}
          </button>
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`rounded-md px-2 py-1 font-medium transition ${period === "monthly" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-muted-foreground"}`}
          >
            {t("admin.monat", currentLang, companyMode)}
          </button>
        </div>
      </div>

      <div
        className={`mt-4 max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${embedded ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
      >
        <div className={`flex min-w-max items-end gap-1.5 rounded-2xl border border-border/60 bg-muted/10 px-3 py-4 ${embedded ? "min-h-full" : ""}`}>
        {rows.map((row) => {
          const height = max > 0 ? Math.max(18, Math.round((row.total / max) * 100)) : 18;
          const color = barColor(row.total, max);
          return (
            <div key={row.id} className="flex w-11 shrink-0 flex-col items-center gap-1.5">
              <div className="text-[9px] font-semibold tabular-nums text-muted-foreground">
                {`${formatHours(row.total, currentLang)} ${t("common.hourShort", currentLang, companyMode)}`}
              </div>
              <div className="flex h-32 w-full items-end justify-center rounded-xl bg-muted/30 px-1 pb-1">
                <div
                  className="w-full rounded-t-md"
                  style={{ height: `${height}%`, backgroundColor: color }}
                  aria-hidden="true"
                />
              </div>
              <div className="max-w-full text-[9px] font-medium text-foreground">
                <HoverName text={row.label} />
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
