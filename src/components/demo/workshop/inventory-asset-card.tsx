"use client";
import { assetIdentity, assetPlate } from "@/lib/workshop/asset-identity";
import { ArrowRight, Clock3, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { activeJob, availability, type WorkshopAsset } from "@/lib/workshop/demo-model";
import { useWorkshopDemo } from "./use-workshop-demo";
import { DemoPhoto } from "./demo-photo";
import { WorkshopAssetArt } from "./workshop-art";
import { action, Status } from "./workshop-ui";
import { FleetInspectionLights } from "./fleet-inspection-lights";
import styles from "./workshop.module.css";

export function InventoryAssetCard({ asset, now, onOpen, compact = false }: { asset: WorkshopAsset; now: string; onOpen: () => void; compact?: boolean }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), { state } = useWorkshopDemo();
  const value = availability(state, asset, now), request = state.custody.handovers.find(h => h.assetId === asset.id && h.status === "pending");
  if (compact && asset.kind === "fleet") {
    const placement = [asset.holder, asset.placement?.siteName].filter(Boolean).join(" · ") || asset.location;
    return <article className={`${styles.fleetCard} rounded-2xl border bg-card`} data-testid="fleet-asset-card">
      <DemoPhoto kind="asset" target={asset.id} alt={`${asset.name} · ${assetIdentity(asset)}`} className={styles.fleetPhoto}><WorkshopAssetArt id={asset.id} name={asset.name} animate={Boolean(activeJob(state, asset.id))} className="h-full w-full" /></DemoPhoto>
      <div className={styles.fleetBody}>
        <div className={styles.fleetStatus}><Status tone={value === "available" ? "green" : value === "issued" ? "blue" : "amber"}>{c[value === "inspection" ? "inspectionDue" : value]}</Status>{request && <span title={c.pending}><Clock3 className="size-3" /><span className="sr-only">{c.pending}</span></span>}</div>
        <h2 className={styles.fleetName}>{asset.name}</h2><p className={styles.fleetPlate}>{assetIdentity(asset)}</p>
        <p className={styles.fleetPlacement} title={placement}>{asset.holder ? <UserRound /> : <MapPin />}<span>{placement}</span></p>
        <div className={styles.fleetBottom}><FleetInspectionLights plate={assetPlate(asset)} now={now} /><Button variant="ghost" className="size-11 shrink-0 rounded-full p-0" aria-label={c.details} title={`${c.details}: ${asset.name}`} onClick={onOpen}><ArrowRight className="size-4" /></Button></div>
      </div>
    </article>;
  }
  return <article className="flex min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm sm:block">
    <DemoPhoto kind="asset" target={asset.id} alt={`${asset.name} · ${assetIdentity(asset)}`} className="h-auto w-24 shrink-0 border-r bg-muted/15 sm:h-32 sm:w-full sm:border-b sm:border-r-0"><WorkshopAssetArt id={asset.id} name={asset.name} category={asset.details?.category} animate={Boolean(activeJob(state, asset.id))} className="mx-auto h-full w-full max-w-[220px]" /></DemoPhoto>
    <div className="min-w-0 flex-1 p-4"><Status tone={value === "available" ? "green" : value === "issued" ? "blue" : "amber"}>{c[value === "inspection" ? "inspectionDue" : value]}</Status><h2 className="mt-2 break-words text-base font-semibold">{asset.name}</h2><p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">{assetIdentity(asset)}</p><div className="my-3 min-h-10 space-y-1 text-xs text-muted-foreground">{asset.holder && <p className="flex items-start gap-2"><UserRound className="size-3.5 shrink-0" /><span className="break-words">{asset.holder}</span></p>}<p className="flex items-start gap-2"><MapPin className="size-3.5 shrink-0" /><span className="break-words">{asset.placement?.siteName || (asset.holder ? c.issued : asset.location)}</span></p>{request && <p className="flex items-center gap-2 text-primary"><Clock3 className="size-3.5" />{c.pending}</p>}</div><Button variant="outline" className={`${action} w-full`} onClick={onOpen}>{c.details}<ArrowRight className="size-4" /></Button></div>
  </article>;
}
