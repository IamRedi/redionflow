import type { Metadata, Viewport } from "next";
import { FooterBrandProvider } from '@/components/branding/FooterBrand';
import { cookies } from "next/headers";
import Link from "next/link";
import { Bell, Home, LayoutDashboard } from "lucide-react";

import { LanguageProvider } from "@/components/i18n/language-provider";
import { KidrahtButton } from "@/components/kidraht/kidraht-button";
import { Button } from "@/components/ui/button";
import { ProductionHeaderTools } from "@/components/shell/ProductionHeaderTools";
import { TopbarAnnouncementButton } from "@/app/(workzone)/workzone/topbar-announcement-button";
import { notifyTeamAction } from "@/app/(workzone)/workzone/announcement-actions";
import { isSteelCompany } from "@/lib/dashboard/steel-access";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { appName, appSuffix, appSuperscript, brandAppleIconSrc, brandIconSrc, saasAppName, saasAppSuffix } from "@/lib/branding";
import { getCompanyMode } from "@/lib/db/company";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { kidrahtAvailable } from "@/lib/kidraht/company-link";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { t } from "@/lib/i18n";
import { productBranding } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const rootTitle = isSaasMode ? `${saasAppName}${saasAppSuffix}` : `${appName} ${appSuffix}`;
export const viewport: Viewport = { interactiveWidget: 'resizes-content' };

export const metadata: Metadata = {
  title: rootTitle,
  description: "Clean operational flow platform for field work and office control.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: rootTitle,
  },
  icons: {
    icon: brandIconSrc,
    apple: brandAppleIconSrc,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const theme = jar.get("bk_theme")?.value === "dark" ? "dark" : "light";
  // Same resolution as server components (cookie, worker, Accept-Language), so client
  // and server parts of a page never render in different languages.
  const initialLang = await resolveRequestLanguage();
  const admin = await getCurrentAdmin();
  const companyMode = await getCompanyMode();
  const worker = admin ? null : await getCurrentWorker();
  const companyId = admin || worker ? await getCurrentCompanyId() : null;
  const kidraht = await kidrahtAvailable(companyId);
  const production = companyMode === "bau" && companyId !== null && await isSteelCompany(companyId);
  const announcement = production && admin ? await prisma.workzoneAnnouncement.findFirst({ where: { companyProfileId: companyId!, isActive: true }, select: { message: true }, orderBy: { createdAt: "desc" } }) : null;
  const brand = productBranding(companyMode);
  const showSaasPublicBrand = isSaasMode && !admin && !worker;
  // Fall back to the static brand for pre-session pages where no company is
  // resolvable; otherwise show the tenant's own product name.
  const displayName = showSaasPublicBrand ? saasAppName : (brand?.name ?? appName);
  const displaySuffix = showSaasPublicBrand ? saasAppSuffix : (brand?.suffix ?? appSuffix);
  const displaySuperscript = showSaasPublicBrand ? "" : (brand?.superscript ?? appSuperscript);
  const adminProfileTitle = t("admin.adminProfileHeading", initialLang, companyMode);
  const brandBadge = (
    <span className="whitespace-nowrap text-[10px] font-semibold tracking-tight">
      <span>{displayName}</span>{" "}
      <span className="relative inline-block pr-1 text-brand-green">
        {displaySuffix}
        {displaySuperscript ? (
          <span className="absolute -right-1 -top-0.5 text-[8px] font-bold leading-none text-red-700 dark:text-red-400">
            {displaySuperscript}
          </span>
        ) : null}
      </span>
    </span>
  );

  return (
    <html
      lang={initialLang}
      className={`${theme === "dark" ? "dark " : ""}mode-${companyMode}`.trim()}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={`min-h-dvh bg-background text-foreground antialiased mode-${companyMode}`}>
        <LanguageProvider initialLang={initialLang}>
          <FooterBrandProvider mark={production ? (admin ? <Link href="/app/profile" title={adminProfileTitle} aria-label={adminProfileTitle}>{brandBadge}</Link> : brandBadge) : null}>
          {/* Operational tools align with the header; the steel product mark lives in the shared footer. */}
          {production ? <ProductionHeaderTools
            navigation={<>
              <Link href="/workzone" aria-label={t("workzone.title", initialLang)} title={t("workzone.title", initialLang)} className="inline-flex size-[44px] items-center justify-center rounded-full border bg-transparent text-foreground/80 transition hover:bg-muted hover:text-foreground"><Home className="size-4" /></Link>
              {admin && <Link href="/app/dashboard" aria-label={t("workzone.admin", initialLang)} title={t("workzone.admin", initialLang)} className="inline-flex size-[44px] items-center justify-center rounded-full border bg-transparent text-foreground/80 transition hover:bg-muted hover:text-foreground"><LayoutDashboard className="size-4" /></Link>}
            </>}
            alerts={admin ? <>
              <TopbarAnnouncementButton message={announcement?.message ?? null} className="size-[44px] bg-transparent shadow-none" />
              <form action={notifyTeamAction}><Button type="submit" variant="outline" size="icon" className="size-[44px] rounded-full bg-transparent text-foreground/80 shadow-none hover:bg-muted hover:text-foreground" title={t("workzone.notifyTeam", initialLang)} aria-label={t("workzone.notifyTeam", initialLang)}><Bell className="size-4" /></Button></form>
            </> : null}
            book={kidraht ? <KidrahtButton href="/workzone/kidraht" title={t("demo.kidrahtTitle", initialLang)} iconOnly /> : null}
          /> : <div data-testid="flow-global-tools" className="absolute right-2 top-2 z-[1000] flex items-center gap-1.5 print:hidden">
            {kidraht ? <KidrahtButton href="/workzone/kidraht" title={t("demo.kidrahtTitle", initialLang)} /> : null}
            <div className={`border border-border/50 bg-background/90 px-1.5 py-0.5 backdrop-blur ${admin ? "" : "pointer-events-none"}`}>
              {admin ? (
                <Link href="/app/profile" title={adminProfileTitle} aria-label={adminProfileTitle} className="block transition hover:text-brand-green">
                  {brandBadge}
                </Link>
              ) : (
                brandBadge
              )}
            </div>
          </div>}
          {children}
          </FooterBrandProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
