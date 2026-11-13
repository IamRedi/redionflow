"use client";
import Image from "next/image";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { mediaCopy } from "@/lib/workshop/media-copy";
import { workshopCopy } from "@/lib/workshop/copy";
import { mediaPreference, orderMedia, type MediaCommand, type MediaTarget } from "@/lib/workshop/media";
import type { WorkDefinition } from "@/lib/workshop/wood-model";
import { useWorkshopDemo } from "./use-workshop-demo";
import type { WoodController } from "./use-wood";
import { woodArtUrl } from "./wood-art";

export function WoodMediaActions({controller,scope,phase}:{controller:WoodController;scope:MediaTarget;phase?:WorkDefinition}) {
  const {currentLang}=useLanguage(),m=mediaCopy(currentLang),c=workshopCopy(currentLang),demo=useWorkshopDemo(),[error,setError]=useState("");
  const s=controller.snapshot;if(!s||demo.actor.role!=="admin")return null;
  const preference=mediaPreference(demo.mediaPreferences,scope),illustration=s.illustrations.find(i=>i.target===scope.target&&i.status==="ready");
  const items=[...s.media.filter(p=>p.kind===scope.kind&&p.target===scope.target),...(illustration?.url?[{id:`generated:${illustration.id}`,url:illustration.url,name:m.generated}]:[]),...(phase?.art?[{id:"catalogue",url:woodArtUrl(phase.art),name:m.catalogue}]:[])];
  const visible=orderMedia(items,preference),removed=items.filter(i=>preference?.hidden.includes(i.id));
  const unavailable=demo.pending||!demo.hydrated||demo.status!=="ready";
  async function change(action:MediaCommand["action"],mediaId:string){setError("");try{await demo.manageMedia({...scope,action,mediaId});await controller.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"error");}}
  const row=(item:typeof items[number],hidden=false)=><div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-2"><Image src={item.url} alt="" width={64} height={64} unoptimized className="size-14 rounded-lg bg-[#0c2b35] object-contain"/><span className="min-w-0 flex-1 break-words text-xs text-muted-foreground">{item.name}</span>{hidden?<Button variant="outline" className="min-h-11 text-xs" disabled={unavailable} onClick={()=>void change("restore",item.id)}><RotateCcw className="size-4"/>{m.restore}</Button>:<><Button variant="outline" className="min-h-11 text-xs" disabled={unavailable||visible[0]?.id===item.id} onClick={()=>void change("cover",item.id)}><Check className="size-4"/>{visible[0]?.id===item.id?m.current:m.cover}</Button><Button variant="outline" className="min-h-11 text-xs" disabled={unavailable} onClick={()=>void change("remove",item.id)}><Trash2 className="size-4"/>{m.remove}</Button></>}</div>;
  return <div className="space-y-2">{visible.map(i=>row(i))}{removed.length>0&&<details className="rounded-xl border px-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><RotateCcw className="size-4"/>{m.removed} · {removed.length}</summary><div className="space-y-2 pb-3">{removed.map(i=>row(i,true))}</div></details>}{error&&<p role="alert" className="text-sm">{error in c?c[error as keyof typeof c]:c.error}</p>}</div>;
}
