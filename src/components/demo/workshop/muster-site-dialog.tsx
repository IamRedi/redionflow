"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import type { MusterSiteData } from "@/lib/workshop/site-detail";
import { WorkshopDialog } from "./workshop-ui";

const MusterSite = dynamic(() => import("./muster-site").then(module => module.MusterSite));

export function MusterSiteDialog({ site, onClose }: { site: { id: string; name: string; detail?: MusterSiteData }; onClose: () => void }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang);
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

  return <WorkshopDialog open wide title={site.name} description={detail?.address || c.shared} closeLabel={c.close} onClose={onClose}>
    <div data-testid="muster-site-detail" className="baum-site-detail">
      {detail ? <MusterSite {...detail} embedded /> : error ? <div className="space-y-3 py-4"><p role="alert" className="text-sm">{c.connection}</p><Button variant="outline" className="min-h-11" onClick={() => { setError(false); setAttempt(value => value + 1); }}><RefreshCw className="size-4" />{c.refresh}</Button></div> : <p role="status" className="flex min-h-24 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 motion-safe:animate-spin" />{c.loading}</p>}
    </div>
  </WorkshopDialog>;
}
