"use client";
import { assetIdentity } from "@/lib/workshop/asset-identity";
import { DemoMachineRail, type DemoMachine } from "@/components/demo/demo-machine-rail";
import { useLanguage } from "@/components/i18n/language-provider";
import { availability } from "@/lib/workshop/demo-model";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";

/** Shared fictional availability; never writes operational machines. */
export function WorkshopFleet({ machines, now }: { machines: DemoMachine[]; now: string }) {
  const { state } = useWorkshopDemo(); const { currentLang } = useLanguage(); const c = workshopCopy(currentLang);
  const links: Record<string, { href: string; label: string; status: string }> = {};
  // The legacy saw set is a planning group, not a fifth vehicle or a second saw.
  const fleet = machines.filter(machine => state.assets.some(a => a.kind === "fleet" && a.code === machine.targe)).map(machine => {
    const asset = state.assets.find(a => a.code === machine.targe);
    if (!asset) return machine;
    const status = availability(state, asset, now);
    links[machine.id] = { href: `/demo/workshop?tab=fleet&asset=${asset.id}&detail=1`, label: c.manage, status: c[status === "inspection" ? "inspectionDue" : status] };
    return { ...machine, targe: assetIdentity(asset), isActive: machine.isActive && status !== "workshop" && status !== "inspection" };
  });
  return <div data-demo-fleet className="pointer-events-none fixed inset-0 z-20 hidden lg:block [&_aside]:pointer-events-auto"><DemoMachineRail machines={fleet} initiallyOpen={false} workshopLinks={links} /></div>;
}
