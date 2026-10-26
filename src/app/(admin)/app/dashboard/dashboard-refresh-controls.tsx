"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { refreshDashboardSnapshotAction } from "./actions";

type DashboardRefreshControlsProps = {
  generatedAt: string;
};

function timestampLabel(value: string) {
  return new Date(value).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DashboardRefreshControls({ generatedAt }: DashboardRefreshControlsProps) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(() => timestampLabel(generatedAt));

  useEffect(() => {
    setLastUpdated(timestampLabel(generatedAt));
  }, [generatedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
      <span className="inline-flex rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm">
        {t("admin.statAsOf", currentLang)}: {lastUpdated}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        className="rounded-full border-border/70 bg-background/90 shadow-sm"
        onClick={() => {
          startTransition(async () => {
            await refreshDashboardSnapshotAction();
            router.refresh();
          });
        }}
      >
        <RefreshCw className={isPending ? "animate-spin" : ""} />
        {t("admin.refresh", currentLang)}
      </Button>
    </div>
  );
}
