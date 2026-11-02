/**
 * Link from BaumdienstFlow to the KiDraht Assistant, where the company keeps its
 * approved safety rules, manuals and briefings per site. KiDraht opens inside
 * BaumdienstFlow (iframe); KiDraht must list this origin in KIDRAHT_FRAME_ANCESTORS.
 */
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

/** Public demo: the fictitious Baumdienst Musterstadt GmbH in KiDraht. */
export function kidrahtDemoUrl(env: Record<string, string | undefined> = process.env): string | null {
  return safeUrl(env.KIDRAHT_DEMO_URL ?? DEFAULT_DEMO_URL);
}

/** Real Workzone: the company's own KiDraht link; hidden until KIDRAHT_URL is set. */
export function kidrahtAppUrl(env: Record<string, string | undefined> = process.env): string | null {
  return safeUrl(env.KIDRAHT_URL);
}

/** Briefings tab for workers; the site's own briefing is listed there by site name. */
export function kidrahtBriefingUrl(base: string): string {
  return `${base}#briefing`;
}
