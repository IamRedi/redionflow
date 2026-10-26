"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { refreshDisplayViewsAction } from "@/app/display/actions";
import { t } from "@/lib/i18n";

function timestampLabel(value: string) {
  return new Date(value).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DisplayRefreshControls({ initialTimestamp }: { initialTimestamp: string }) {
  const { currentLang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(() => timestampLabel(initialTimestamp));

  useEffect(() => {
    setLastUpdated(timestampLabel(initialTimestamp));
  }, [initialTimestamp]);

  useEffect(() => {
    let cancelled = false;

    const refreshNow = () => {
      startTransition(async () => {
        if (pathname.startsWith("/display/dashboard")) {
          await refreshDisplayViewsAction();
        }
        if (cancelled) return;
        setLastUpdated(timestampLabel(new Date().toISOString()));
        router.refresh();
      });
    };

    const timer = window.setInterval(refreshNow, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            if (pathname.startsWith("/display/dashboard")) {
              await refreshDisplayViewsAction();
            }
            setLastUpdated(timestampLabel(new Date().toISOString()));
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
