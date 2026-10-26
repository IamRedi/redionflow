"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { countVacationWorkdays, parseVacationDate } from "@/lib/workzone/vacation";

export function VacationRequestForm({
  workerId,
  currentLang,
  action,
}: {
  workerId: string;
  currentLang: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestedDays, setRequestedDays] = useState("");

  function syncRequestedDays(nextStartDate: string, nextEndDate: string) {
    const start = parseVacationDate(nextStartDate);
    const end = parseVacationDate(nextEndDate);
    if (!start || !end) {
      setRequestedDays("");
      return;
    }
    const nextSuggestedDays = countVacationWorkdays(start, end);
    setRequestedDays(nextSuggestedDays > 0 ? String(nextSuggestedDays) : "");
  }

  const suggestedDays = useMemo(() => {
    const start = parseVacationDate(startDate);
    const end = parseVacationDate(endDate);
    if (!start || !end) return 0;
    return countVacationWorkdays(start, end);
  }, [endDate, startDate]);

  return (
    <form action={action} className="grid gap-2 rounded-md border bg-background p-3 md:min-w-[28rem]">
      <input type="hidden" name="workerId" value={workerId} />
      <div className="grid gap-2 md:grid-cols-3">
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t("workzone.fromLabel", currentLang)}</span>
          <input
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => {
              const nextStartDate = event.currentTarget.value;
              setStartDate(nextStartDate);
              syncRequestedDays(nextStartDate, endDate);
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t("workzone.toLabel", currentLang)}</span>
          <input
            name="endDate"
            type="date"
            required
            value={endDate}
            onChange={(event) => {
              const nextEndDate = event.currentTarget.value;
              setEndDate(nextEndDate);
              syncRequestedDays(startDate, nextEndDate);
            }}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t("admin.vacationDays", currentLang)}</span>
          <input
            name="requestedDays"
            type="number"
            min="1"
            required
            value={requestedDays}
            onChange={(event) => setRequestedDays(event.currentTarget.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
        </label>
      </div>
      <div className="text-xs text-muted-foreground">
        {suggestedDays > 0
          ? t("workzone.vacationSuggestedDays", currentLang).replace("{days}", String(suggestedDays))
          : t("workzone.vacationNoWorkdaysInRange", currentLang)}
      </div>
      <textarea name="workerNote" rows={2} className="rounded-md border bg-background px-3 py-2 text-sm" placeholder={t("workzone.optionalNote", currentLang)} />
      <div className="flex justify-end">
        <Button type="submit" variant="outline" size="sm">
          {t("workzone.requestVacation", currentLang)}
        </Button>
      </div>
    </form>
  );
}
