"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";

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

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-4xl rounded-lg border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{t("workzone.calendarPlanning", currentLang)}</h2>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setIsOpen(false)}>
                {t("common.close", currentLang)}
              </Button>
            </div>

            <div className="space-y-4 p-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("workzone.selectDay", currentLang)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.currentTarget.value);
                      setSelectedVersion("current");
                    }}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("workzone.planForDate", currentLang)} {selectedDate}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 overflow-x-auto">
                  {entries.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedVersion(entry.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
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
                  <table className="w-full min-w-[640px] border-collapse border text-sm">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="border px-2 py-1 text-left">{t("common.group", currentLang)}</th>
                        <th className="border px-2 py-1 text-left">{t("workzone.machines", currentLang)}</th>
                        <th className="border px-2 py-1 text-left">{t("workzone.newSite", currentLang)}</th>
                        <th className="border px-2 py-1 text-left">{t("common.note", currentLang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td className="border px-2 py-1">{row.workerNames || "-"}</td>
                          <td className="border px-2 py-1">{row.machineNames || "-"}</td>
                          <td className="border px-2 py-1">{row.baustelleName || "-"}</td>
                          <td className="border px-2 py-1">{row.note ?? "-"}</td>
                        </tr>
                      ))}
                      {rows.length === 0 ? (
                        <tr>
                          <td className="border px-2 py-2 text-muted-foreground" colSpan={4}>
                            {t("workzone.noSavedPlan", currentLang)}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
