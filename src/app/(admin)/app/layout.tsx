import { LogOut, SunMoon } from "lucide-react";
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
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { kidrahtAvailable } from "@/lib/kidraht/company-link";
import { getFeatures, productBranding } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";
import { fleetShowsCones, getMachineSidebarData } from "@/lib/workzone/machine-sidebar-data";

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

/** Product name, not translated. */
const KIDRAHT_NAME = "KiDraht";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(isSaasMode ? "/login" : "/admin-login");
  const [machines, mode, currentLang, showCones, kidrahtOn] = await Promise.all([
    getMachineSidebarData(),
    getCompanyMode(),
    resolveRequestLanguage(),
    fleetShowsCones(),
    getCurrentCompanyId().then(kidrahtAvailable),
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
    return value === true;
  }

  const visibleNavSections = navSections
    .filter((section) => featureEnabled(section.requires))
    .map((section) => ({
      ...section,
      // Road-work safety stock (signs, plates, fences) is not used by steel companies.
      items: section.items.filter((item) => featureEnabled(item.requires) && (showCones || item.href !== "/app/safety")),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 print:hidden">
        <FlowTopBar />
      </header>
      <MachineSidebar machines={machines} isAdmin showCones={showCones} />
      <div className="grid min-h-dvh grid-cols-1 gap-5 px-4 py-5 md:grid-cols-[208px_1fr] md:px-5 lg:pr-24">
        <aside className="min-w-0 print:hidden">
          {/* One menu: a scrollable row of links on phones, a sidebar from tablet up. */}
          <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:sticky md:top-24 md:mx-0 md:max-h-[calc(100dvh-7rem)] md:flex-col md:gap-4 md:overflow-y-auto md:overscroll-contain md:rounded-2xl md:border md:bg-card/70 md:p-2 md:shadow-sm md:backdrop-blur">
            <div className="hidden items-center gap-2.5 rounded-xl px-2 pt-1.5 md:flex">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {(admin.name ?? admin.email ?? "?").trim().slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{admin.name ?? admin.email}</div>
                <div className="truncate text-[11px] leading-tight text-muted-foreground">{admin.name && admin.email ? admin.email : t("admin.panelTitle", currentLang, mode)}</div>
              </div>
            </div>
            <div className="contents md:flex md:flex-col md:gap-0.5">
              <AdminNavLink href="/app/dashboard" label={t("admin.navDashboard", currentLang, mode)} />
              {kidrahtOn ? <AdminNavLink href="/workzone/kidraht" label={KIDRAHT_NAME} /> : null}
            </div>
            {visibleNavSections.map((section, index) => (
              <div key={section.title ?? `section-${index}`} className="contents md:flex md:flex-col md:gap-0.5">
                {section.title === null ? (
                  <div className="hidden px-2.5 pb-1 font-mono text-[10px] md:block font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    {t("admin.operations", currentLang, mode)}
                  </div>
                ) : null}
                {section.title && section.items.length > 1 ? (
                  <AdminNavGroup title={section.title} items={section.items} />
                ) : (
                  section.items.map((item) => <AdminNavLink key={item.href} href={item.href} label={item.label} activePrefixes={item.activePrefixes} />)
                )}
              </div>
            ))}
            <div className="contents md:mt-auto md:flex md:flex-col md:gap-0.5 md:border-t md:pt-2">
              <AdminNavLink href="/app/settings" label={t("admin.navSettings", currentLang, mode)} />
              <AdminNavLink href="/app/audit" label={t("admin.auditLog", currentLang, mode)} activePrefixes={["/app/audit"]} />
              <div className="hidden items-center gap-1 pt-1 md:flex">
                <div className="min-w-0 flex-1">
                  <LanguageDropdown />
                </div>
                <form action="/app/toggle-theme" method="post">
                  <button
                    type="submit"
                    title={t("admin.themeToggle", currentLang, mode)}
                    aria-label={t("admin.themeToggle", currentLang, mode)}
                    className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
                  >
                    <SunMoon className="size-4" strokeWidth={1.8} />
                  </button>
                </form>
                <form action={logoutAdminAction}>
                  <button
                    type="submit"
                    title={t("admin.logout", currentLang, mode)}
                    aria-label={t("admin.logout", currentLang, mode)}
                    className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                  >
                    <LogOut className="size-4" strokeWidth={1.8} />
                  </button>
                </form>
              </div>
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
