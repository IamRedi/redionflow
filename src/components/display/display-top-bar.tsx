"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, MonitorPlay, Trees } from "lucide-react";

import { AppBrand } from "@/components/branding/AppBrand";
import { DisplayRefreshControls } from "@/components/display/display-refresh-controls";
import { useLanguage } from "@/components/i18n/language-provider";
import { WorkerIconStrip } from "@/app/(workzone)/workzone/worker-icon-strip";
import { Button } from "@/components/ui/button";
import { logoutDisplayAction } from "@/app/display-login/actions";
import { t } from "@/lib/i18n";

type DisplayWorker = {
  id: string;
  firstName: string;
  lastName: string;
  availability: string;
  birthDate: string | null;
  profileImageUrl: string | null;
  phone: string | null;
  emailAccount: string | null;
  live: boolean;
};

export function DisplayTopBar({
  initialTimestamp,
  workers,
}: {
  initialTimestamp: string;
  workers: DisplayWorker[];
}) {
  const { currentLang } = useLanguage();

  return (
    <div className="mx-auto grid min-w-[430px] max-w-7xl gap-3 px-5 pb-2 pt-8 sm:min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AppBrand compact logoAlt={t("common.companyLogoAlt", currentLang)} />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">{t("admin.displayView", currentLang)}</div>
            <div className="text-sm text-white/68">{t("admin.displayViewDescription", currentLang)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full border-border/70 bg-background/90 shadow-sm">
            <Link href="/display/workzone">
              <Trees className="size-4" />
              {t("admin.workzoneLive", currentLang)}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full border-border/70 bg-background/90 shadow-sm">
            <Link href="/display/dashboard">
              <LayoutDashboard className="size-4" />
              {t("admin.dashboard", currentLang)}
            </Link>
          </Button>
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <MonitorPlay className="mr-1 size-3.5" />
            {t("admin.readOnly", currentLang)}
          </span>
          <DisplayRefreshControls initialTimestamp={initialTimestamp} />
          <form action={logoutDisplayAction}>
            <Button type="submit" variant="outline" size="sm" className="rounded-full border-border/70 bg-background/90 shadow-sm">
              <LogOut className="size-4" />
              {t("admin.logout", currentLang)}
            </Button>
          </form>
        </div>
      </div>

      <WorkerIconStrip
        admin={false}
        workers={workers.map((worker) => ({
          ...worker,
          activeProfile: false,
          pendingVacationRequest: false,
          vacationDecisionSignal: false,
          vacationDecisionSignalKey: null,
        }))}
      />
    </div>
  );
}
