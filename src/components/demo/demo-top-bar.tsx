import Link from "next/link";
import { Bot, Home, LayoutDashboard, Monitor, Settings2, MoreHorizontal, TreePine, Truck, Wrench } from "lucide-react";
import { cookies } from "next/headers";

import { AppBrand } from "@/components/branding/AppBrand";
import { WorkerIconStrip } from "@/app/(workzone)/workzone/worker-icon-strip";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { t } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { kidrahtDemoUrl } from "@/lib/kidraht-demo";
import { KidrahtButton } from "@/components/kidraht/kidraht-button";
import { DemoReadonlyBadge } from "./demo-readonly-badge";
import { DemoThemeButton } from "./demo-theme-button";
import { workshopCopy } from "@/lib/workshop/copy";
import { DemoActorBar } from "./workshop/demo-actor-bar";
import { DemoTeamStrip } from "./workshop/demo-team-strip";
import { navigationCopy } from "@/lib/workshop/navigation-copy";
import { DemoDashboardLaunch } from "./workshop/demo-dashboard-launch";
import { DemoBrand } from "./workshop/demo-brand";
import { woodCopy } from "@/lib/workshop/wood-copy";

/** Same compact round icon buttons as the production (AL-Steel) header; names stay in aria-label/title. */
const navIcon="inline-flex size-11 items-center justify-center rounded-full border bg-transparent text-foreground/80 transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const workzoneName="Workzone", dashboardName="Dashboard", aiLabel="AI", aiPreview="AI preview";

type DemoWorker = {
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

export async function DemoTopBar({ workers, mode, workshopEnabled = false }: { workers: DemoWorker[]; mode?: CompanyMode; workshopEnabled?: boolean }) {
  const currentLang = await resolveRequestLanguage();
  const kidraht = kidrahtDemoUrl(mode);

  if (mode === "baumdienst" && workshopEnabled) {
    const c = workshopCopy(currentLang); const dark = (await cookies()).get("bk_theme")?.value === "dark";
    const wood=woodCopy(currentLang), n=navigationCopy(currentLang);
    return <div className="w-full min-w-0 px-3 pb-2 pt-4 sm:px-5 lg:pr-20" data-testid="baum-demo-topbar">
      <div data-demo-teamrow className="relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2"><DemoBrand alt={t("common.companyLogoAlt",currentLang)}/><DemoTeamStrip workers={workers.map(worker=>({...worker,activeProfile:false,pendingVacationRequest:false,vacationDecisionSignal:false,vacationDecisionSignalKey:null}))} />
        {/* Only the round button sits over the strip; workers scroll underneath it. */}<div className="absolute right-0 top-1/2 z-20 -translate-y-1/2"><details className="relative"><summary aria-label={c.more} className="grid size-11 cursor-pointer list-none place-items-center rounded-full border bg-background/90 shadow-sm backdrop-blur focus-visible:ring-2 focus-visible:ring-ring"><MoreHorizontal className="size-5" /></summary><div className="absolute right-0 top-full z-50 mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-col items-end gap-2"><DemoActorBar mode="roles"/><div className="flex items-center justify-end gap-2">{kidraht?<KidrahtButton href="/demo/kidraht" title={t("demo.kidrahtTitle",currentLang)} className="h-11 min-w-11"/>:null}<DemoThemeButton dark={dark} label={t("admin.themeToggle",currentLang)}/><LanguageSwitcher/></div></div></details></div>
      </div>
      <nav data-demo-navigation aria-label="Demo" className="no-scrollbar mt-2 flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-1.5 pb-1 [&>*]:shrink-0">
        <Link href="/demo/workzone" aria-label={workzoneName} title={workzoneName} className={navIcon}><Home className="size-4" /></Link>
        <Link href="/demo/control" aria-label={n.panel} title={n.panel} className={navIcon}><Settings2 className="size-4" /></Link>
        <DemoDashboardLaunch href="/demo/tv?view=dashboard" label={n.tv} className={navIcon}><Monitor className="size-4" /></DemoDashboardLaunch>
        <Link href="/demo/wood" aria-label={wood.title} title={wood.title} className={navIcon}><TreePine className="size-4" /></Link>
        <Link href="/demo/workshop" aria-label={c.title} title={c.title} className={navIcon}><Wrench className="size-4" /></Link>
        <Link href="/demo/workshop?tab=fleet" aria-label={`${c.fleet} · Demo`} title={c.fleet} className={`${navIcon} lg:hidden`}><Truck className="size-4" /></Link>
        <DemoActorBar mode="notifications"/>
      </nav>
    </div>;
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-2 px-5 pb-1 pt-8">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AppBrand compact mode={mode} logoAlt={t("common.companyLogoAlt", currentLang)} />
            <span
              className="inline-flex h-8 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300"
              title={aiPreview}
              aria-label={aiPreview}
            >
              <Bot className="size-3.5" />
              {aiLabel}
            </span>
            {kidraht ? <KidrahtButton href="/demo/kidraht" title={t("demo.kidrahtTitle", currentLang)} /> : null}
            <div className="grid gap-1">
              <Link
                href="/demo/workzone"
                title={t("workzone.title", currentLang)}
                aria-label={t("workzone.title", currentLang)}
                className="inline-flex size-8 items-center justify-center rounded-full border bg-background/80 text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
              >
                <Home className="size-4" />
              </Link>
              <Link
                href="/demo/dashboard"
                title={dashboardName}
                aria-label={dashboardName}
                className="inline-flex size-8 items-center justify-center rounded-full border bg-background/80 text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard className="size-4" />
              </Link>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        <WorkerIconStrip
          admin
          profileHrefBase="/demo/workers"
          workers={workers.map((worker) => ({
            ...worker,
            activeProfile: false,
            pendingVacationRequest: false,
            vacationDecisionSignal: false,
            vacationDecisionSignalKey: null,
          }))}
        />
        <div className="hidden justify-end lg:flex">
          <DemoReadonlyBadge compact />
        </div>
      </div>
    </div>
  );
}
