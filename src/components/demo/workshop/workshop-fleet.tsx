"use client";
import { useCallback, useMemo } from "react";
import { assetIdentity } from "@/lib/workshop/asset-identity";
import { DemoMachineRail, type DemoMachine } from "@/components/demo/demo-machine-rail";
import { useLanguage } from "@/components/i18n/language-provider";
import { availability } from "@/lib/workshop/demo-model";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { DemoPhoto, demoCoverUrl } from "./demo-photo";
import { WorkshopAssetArt } from "./workshop-art";

/** Shared fictional availability; never writes operational machines. */
export function WorkshopFleet({ machines, now, embedded = false }: { machines: DemoMachine[]; now: string; embedded?: boolean }) {
  const { state, photos, illustrations, mediaPreferences } = useWorkshopDemo(); const { currentLang } = useLanguage();
  // Recomputed only when fleet data or its media change, not on every demo render.
  const { fleet, links, assetByMachine } = useMemo(() => {
    const c = workshopCopy(currentLang);
    const links: Record<string, { href: string; label: string; status: string }> = {};
    const assetByMachine = new Map<string, (typeof state.assets)[number]>();
    // The legacy saw set is a planning group, not a fifth vehicle or a second saw.
    const fleet = machines.filter(machine => state.assets.some(a => a.kind === "fleet" && a.code === machine.targe)).map(machine => {
      const asset = state.assets.find(a => a.code === machine.targe);
      if (!asset) return machine;
      assetByMachine.set(machine.id, asset);
      const status = availability(state, asset, now);
      links[machine.id] = { href: `/demo/workshop?tab=fleet&asset=${asset.id}&detail=1`, label: c.manage, status: c[status === "inspection" ? "inspectionDue" : status] };
      // The small rail button shows the vehicle's own cover, the same picture as its card everywhere.
      return { ...machine, imageUrl: demoCoverUrl({ state, photos, illustrations, mediaPreferences }, "asset", asset.id) ?? machine.imageUrl, targe: assetIdentity(asset), isActive: machine.isActive && status !== "workshop" && status !== "inspection" };
    });
    return { fleet, links, assetByMachine };
  }, [machines, now, currentLang, state, photos, illustrations, mediaPreferences]);
  const renderPhoto = useCallback((machine: DemoMachine) => { const asset = assetByMachine.get(machine.id); return asset ? <DemoPhoto kind="asset" target={asset.id} alt={`${asset.name} · ${assetIdentity(asset)}`} readOnly className="size-full"><WorkshopAssetArt id={asset.id} name={asset.name} category={asset.details?.category} className="mx-auto h-full" /></DemoPhoto> : null; }, [assetByMachine]);
  return <div data-demo-fleet={embedded ? "embedded" : "floating"} className={embedded ? "min-w-0" : "pointer-events-none fixed inset-0 z-20 hidden lg:block [&_aside]:pointer-events-auto"}><DemoMachineRail machines={fleet} initiallyOpen={embedded} workshopLinks={links} renderPhoto={renderPhoto} /></div>;
}
