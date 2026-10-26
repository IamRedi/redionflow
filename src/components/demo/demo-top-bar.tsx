import Link from "next/link";
import { Bot, Home, LayoutDashboard } from "lucide-react";

import { AppBrand } from "@/components/branding/AppBrand";
import { WorkerIconStrip } from "@/app/(workzone)/workzone/worker-icon-strip";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { DemoReadonlyBadge } from "./demo-readonly-badge";

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

export async function DemoTopBar({ workers }: { workers: DemoWorker[] }) {
  const currentLang = await resolveRequestLanguage();

  return (
    <div className="mx-auto grid max-w-6xl gap-2 px-5 pb-1 pt-8">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AppBrand compact logoAlt={t("common.companyLogoAlt", currentLang)} />
            <span
              className="inline-flex h-8 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300"
              title="AI preview"
              aria-label="AI preview"
            >
              <Bot className="size-3.5" />
              AI
            </span>
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
                title="Dashboard"
                aria-label="Dashboard"
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
