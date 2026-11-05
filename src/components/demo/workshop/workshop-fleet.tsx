"use client";
import { DemoMachineRail, type DemoMachine } from "@/components/demo/demo-machine-rail";
import { useLanguage } from "@/components/i18n/language-provider";
import { availability } from "@/lib/workshop/demo-model";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";

/** Overlay fictional browser-local availability without writing operational machines. */
export function WorkshopFleet({ machines, now }: { machines: DemoMachine[]; now: string }) {
  const { state } = useWorkshopDemo(); const { currentLang } = useLanguage(); const c = workshopCopy(currentLang);
  const links: Record<string, { href: string; label: string; status: string }> = {};
  const fleet = machines.map(machine => {
    const asset = state.assets.find(a => a.code === machine.targe);
    if (!asset) return machine;
    const status = availability(state, asset, now);
    links[machine.id] = { href: `/demo/workshop?tab=fleet&asset=${asset.id}`, label: c.open, status: c[status === "inspection" ? "inspectionDue" : status] };
    return { ...machine, isActive: machine.isActive && status !== "workshop" && status !== "inspection" };
  });
  return <div className="hidden lg:block"><DemoMachineRail machines={fleet} initiallyOpen={false} workshopLinks={links} /></div>;
}
