import {publicDemoMetadata} from '@/lib/public-demo-seo';
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { LandingPage } from "@/components/landing/LandingPage";
import { landingContent } from "@/components/landing/landing-content";
import { isPublicDemoEnabled } from "@/lib/public-demo";
import { isSaasMode } from "@/lib/saas-config";

const baseMetadata: Metadata = {
  title: landingContent.de.meta.title,
  description: landingContent.de.meta.description,
};
export async function generateMetadata(): Promise<Metadata> {
 return publicDemoMetadata((await headers()).get('host'),baseMetadata);
}


export default async function HomePage() {
  const jar = await cookies();
  const initialTheme = jar.get("bk_theme")?.value === "dark" ? "dark" : "light";

  return <LandingPage initialTheme={initialTheme} isSaasMode={isSaasMode} demoEnabled={isPublicDemoEnabled()} />;
}
