/**
 * Link from RediOnFlow (BaumdienstFlow and BauFlow) to the KiDraht Assistant, where the company keeps its
 * approved safety rules, manuals and briefings per site. KiDraht opens inside
 * the app (iframe); KiDraht must list this origin in KIDRAHT_FRAME_ANCESTORS.
 */
import type { CompanyMode } from "@/lib/mode-config";

const DEFAULT_DEMO_URL = "https://kidraht-production-bc4a.up.railway.app/f/baumdienst-musterstadt";

function safeUrl(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || value === "off") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/**
 * Public demo. BaumdienstFlow defaults to the fictitious Baumdienst Musterstadt GmbH;
 * BauFlow shows the button only when KIDRAHT_DEMO_URL is set for it.
 */
export function kidrahtDemoUrl(
  mode: CompanyMode | undefined,
  env: Record<string, string | undefined> = process.env,
): string | null {
  return safeUrl(env.KIDRAHT_DEMO_URL ?? (mode === "baumdienst" ? DEFAULT_DEMO_URL : undefined));
}

/** Real Workzone (Bau and Baumdienst): the company's own KiDraht link; hidden until KIDRAHT_URL is set. */
export function kidrahtAppUrl(env: Record<string, string | undefined> = process.env): string | null {
  return safeUrl(env.KIDRAHT_URL);
}

/** Briefings tab for workers; the site's own briefing is listed there by site name. */
export function kidrahtBriefingUrl(base: string): string {
  return `${base}#briefing`;
}
