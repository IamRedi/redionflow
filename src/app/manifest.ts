import type { MetadataRoute } from "next";

import { appName, appSuffix, brandIconSrc, brandManifestIconSrc, saasAppName, saasAppSuffix } from "@/lib/branding";
import { isSaasMode } from "@/lib/saas-config";

export default function manifest(): MetadataRoute.Manifest {
  const name = isSaasMode ? `${saasAppName}${saasAppSuffix}` : `${appName} ${appSuffix}`;
  return {
    name,
    short_name: name,
    description: isSaasMode
      ? "RediOnFlow SaaS platform for field work, planning, and office control."
      : "BaumdienstFlow als mobile Web App fuer Betrieb, Workzone und Tagesplanung.",
    start_url: "/start",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#237f45",
    lang: "de",
    icons: [
      {
        src: brandManifestIconSrc,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: brandIconSrc,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
