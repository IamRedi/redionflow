import type { Metadata } from "next";
import { cookies } from "next/headers";

import { LandingPage } from "@/components/landing/LandingPage";
import { landingContent } from "@/components/landing/landing-content";
import { isPublicDemoEnabled } from "@/lib/public-demo";
import { isSaasMode } from "@/lib/saas-config";
import { redirect } from 'next/navigation';
import { bauflowMusterPublicDemoConfigured } from '@/lib/demo/bauflow-muster';

export const metadata: Metadata = {
  title: landingContent.de.meta.title,
  description: landingContent.de.meta.description,
};

export default async function HomePage() {
  if (bauflowMusterPublicDemoConfigured()) redirect('/muster');
  const jar = await cookies();
  const initialTheme = jar.get("bk_theme")?.value === "dark" ? "dark" : "light";

  return <LandingPage initialTheme={initialTheme} isSaasMode={isSaasMode} demoEnabled={isPublicDemoEnabled()} />;
}
