import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MachineSidebar } from "@/app/(workzone)/workzone/machine-sidebar";
import { LiveRefreshListener } from "@/components/realtime/live-refresh-listener";
import { AdminNavGroup } from "@/components/shell/admin-nav-group";
import { AdminNavLink } from "@/components/shell/admin-nav-link";
import { FlowTopBar } from "@/components/shell/FlowTopBar";
import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { LanguageDropdown } from "@/components/i18n/language-dropdown";
import { logoutAdminAction } from "@/app/admin-login/actions";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCompanyMode } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { getFeatures, productBranding } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";
import { getMachineSidebarData } from "@/lib/workzone/machine-sidebar-data";

type RequiredFeature = "trees" | "machines" | "reports" | "baustellen" | "calculation" | "inventory" | "gps";

type AdminNavItem = {
  href: string;
  label: string;
  activePrefixes?: string[];
  requires?: RequiredFeature;
};

type AdminNavSection = {
  title: string | null;
  requires?: RequiredFeature;
  items: AdminNavItem[];
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(isSaasMode ? "/login" : "/admin-login");
  const [machines, mode, currentLang] = await Promise.all([
    getMachineSidebarData(),
    getCompanyMode(),
    resolveRequestLanguage(),
  ]);
  const features = getFeatures(mode);
  const branding = productBranding(mode);

  const navSections: AdminNavSection[] = [
    {
      title: null,
      items: [
        { href: "/app/admin", label: t("admin.navPersonalFleet", currentLang, mode), activePrefixes: ["/app/admin/workers/", "/app/admin/day/", "/app/admin/machines/"] },
        { href: "/app/fleet-gps", label: t("admin.navFleetGps", currentLang, mode), requires: "gps" },
        { href: "/app/admin/inventory", label: t("admin.navBarcodeInventory", currentLang, mode), requires: "inventory" },
        { href: "/app/safety", label: t("admin.navSafetyEquipment", currentLang, mode), requires: "inventory" },
      ],
    },
    {
      title: t("admin.navBaustellenGroup", currentLang, mode),
      requires: "baustellen",
      items: [{ href: "/app/baustellen", label: t("admin.navBaustellen", currentLang, mode), activePrefixes: ["/app/baustellen/"] }],
    },
    {
      title: t("admin.navProjectsGroup", currentLang, mode),
      requires: "trees",
      items: [
        { href: "/app/projects", label: t("admin.navProjects", currentLang, mode) },
      ],
    },
  ];

  function featureEnabled(feature: RequiredFeature | undefined): boolean {
    if (!feature) return true;
    const value = features[feature];
    return value === true || value === "limited";
  }

  const visibleNavSections = navSections
    .filter((section) => featureEnabled(section.requires))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => featureEnabled(item.requires)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 print:hidden">
        <FlowTopBar />
      </header>
      <MachineSidebar machines={machines} isAdmin />
      <div className="grid min-h-dvh min-w-[430px] grid-cols-1 gap-5 px-4 py-5 sm:min-w-0 md:grid-cols-[196px_1fr] md:px-5 lg:pr-16">
        <aside className="print:hidden">
          <nav className="no-scrollbar sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
            <div className="rounded-2xl border bg-background/70 p-3 shadow-sm backdrop-blur">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.panelTitle", currentLang, mode)}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[13px] font-medium leading-5 text-foreground">{t("admin.panelTitle", currentLang, mode)}</span>
                <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-brand-green/80">
                  {branding.name}{branding.suffix}<sup>{branding.superscript}</sup>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {mode === "personal"
                  ? t("admin.panelPersonalDescription", currentLang, mode)
                  : mode === "bau"
                    ? t("admin.panelBauDescription", currentLang, mode)
                    : t("admin.panelBaumdienstDescription", currentLang, mode)}
              </p>
              <div className="mt-2.5 rounded-xl border bg-background/80 px-2.5 py-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.signedInAs", currentLang, mode)}</div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">{admin.name ?? admin.email}</div>
                {admin.name && admin.email ? <div className="truncate text-xs text-muted-foreground">{admin.email}</div> : null}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {visibleNavSections.map((section, index) => (
                <div key={section.title ?? `section-${index}`} className="space-y-2">
                  {section.title && section.items.length === 1 ? (
                    <ul className="flex flex-col gap-1.5">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <AdminNavLink href={item.href} label={item.label} activePrefixes={item.activePrefixes} />
                        </li>
                      ))}
                    </ul>
                  ) : section.title ? (
                    <AdminNavGroup title={section.title} items={section.items} />
                  ) : (
                    <div className="space-y-2">
                      <div className="px-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("admin.operations", currentLang, mode)}</div>
                      <ul className="flex flex-col gap-1.5">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <AdminNavLink href={item.href} label={item.label} activePrefixes={item.activePrefixes} />
                        </li>
                      ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1 flex flex-col gap-1.5">
              <AdminNavLink href="/app/audit" label={t("admin.auditLog", currentLang, mode)} activePrefixes={["/app/audit"]} />
              <LanguageDropdown />
              <form action={logoutAdminAction}>
                <button
                  type="submit"
                  className="w-full rounded-xl border bg-background/80 px-3 py-2 text-[13px] font-medium shadow-sm backdrop-blur transition hover:bg-muted"
                >
                  {t("admin.logout", currentLang, mode)}
                </button>
              </form>
              <form action="/app/toggle-theme" method="post">
                <button
                  type="submit"
                  className="w-full rounded-xl border bg-background/80 px-3 py-2 text-[13px] font-medium shadow-sm backdrop-blur transition hover:bg-muted"
                >
                  {t("admin.themeToggle", currentLang, mode)}
                </button>
              </form>
            </div>
          </nav>
        </aside>

        <div className="min-w-0">
          <LiveRefreshListener enabled />
          <main className="print:px-0 print:py-0">{children}</main>
          <RediOnFooter />
        </div>
      </div>
    </div>
  );
}
