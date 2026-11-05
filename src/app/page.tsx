import type { Metadata } from "next";
import { cookies } from "next/headers";

import { LandingPage } from "@/components/landing/LandingPage";
import { landingContent } from "@/components/landing/landing-content";
import { isBaumdienstWorkshopDemoEnabled, isPublicDemoEnabled } from "@/lib/public-demo";
import { isSaasMode } from "@/lib/saas-config";
import { getCompanyMode } from "@/lib/db/company";

export const metadata: Metadata = {
  title: landingContent.de.meta.title,
  description: landingContent.de.meta.description,
};

export default async function HomePage() {
  const jar = await cookies();
  const initialTheme = jar.get("bk_theme")?.value === "dark" ? "dark" : "light";

  const demoEnabled = isPublicDemoEnabled();
  const workshopDemoEnabled = demoEnabled && isBaumdienstWorkshopDemoEnabled(await getCompanyMode());
  return <LandingPage initialTheme={initialTheme} isSaasMode={isSaasMode} demoEnabled={demoEnabled} workshopDemoEnabled={workshopDemoEnabled} />;
}
