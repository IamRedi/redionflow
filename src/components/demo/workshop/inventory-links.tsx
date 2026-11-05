"use client";
import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import type { InventoryPlacement } from "@/lib/workshop/demo-model";
import type { WorkshopDirectory } from "@/lib/workshop/shared-contract";
import { inventoryCopy } from "@/lib/workshop/inventory-copy";
import { control, Field } from "./workshop-ui";

export function InventoryPlacementLinks({ placement, directory }: { placement?: InventoryPlacement; directory: WorkshopDirectory }) {
  if (!placement) return null;
  const site = directory.sites.find(s => s.key === placement.siteKey), worker = directory.workers.find(w => w.key === placement.workerKey);
  const cls = "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-sm text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  return <div className="flex flex-col items-start">
    {placement.siteName && (site ? <Link className={cls} href={`/demo/baustellen/${site.id}`}><MapPin className="size-4 shrink-0" /><span className="break-words">{placement.siteName}</span></Link> : <span className="text-sm">{placement.siteName}</span>)}
    {placement.workerName && (worker ? <Link className={cls} href={`/demo/workers/${worker.id}`}><UserRound className="size-4 shrink-0" /><span className="break-words">{placement.workerName}</span></Link> : <span className="text-sm">{placement.workerName}</span>)}
  </div>;
}
export function InventoryAssignmentFields({ directory, placement, siteKey, workerKey, lang }: { directory: WorkshopDirectory; placement?: InventoryPlacement; siteKey?: string; workerKey?: string; lang: string }) {
  const c = inventoryCopy(lang);
  return <><p className="text-sm text-muted-foreground">{c.assignHint}</p><Field label={c.worker}><select className={control} name="workerKey" defaultValue={placement?.workerKey ?? workerKey ?? ""}><option value="">{c.select}</option>{directory.workers.map(w => <option key={w.key} value={w.key} disabled={!w.available}>{w.name}{!w.available ? ` · ${c.notAvailable}` : ""}</option>)}</select></Field><Field label={c.site}><select className={control} name="siteKey" defaultValue={placement?.siteKey ?? siteKey ?? ""}><option value="">{c.select}</option>{directory.sites.filter(s => s.active).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></Field></>;
}
