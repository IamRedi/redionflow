"use client";
import { assetIdentity } from "@/lib/workshop/asset-identity";
import { ArrowRight, Clock3, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { activeJob, availability, type WorkshopAsset } from "@/lib/workshop/demo-model";
import { useWorkshopDemo } from "./use-workshop-demo";
import { DemoPhoto } from "./demo-photo";
import { WorkshopAssetArt } from "./workshop-art";
import { action, Status } from "./workshop-ui";

export function InventoryAssetCard({ asset, now, onOpen }: { asset: WorkshopAsset; now: string; onOpen: () => void }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), { state } = useWorkshopDemo();
  const value = availability(state, asset, now), request = state.custody.handovers.find(h => h.assetId === asset.id && h.status === "pending");
  return <article className="flex min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm sm:block">
    <DemoPhoto kind="asset" target={asset.id} alt={`${asset.name} · ${assetIdentity(asset)}`} className="h-auto w-24 shrink-0 border-r bg-muted/15 sm:h-32 sm:w-full sm:border-b sm:border-r-0"><WorkshopAssetArt id={asset.id} name={asset.name} category={asset.details?.category} animate={Boolean(activeJob(state, asset.id))} className="mx-auto h-full w-full max-w-[220px]" /></DemoPhoto>
    <div className="min-w-0 flex-1 p-4"><Status tone={value === "available" ? "green" : value === "issued" ? "blue" : "amber"}>{c[value === "inspection" ? "inspectionDue" : value]}</Status><h2 className="mt-2 break-words text-base font-semibold">{asset.name}</h2><p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">{assetIdentity(asset)}</p><div className="my-3 min-h-10 space-y-1 text-xs text-muted-foreground">{asset.holder && <p className="flex items-start gap-2"><UserRound className="size-3.5 shrink-0" /><span className="break-words">{asset.holder}</span></p>}<p className="flex items-start gap-2"><MapPin className="size-3.5 shrink-0" /><span className="break-words">{asset.placement?.siteName || (asset.holder ? c.issued : asset.location)}</span></p>{request && <p className="flex items-center gap-2 text-primary"><Clock3 className="size-3.5" />{c.pending}</p>}</div><Button variant="outline" className={`${action} w-full`} onClick={onOpen}>{c.details}<ArrowRight className="size-4" /></Button></div>
  </article>;
}
