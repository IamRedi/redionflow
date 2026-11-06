import type { MetadataRoute } from "next";

import { appName, appSuffix, brandIconSrc, brandManifestIconSrc, saasAppName, saasAppSuffix } from "@/lib/branding";
import { isSaasMode } from "@/lib/saas-config";
import { installationBrand } from '@/lib/installation-brand';

export const dynamic = 'force-dynamic';
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await installationBrand();
  const name = brand?.name ?? (isSaasMode ? `${saasAppName}${saasAppSuffix}` : `${appName} ${appSuffix}`);
  return {
    name,
    short_name: name,
    description: brand ? `${brand.name} · Workzone` : isSaasMode
      ? "RediOnFlow SaaS platform for field work, planning, and office control."
      : "BaumdienstFlow als mobile Web App fuer Betrieb, Workzone und Tagesplanung.",
    start_url: "/start",
    id: "/start", // Preserve the previous implicit ID (start_url) for existing installs.
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: brand ? "#ffffff" : "#237f45",
    lang: brand?.lang ?? "de",
    icons: [
      {
        src: brand ? '/app-icon/512' : brandManifestIconSrc,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brand ? '/app-icon/192' : brandIconSrc,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      ...(brand ? [{ src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const }] : []),
    ],
  };
}
