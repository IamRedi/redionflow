import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { LanguageProvider } from "@/components/i18n/language-provider";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { appName, appSuffix, appSuperscript, brandAppleIconSrc, brandIconSrc, saasAppName, saasAppSuffix } from "@/lib/branding";
import { getCompanyMode } from "@/lib/db/company";
import { t } from "@/lib/i18n";
import { productBranding } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const rootTitle = isSaasMode ? `${saasAppName}${saasAppSuffix}` : `${appName} ${appSuffix}`;

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
  const brand = productBranding(companyMode);
  const showSaasPublicBrand = isSaasMode && !admin;
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
          <div
            className={`fixed right-2 top-2 z-[1000] border border-border/50 bg-background/90 px-1.5 py-0.5 backdrop-blur ${
              admin ? "" : "pointer-events-none"
            }`}
          >
            {admin ? (
              <Link href="/app/profile" title={adminProfileTitle} aria-label={adminProfileTitle} className="block transition hover:text-brand-green">
                {brandBadge}
              </Link>
            ) : (
              brandBadge
            )}
          </div>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
