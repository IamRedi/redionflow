"use client";
import { useEffect, useState } from "react";
import { WorkzoneMissionControl, type MissionItem } from "@/app/(workzone)/workzone/workzone-mission-control";
import { useWorkshopDemo } from "./use-workshop-demo";
import { DemoPlanToolbar } from "./demo-plan";
import type { DemoPlanSnapshot } from "@/lib/workshop/plan-model";
import { workshopDay } from "@/lib/workshop/demo-model";
export type MusterMission = { id: string; key: string; trees: { treeId: string; status: string }[] };
/** Preserve the original canvas/map; overlay only Musterfirma shared tree progress. */
export function MusterWorkzone({ sites, missions, defaultAddress, now }: { sites: MusterMission[]; missions: MissionItem[]; defaultAddress: string; now: string }) {
  const { state } = useWorkshopDemo();
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
  return <WorkzoneMissionControl items={items.filter(active)} archive={items.filter(i => !active(i))} defaultAddress={defaultAddress} detailHrefBase="/demo/baustellen" mode="baumdienst" readOnly allowCanvasDrag toolbar={<DemoPlanToolbar now={now} />} />;
}
