"use client";
import Image from "next/image";
import Link from "next/link";
import { AppBrand } from "@/components/branding/AppBrand";
import { DEMO_BRAND_TARGET, mediaPreference, mediaVisible, orderMedia } from "@/lib/workshop/media";
import { useWorkshopDemo } from "./use-workshop-demo";

export function DemoBrand({alt}:{alt:string}) {
  const {photos,illustrations,mediaPreferences}=useWorkshopDemo(),preference=mediaPreference(mediaPreferences,{kind:"asset",target:DEMO_BRAND_TARGET});
  const photo=orderMedia(photos.filter(p=>p.kind==="asset"&&p.target===DEMO_BRAND_TARGET&&!p.jobId),preference)[0];
  const illustration=illustrations?.find(i=>i.assetId===DEMO_BRAND_TARGET&&i.status==="ready"&&mediaVisible(preference,`generated:${i.id}`));
  const url=preference?.cover===`generated:${illustration?.id}`?illustration?.url:photo?.url??illustration?.url;
  return <Link href="/demo/workzone" aria-label="BaumdienstFlow · Workzone" className="absolute left-0 top-1/2 z-20 block shrink-0 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{url?<span className="relative block size-14 overflow-hidden rounded-full bg-transparent"><Image src={url} alt={alt} fill unoptimized sizes="56px" className="rounded-full object-cover"/></span>:<AppBrand compact mode="baumdienst" logoAlt={alt} className="[&_img]:!size-14 [&_span]:!size-14"/>}</Link>;
}
