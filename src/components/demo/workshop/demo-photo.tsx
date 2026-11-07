"use client";
import Image from "next/image";
import { Camera, Check, Download, ImagePlus, LoaderCircle, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { photoCopy } from "@/lib/asset-photos/shared";
import { canUploadDemoFile } from "@/lib/workshop/inventory-flow";
import { workshopCopy } from "@/lib/workshop/copy";
import { studioCopy } from "@/lib/workshop/studio-copy";
import { mediaCopy } from "@/lib/workshop/media-copy";
import { DEMO_BRAND_TARGET, mediaPreference, orderMedia, type MediaCommand } from "@/lib/workshop/media";
import { equipmentCatalogueId, studioMediaUrl } from "@/lib/workshop/studio-media";
import { assetArtKind } from "@/lib/workshop/identity-art";
import { useWorkshopDemo } from "./use-workshop-demo";
import { WorkshopDialog } from "./workshop-ui";

type Picture={id:string;url:string;name:string;at?:string;original?:boolean};
/** Explicit Musterfirma adapter. Originals and generated provenance stay in the gallery. */
export function DemoPhoto({kind,target,photoKey,jobId,alt,children,className="",readOnly=false,triggerOnly=false}:{kind:"asset"|"site";target:string;photoKey?:string;jobId?:string;alt:string;children?:ReactNode;className?:string;readOnly?:boolean;triggerOnly?:boolean}) {
  const {currentLang}=useLanguage(),c=workshopCopy(currentLang),p=photoCopy(currentLang),s=studioCopy(currentLang),m=mediaCopy(currentLang);
  const demo=useWorkshopDemo(),{photos,state,actor,pending,status,illustrations,imageGenerationEnabled,generating,imageErrors}=demo;
  const [open,setOpen]=useState(false),[message,setMessage]=useState("");
  const camera=useRef<HTMLInputElement>(null),file=useRef<HTMLInputElement>(null);
  const storedTarget=photoKey??target,scope={kind,target:storedTarget,...(jobId?{jobId}:{})},brand=target===DEMO_BRAND_TARGET;
  const preference=mediaPreference(demo.mediaPreferences,scope);
  const uploaded=photos.filter(photo=>photo.kind===kind&&photo.target===storedTarget&&photo.jobId===jobId);
  const illustration=!jobId?illustrations?.find(i=>i.assetId===(kind==="site"?`site-cover:${storedTarget}`:target)):undefined;
  const asset=kind==="asset"?state.assets.find(a=>a.id===target):undefined;
  const catalogue=!jobId&&!brand?(kind==="site"?"card-worksite":asset?equipmentCatalogueId(assetArtKind(asset.id,asset.name,asset.details?.category)):undefined):undefined;
  const items:Picture[]=[...uploaded.map(photo=>({...photo,original:true})),...(illustration?.status==="ready"&&illustration.url?[{id:`generated:${illustration.id}`,url:illustration.url,name:m.generated,at:illustration.at}]:[]),...(catalogue?[{id:"catalogue",url:studioMediaUrl(catalogue),name:m.catalogue}]:[])];
  const visible=orderMedia(items,preference),removed=items.filter(i=>preference?.hidden.includes(i.id)),current=visible[0];
  const imageTarget=kind==="site"?storedTarget:target,working=generating.includes(imageTarget)||illustration?.status==="pending";
  const canUpload=!readOnly&&canUploadDemoFile(state,actor,kind,target,jobId),canManage=!readOnly&&actor.role==="admin";
  const error=imageErrors[imageTarget]||illustration?.error;
  const errorText=(key:string)=>key in s?s[key as keyof typeof s]:key in c?c[key as keyof typeof c]:c.error;
  async function choose(selected?:File) {
    if(!selected||!canUpload)return;setMessage("");
    try{if(!selected.size||selected.size>12_000_000||!["image/jpeg","image/png","image/webp"].includes(selected.type))throw new Error("fileError");await demo.upload(selected,{kind,target,...(jobId?{jobId}:{})});setMessage(c.saved);}
    catch(error){setMessage(errorText(error instanceof Error?error.message:"fileError"));}
    finally{if(camera.current)camera.current.value="";if(file.current)file.current.value="";}
  }
  async function manage(action:MediaCommand["action"],mediaId:string){setMessage("");try{await demo.manageMedia({...scope,action,mediaId});setMessage(m.saved);}catch(error){setMessage(errorText(error instanceof Error?error.message:"error"));}}
  return <div className={`relative ${className}`} data-testid={`demo-photo-${kind}-${target}`}>
    {!triggerOnly&&(current?<Image src={current.url} alt={alt} fill unoptimized sizes="(max-width:640px) 100vw, 520px" className={current.original||kind==="site"?"object-cover":"bg-[#0c2b35] object-contain"}/>:children)}
    {working&&!current&&<span role="status" aria-label={s.generating} className="absolute left-2 top-2 rounded-full bg-black/70 p-2 text-white"><LoaderCircle className="size-4 motion-safe:animate-spin"/></span>}
    <button type="button" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true);}} className={`${triggerOnly?"inline-flex":"absolute bottom-1.5 right-1.5 inline-flex"} min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-black/70 px-3 text-xs font-semibold text-white backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-label={`${c.photos}: ${alt}`}><Camera className="size-4" aria-hidden="true"/>{uploaded.length>0&&!triggerOnly&&<span>{visible.filter(i=>i.original).length}</span>}</button>
    <WorkshopDialog open={open} onClose={()=>setOpen(false)} closeLabel={c.close} title={`${c.photos} · ${alt}`} description={readOnly?undefined:m.hint}>
      <div className="space-y-4">
        {!readOnly&&<><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={!canUpload||pending||status!=="ready"} onClick={()=>camera.current?.click()}><Camera/>{p.camera}</Button><Button variant="outline" className="min-h-11" disabled={!canUpload||pending||status!=="ready"} onClick={()=>file.current?.click()}><ImagePlus/>{p.upload}</Button>
          {canManage&&!jobId&&<Button variant="outline" className="min-h-11" disabled={!imageGenerationEnabled||working||pending||status!=="ready"||visible.some(i=>i.original)||Boolean(illustration?.status==="ready"&&!illustration.legacy)} onClick={()=>void demo.generateImage(imageTarget,kind==="site"?"site":brand?"brand":"asset").catch(()=>{})}>{working?<LoaderCircle className="motion-safe:animate-spin"/>:<Sparkles/>}{working?s.generating:m.generate}</Button>}</div>
          <input ref={camera} data-photo-input="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e=>void choose(e.target.files?.[0])}/><input ref={file} data-photo-input="upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>void choose(e.target.files?.[0])}/>
          {canManage&&!jobId&&<p className="text-xs leading-relaxed text-muted-foreground">{m.quota}</p>}
        </>}
        {message&&<p role="status" className="rounded-xl border bg-muted/20 p-3 text-sm">{message}</p>}
        {error&&!readOnly&&<p role="alert" className="text-sm">{errorText(error)}</p>}
        {!imageGenerationEnabled&&canManage&&!jobId&&<p className="text-xs text-muted-foreground">{s.aiUnavailable}</p>}
        {visible.length?<div className="grid gap-3 sm:grid-cols-2">{visible.map(picture=><figure key={picture.id} className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <a href={picture.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.photos}: ${picture.name}`} className="block focus-visible:ring-2 focus-visible:ring-ring"><Image src={picture.url} alt={alt} width={1024} height={768} unoptimized className={`aspect-[4/3] w-full bg-[#0c2b35] ${picture.original?"object-cover":"object-contain"}`}/></a>
          <figcaption className="space-y-2 break-words p-3 text-xs text-muted-foreground"><p>{picture.name}</p>{picture.at&&<time className="block" dateTime={picture.at}>{new Date(picture.at).toLocaleString(currentLang,{timeZone:"Europe/Berlin"})}</time>}
            <div className="flex flex-wrap gap-2"><a href={picture.url} download={picture.name} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-primary focus-visible:ring-2 focus-visible:ring-ring"><Download className="size-4"/>{c.download}</a>
            {canManage&&<><Button variant="outline" className="min-h-11 text-xs" disabled={pending||current?.id===picture.id} onClick={()=>void manage("cover",picture.id)}><Check className="size-4"/>{current?.id===picture.id?m.current:m.cover}</Button><Button variant="outline" className="min-h-11 text-xs" disabled={pending} onClick={()=>void manage("remove",picture.id)}><Trash2 className="size-4"/>{m.remove}</Button></>}</div>
            {!picture.original&&<p>{s.reference}</p>}
          </figcaption></figure>)}</div>:<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><Camera className="mx-auto mb-3 size-8 opacity-50"/>{c.noPhotos}</div>}
        {canManage&&removed.length>0&&<details className="rounded-xl border px-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><RotateCcw className="size-4"/>{m.removed} · {removed.length}</summary><div className="space-y-2 pb-3">{removed.map(picture=><div key={picture.id} className="flex items-center gap-3 rounded-lg border p-2"><Image src={picture.url} alt="" width={64} height={64} unoptimized className="size-14 rounded-lg bg-[#0c2b35] object-contain"/><span className="min-w-0 flex-1 break-words text-xs">{picture.name}</span><Button variant="outline" className="min-h-11" disabled={pending} onClick={()=>void manage("restore",picture.id)}><RotateCcw className="size-4"/>{m.restore}</Button></div>)}</div></details>}
      </div>
    </WorkshopDialog>
  </div>;
}
