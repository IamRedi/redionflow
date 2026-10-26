"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  function go() {
    const href = buildHref(mode, reportType, value, workerId);
    if (!href || !value) return;
    router.push(href);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type={reportType === "day" ? "date" : "month"}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        className="h-9 w-auto min-w-36"
      />
      <Button type="button" variant="outline" size="sm" onClick={go} disabled={!value}>
        {buttonLabel}
      </Button>
    </div>
  );
}
