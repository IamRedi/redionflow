"use client";

import Image from "next/image";
import { useLanguage } from "@/components/i18n/language-provider";
import type { WorkshopAsset } from "@/lib/workshop/demo-model";
import { equipmentCatalogueId } from "@/lib/workshop/studio-media";
import { assetArtKind } from "@/lib/workshop/identity-art";
import { studioCopy } from "@/lib/workshop/studio-copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { WorkshopAssetArt } from "./workshop-art";
import { StudioArt } from "./studio-art";

/** The asset identity follows a job. Reference artwork never becomes repair evidence. */
export function EquipmentReference({ asset, jobId, className = "" }: { asset: WorkshopAsset; jobId?: string; className?: string }) {
  const { photos, illustrations } = useWorkshopDemo(), { currentLang } = useLanguage(), s = studioCopy(currentLang);
  const photo = photos.find(p=>p.kind === "asset" && p.target === asset.id && p.jobId === jobId) ?? photos.find(p=>p.kind === "asset" && p.target === asset.id && !p.jobId);
  const ai = illustrations?.find(i=>i.assetId === asset.id && i.status === "ready");
  const catalogue = equipmentCatalogueId(assetArtKind(asset.id,asset.name,asset.details?.category));
  if (photo || ai) return <div className={`relative overflow-hidden rounded-xl ${className}`}><Image src={photo?.url || ai!.url!} alt={`${asset.name}${photo ? "" : ` · ${s.generated}`}`} fill unoptimized sizes="160px" className={photo ? "object-cover" : "bg-[#f5f3ed] object-contain"} />{!photo && <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">{s.aiBadge}</span>}</div>;
  const sketch = <WorkshopAssetArt id={asset.id} name={asset.name} category={asset.details?.category} className={className} />;
  return catalogue ? <StudioArt id={catalogue} className={className}>{sketch}</StudioArt> : sketch;
}
