"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CalendarDays, CalendarRange } from "lucide-react";

type ReportPeriodPickerProps = {
  mode: "worker" | "admin";
  reportType: "day" | "month";
  workerId?: string;
  initialValue: string;
  buttonLabel: string;
};

function buildHref(mode: "worker" | "admin", reportType: "day" | "month", value: string, workerId?: string) {
  if (mode === "admin") {
    if (!workerId) return null;
    return reportType === "day"
      ? `/app/admin/workers/${workerId}/day/${value}`
      : `/app/admin/workers/${workerId}/month/${value}`;
  }

  return reportType === "day" ? `/workzone/profile/day/${value}` : `/workzone/profile/month/${value}`;
}

export function ReportPeriodPicker({
  mode,
  reportType,
  workerId,
  initialValue,
  buttonLabel,
}: ReportPeriodPickerProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  function go(next: string) {
    const href = buildHref(mode, reportType, next, workerId);
    if (!href || !next) return;
    router.push(href);
  }

  // Picking a date opens the report at once: no extra button.
  return (
    <label className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border bg-card pl-3 pr-1 text-xs font-medium text-muted-foreground transition focus-within:border-primary hover:border-primary/40">
      {reportType === "day" ? <CalendarDays className="size-4 text-primary" /> : <CalendarRange className="size-4 text-primary" />}
      <span className="sr-only">{buttonLabel}</span>
      <input
        type={reportType === "day" ? "date" : "month"}
        value={value}
        aria-label={buttonLabel}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setValue(next);
          go(next);
        }}
        className="h-8 min-w-0 flex-1 rounded-full bg-transparent pr-2 text-sm text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
      />
    </label>
  );
}
