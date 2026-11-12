"use client";

import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { planCopy } from "./plan/plan-copy";
import { SavedPlanList } from "./plan/saved-plan";

type PlanRow = {
  id: string;
  workerNames: string;
  machineNames: string;
  baustelleName: string;
  note: string | null;
};

type PlanByDate = {
  date: string;
  currentRows: PlanRow[];
  snapshots: Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
    rows: PlanRow[];
  }>;
};

export function WorkzoneCalendarModal({
  plans,
  initialDate,
  triggerClassName,
  iconOnly = false,
}: {
  plans: PlanByDate[];
  initialDate: string;
  triggerClassName?: string;
  iconOnly?: boolean;
}) {
  const { currentLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedVersion, setSelectedVersion] = useState<string>("current");

  const selectedPlan = useMemo(() => plans.find((item) => item.date === selectedDate) ?? null, [plans, selectedDate]);
  const entries = useMemo(() => {
    if (!selectedPlan) return [];
    return [
      { id: "current", label: t("workzone.currentPlanLabel", currentLang), rows: selectedPlan.currentRows },
      ...selectedPlan.snapshots.map((snapshot) => ({
        id: snapshot.id,
        label: t("workzone.versionLabel", currentLang).replace("{version}", String(snapshot.versionNumber)),
        rows: snapshot.rows,
      })),
    ];
  }, [currentLang, selectedPlan]);
  const selectedEntry = entries.find((entry) => entry.id === selectedVersion) ?? entries[0] ?? null;
  const rows = selectedEntry?.rows ?? [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon" : "sm"}
        className={triggerClassName ?? "h-7 px-2 text-[11px]"}
        onClick={() => setIsOpen(true)}
        title={t("workzone.calendar", currentLang)}
        aria-label={t("workzone.calendar", currentLang)}
      >
        {iconOnly ? <CalendarDays className="size-3.5" /> : t("workzone.calendar", currentLang)}
      </Button>

      {/* Portal: the toolbar has a backdrop filter, which would trap a fixed overlay inside it. */}
      {isOpen ? createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 sm:p-4">
          {/* Phone: the whole screen, scrolling only up and down; desktop: a dialog. */}
          <div data-studio-planning data-planning-calendar role="dialog" aria-modal="true" aria-label={t("workzone.calendarPlanning", currentLang)} className="h-full w-full overflow-y-auto overscroll-contain bg-background shadow-2xl [scrollbar-width:none] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl sm:border [&::-webkit-scrollbar]:hidden">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
              <h2 className="text-sm font-semibold">{t("workzone.calendarPlanning", currentLang)}</h2>
              <Button type="button" variant="ghost" size="sm" className="min-h-11 px-3 text-xs" onClick={() => setIsOpen(false)}>
                {t("common.close", currentLang)}
              </Button>
            </header>

            <div className="space-y-4 p-3 sm:p-4">
              <label className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
                  <span className="text-sm font-semibold">{t("workzone.selectDay", currentLang)}</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.currentTarget.value);
                      setSelectedVersion("current");
                    }}
                    className="h-11 min-w-0 max-w-[60%] rounded-md border bg-background px-3 text-sm dark:[color-scheme:dark]"
                  />
              </label>

              <section className="space-y-3">
                  {entries.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          aria-pressed={selectedEntry?.id === entry.id}
                          onClick={() => setSelectedVersion(entry.id)}
                          className={`min-h-11 rounded-full border px-3 py-1 text-xs font-medium transition ${
                            selectedEntry?.id === entry.id
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-background text-foreground/80 hover:bg-muted"
                          }`}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <SavedPlanList rows={rows} c={planCopy(currentLang)} />
              </section>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
