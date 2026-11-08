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
import { mediaPreference, mediaVisible, orderMedia } from "@/lib/workshop/media";

/** The asset identity follows a job. Reference artwork never becomes repair evidence. */
export function EquipmentReference({ asset, jobId, className = "" }: { asset: WorkshopAsset; jobId?: string; className?: string }) {
  const { photos, illustrations, mediaPreferences } = useWorkshopDemo(), { currentLang } = useLanguage(), s = studioCopy(currentLang);
  const preference=mediaPreference(mediaPreferences,{kind:"asset",target:asset.id}),jobPreference=mediaPreference(mediaPreferences,{kind:"asset",target:asset.id,jobId});
  const photo = (jobId?orderMedia(photos.filter(p=>p.kind==="asset"&&p.target===asset.id&&p.jobId===jobId),jobPreference)[0]:undefined) ?? orderMedia(photos.filter(p=>p.kind === "asset" && p.target === asset.id && !p.jobId),preference)[0];
  const ai = illustrations?.find(i=>i.assetId === asset.id && i.status === "ready"&&mediaVisible(preference,`generated:${i.id}`));
  const catalogue = equipmentCatalogueId(assetArtKind(asset.id,asset.name,asset.details?.category));
  const selectedGenerated=ai&&preference?.cover===`generated:${ai.id}`;
  const selectedCatalogue=catalogue&&preference?.cover==="catalogue"&&mediaVisible(preference,"catalogue");
  if(!selectedCatalogue&&(photo||ai)) return <div className={`relative overflow-hidden rounded-xl bg-[#0c2b35] ${className}`}><Image src={(!selectedGenerated&&photo?.url)||ai!.url!} alt={`${asset.name}${photo&&!selectedGenerated?"":` · ${s.generated}`}`} fill unoptimized sizes="160px" className={photo&&!selectedGenerated?"object-cover":"object-contain"}/></div>;
  const sketch = <WorkshopAssetArt id={asset.id} name={asset.name} category={asset.details?.category} className={className} />;
  return catalogue&&mediaVisible(preference,"catalogue") ? <StudioArt id={catalogue} className={className}>{sketch}</StudioArt> : sketch;
}
