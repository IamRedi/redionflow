import Link from "next/link";
import { Bot, Home, LayoutDashboard, MoreHorizontal, Package, TreePine, Truck, Wrench } from "lucide-react";
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
import { woodCopy } from "@/lib/workshop/wood-copy";

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
    const wood=woodCopy(currentLang);
    return <div className="w-full min-w-0 px-4 pb-2 pt-4 sm:px-5 lg:pr-20" data-testid="baum-demo-topbar">
      <div data-demo-teamrow className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"><Link href="/demo/workzone" aria-label="BaumdienstFlow · Workzone" className="shrink-0 rounded-full [&_img]:!size-14 [&_span]:!size-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><AppBrand compact mode={mode} logoAlt={t("common.companyLogoAlt", currentLang)} /></Link><DemoTeamStrip workers={workers.map(worker=>({...worker,activeProfile:false,pendingVacationRequest:false,vacationDecisionSignal:false,vacationDecisionSignalKey:null}))} />
        <div className="flex items-center gap-2"><DemoActorBar mode="notifications"/><details className="relative"><summary aria-label={c.more} className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border bg-card focus-visible:ring-2 focus-visible:ring-ring"><MoreHorizontal className="size-5" /></summary><div className="absolute right-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] space-y-3 rounded-2xl border bg-card p-3 shadow-xl"><DemoActorBar mode="roles"/><div className="flex flex-wrap items-center gap-2"><Link href="/demo/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm"><LayoutDashboard className="size-4" />{dashboardName}</Link>{kidraht?<KidrahtButton href="/demo/kidraht" title={t("demo.kidrahtTitle",currentLang)} className="h-11 min-w-11"/>:null}<DemoThemeButton dark={dark} label={t("admin.themeToggle",currentLang)}/><LanguageSwitcher/></div></div></details></div>
      </div>
      <nav data-demo-navigation aria-label="Demo" className="mt-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap [&>*]:shrink-0">
        <Link href="/demo/workzone" className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"><Home className="size-4" />{workzoneName}</Link>
        <Link href="/demo/wood" className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"><TreePine className="size-4" />{wood.title}</Link>
        <Link href="/demo/workshop" className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"><Wrench className="size-4" />{c.title}</Link>
        <Link href="/demo/workshop?tab=tools" className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"><Package className="size-4" />{c.tools}</Link>
        <Link href="/demo/workshop?tab=fleet" aria-label={`${c.fleet} · Demo`} className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><Truck className="size-4" />{c.fleet}</Link>
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
