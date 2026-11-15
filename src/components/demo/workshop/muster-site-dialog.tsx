"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { ArrowLeft, LoaderCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import type { MusterSiteData } from "@/lib/workshop/site-detail";
import { siteCardCopy, type SitePanel } from "@/lib/workshop/site-card-copy";
import { officeCopy } from "@/lib/workshop/offices/copy";
import { woodCopy } from "@/lib/workshop/wood-copy";
import { WorkshopDialog } from "./workshop-ui";

const headingFont = localFont({ src: "../../branding/fonts/manrope-variable.ttf", weight: "200 800", display: "swap", preload: false, fallback: ["system-ui", "sans-serif"] });
const MusterSite = dynamic(() => import("./muster-site").then(module => module.MusterSite));

export function MusterSiteDialog({ site, onClose }: { site: { id: string; name: string; detail?: MusterSiteData }; onClose: () => void }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), copy = siteCardCopy(currentLang);
  const [panel, setPanel] = useState<SitePanel>("overview");
  const frame = useRef<HTMLDivElement>(null), previousPanel = useRef<SitePanel | null>(null), overviewTop = useRef(0);
  function navigate(next: SitePanel) {
    if (panel === "overview") { overviewTop.current = frame.current?.closest<HTMLElement>('[role="dialog"]')?.scrollTop ?? 0; previousPanel.current = next; }
    setPanel(next);
  }
  useLayoutEffect(() => {
    const dialog = frame.current?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    dialog.scrollTop = panel === "overview" ? overviewTop.current : 0;
    if (panel === "overview" && previousPanel.current) frame.current?.querySelector<HTMLElement>(`[data-site-entry="${previousPanel.current}"]`)?.focus({ preventScroll: true });
    else if (panel !== "overview") dialog.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [panel]);
  const [detail, setDetail] = useState(site.detail ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (site.detail) return;
    const controller = new AbortController();
    void fetch(`/api/demo/baumdienst/sites/${encodeURIComponent(site.id)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("connection"); return response.json() as Promise<MusterSiteData>; })
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [site.id, site.detail, attempt, currentLang]);

  const titles: Record<SitePanel, string> = { overview: site.name, trees: c.trees, map: c.trees, inventory: c.siteInventory, team: c.team, safety: c.safety, photos: c.photos, work: woodCopy(currentLang).siteWork, documents: officeCopy(currentLang).archive, instructions: c.instructions };
  return <WorkshopDialog open wide centered eyebrow={panel === "overview" ? copy.site : undefined} title={titles[panel]} titleClassName={headingFont.className} description={panel === "overview" ? detail?.address || c.shared : site.name} className={`baum-site-dialog baum-site-dialog--${panel}`} headerLeading={panel !== "overview" ? <Button type="button" variant="ghost" size="icon" className="baum-site-back size-11 shrink-0" aria-label={copy.back} title={copy.back} onClick={() => navigate("overview")}><ArrowLeft /></Button> : undefined} closeLabel={c.close} onEscapeKeyDown={event => { const close = frame.current?.querySelector<HTMLButtonElement>("[data-tree-inline-close]"); if (close) { event.preventDefault(); close.click(); } }} onClose={onClose}>
    <div ref={frame} data-testid="muster-site-detail" data-site-panel={panel} className="baum-site-detail">
      {detail ? <div key={panel} className="baum-site-panel"><MusterSite {...detail} panel={panel} onOpenPanel={navigate} /></div> : error ? <div className="space-y-3 py-4"><p role="alert" className="text-sm">{c.connection}</p><Button variant="outline" className="min-h-11" onClick={() => { setError(false); setAttempt(value => value + 1); }}><RefreshCw className="size-4" />{c.refresh}</Button></div> : <p role="status" className="flex min-h-24 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 motion-safe:animate-spin" />{c.loading}</p>}
    </div>
  </WorkshopDialog>;
}
