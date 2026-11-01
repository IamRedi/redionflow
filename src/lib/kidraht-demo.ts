/**
 * Link from the public BaumdienstFlow demo to the KiDraht Assistant, where the
 * same fictitious company (Baumdienst Musterstadt GmbH) keeps its approved
 * safety rules, manuals and briefings per site. Demo pages only.
 */
const DEFAULT_URL = "https://kidraht-production-bc4a.up.railway.app/f/baumdienst-musterstadt";

export function kidrahtDemoUrl(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.KIDRAHT_DEMO_URL ?? DEFAULT_URL).trim();
  if (!raw || raw === "off") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Briefings tab for workers; the site's own briefing is listed there by site name. */
export function kidrahtBriefingUrl(base: string): string {
  return `${base}#briefing`;
}
