"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { sceneCopy } from "@/lib/workshop/scene-copy";
import { WorkshopDialog } from "./workshop-ui";
import { WorkzoneMissionControl, type MissionItem } from "@/app/(workzone)/workzone/workzone-mission-control";
import { useWorkshopDemo } from "./use-workshop-demo";
import { DemoPlanToolbar } from "./demo-plan";
import type { DemoPlanSnapshot } from "@/lib/workshop/plan-model";
import { workshopDay } from "@/lib/workshop/demo-model";
export type MusterMission = { id: string; key: string; trees: { treeId: string; status: string }[] };
/** Preserve the original canvas/map; overlay only Musterfirma shared tree progress. */
export function MusterWorkzone({ sites, missions, defaultAddress, now, monitor = false, footer }: { footer?: ReactNode; monitor?: boolean; sites: MusterMission[]; missions: MissionItem[]; defaultAddress: string; now: string }) {
  const { state } = useWorkshopDemo();
  const { currentLang } = useLanguage(), sc = sceneCopy(currentLang);
  const [information, setInformation] = useState(false);
  const [plan, setPlan] = useState<DemoPlanSnapshot | null>(null);
  const date = workshopDay(now);
  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      if (document.visibilityState !== "visible") return;
      try { const response = await fetch(`/api/demo/baumdienst/plans?date=${date}`, { cache: "no-store", signal: controller.signal }); if (response.ok) { const value = await response.json(); if (!controller.signal.aborted) setPlan(value); } }
      catch { /* The original field remains usable if the optional plan read is offline. */ }
    };
    void read(); const timer = window.setInterval(() => void read(), 8000); window.addEventListener("focus", read);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", read); };
  }, [date]);
  const items = missions.map(item => {
    const site = sites.find(s => s.id === item.id);
    if (!site) return item;
    const done = site.trees.filter(t => (state.custody.trees[`${site.key}:${t.treeId}`]?.status || t.status) === "done").length;
    const row = plan?.plans.find(p => p.date === date)?.savedRows.find(r => r.id === site.key);
    return { ...item, done, pct: site.trees.length ? Math.round(done / site.trees.length * 100) : 0, planSummary: row ? [row.workerNames, row.machineNames].filter(Boolean).join(" · ") : undefined };
  });
  const active = (item: MissionItem) => item.pct < 100 || item.equipmentIndicators.length > 0 || Boolean(item.pendingSiteTask);
  const archived = items.filter(i => !active(i));
  return <MotionConfig reducedMotion="user"><WorkzoneMissionControl musterScene items={items.filter(active)} archive={archived} defaultAddress={defaultAddress} detailHrefBase="/demo/baustellen" mode="baumdienst" readOnly demoPhotoReadOnly={monitor} allowCanvasDrag={!monitor} toolbar={<>{!monitor && <DemoPlanToolbar now={now}/>}<Button variant="outline" size="icon" className="size-11 rounded-full" aria-label={sc.information} title={sc.information} onClick={() => setInformation(true)}><History className="size-4"/></Button></>} />
    <WorkshopDialog open={information} onClose={() => setInformation(false)} title={sc.information} closeLabel={t("common.close",currentLang)}>
      <section data-testid="workzone-scene-archive" className="mb-5"><h2 className="mb-3 text-sm font-semibold">{t("workzone.dailyArchive",currentLang)}</h2>{archived.length ? <ul className="divide-y">{archived.map(item => <li key={item.id}><Link href={`/demo/baustellen/${item.id}`} className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 text-xs text-primary">{item.done}/{item.total} · 100%</span></Link></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("workzone.noCompletedToday",currentLang)}</p>}</section>{footer}
    </WorkshopDialog></MotionConfig>;
}
