import Link from "next/link";
import { Bot, BookOpenCheck, Home, LayoutDashboard, Monitor, Package, Settings2, UserRound, TreePine, Truck, Wrench } from "lucide-react";

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
import { DemoNavigationLink } from "./workshop/demo-navigation-link";
import { woodCopy } from "@/lib/workshop/wood-copy";
import { DemoOfficeEntry } from "./offices/office-entry";

/** Compact round navigation reuses the one scoped forest crystal material. */
const navIcon="baum-nav-icon inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground/80 transition focus-visible:ring-2 focus-visible:ring-ring";
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
    const c = workshopCopy(currentLang);
    const wood=woodCopy(currentLang), n=navigationCopy(currentLang);
    return <div className="w-full min-w-0 px-3 pb-2 pt-4 sm:px-5" data-testid="baum-demo-topbar">
      <div data-demo-teamrow className="relative flex min-w-0 items-center gap-2"><DemoBrand alt={t("common.companyLogoAlt",currentLang)}/><div className="min-w-0 flex-1"><DemoTeamStrip workers={workers.map(worker=>({...worker,activeProfile:false,pendingVacationRequest:false,vacationDecisionSignal:false,vacationDecisionSignalKey:null}))} /></div><DemoActorBar mode="notifications"/><details data-demo-profile className="relative shrink-0"><summary aria-label={c.profile} title={c.profile} className={`${navIcon} cursor-pointer list-none`}><UserRound className="size-4" /></summary><div className="absolute right-0 top-full z-50 mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-col items-end gap-2"><DemoActorBar mode="roles"/><LanguageSwitcher/></div></details></div>
      <div data-demo-actionrow className="mt-2 flex min-w-0 items-start gap-2">
        <nav data-demo-navigation aria-label="Demo" className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1 sm:gap-1.5 [&>*]:shrink-0">
          <DemoNavigationLink href="/demo/workzone" label={workzoneName} className={navIcon}><Home className="size-4" /></DemoNavigationLink>
          <DemoNavigationLink href="/demo/control" label={n.panel} className={navIcon}><Settings2 className="size-4" /></DemoNavigationLink>
          <DemoOfficeEntry className={navIcon}/>
          <DemoDashboardLaunch href="/demo/tv?view=dashboard" label={n.tv} className={navIcon}><Monitor className="size-4" /></DemoDashboardLaunch>
          <DemoNavigationLink href="/demo/wood" label={wood.title} className={navIcon}><TreePine className="size-4" /></DemoNavigationLink>
          <DemoNavigationLink preserveWorkshopScope href="/demo/workshop" label={c.title} className={navIcon}><Wrench className="size-4" /></DemoNavigationLink>
          <DemoNavigationLink preserveWorkshopScope href="/demo/workshop?tab=tools" label={c.tools} className={navIcon}><Package className="size-4" /></DemoNavigationLink>
          <DemoNavigationLink preserveWorkshopScope href="/demo/workshop?tab=fleet" label={c.fleet} className={navIcon}><Truck className="size-4" /></DemoNavigationLink>
        </nav>
        <div data-demo-utilities className="flex shrink-0 items-center gap-1">{kidraht?<Link href="/demo/kidraht" aria-label={t("demo.kidrahtTitle",currentLang)} title={t("demo.kidrahtTitle",currentLang)} className={navIcon}><BookOpenCheck className="size-4"/></Link>:null}<DemoThemeButton label={t("admin.themeToggle",currentLang)} errorLabel={c.error}/></div>
      </div>
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
