"use client";

import { useState } from 'react';
import { Check, ChevronDown, Shirt } from 'lucide-react';
import type { AssetCommand, AssetRef, ClothingHandoverBatchView } from '@/lib/company-assets/types';
import type { AssetCopy } from './copy';
import { HandoverCard } from './asset-detail-panel';
import { assetButton, assetPrimary, assetTime } from './shared';

export function ClothingHandoverBatch({batch,c,language,pending,onCommand,onOpen}:{
  batch:ClothingHandoverBatchView;c:AssetCopy;language:string;pending:boolean;
  onCommand:(command:AssetCommand)=>void;onOpen:(asset:AssetRef)=>void;
}){
  const [expanded,setExpanded]=useState(false);
  return <article data-testid="clothing-handover-batch" className="min-w-0 rounded-xl border bg-card p-3">
    <div className="flex min-w-0 items-start gap-2"><Shirt size={18} aria-hidden className="mt-1 shrink-0 text-orange-800 dark:text-orange-300"/><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{batch.name}</h3><p className="text-sm text-muted-foreground">{batch.size?`${c.size}: ${batch.size}`:c.noSize} · <span data-pending-count={batch.items.length} className="tabular-nums">{batch.items.length}/{batch.total}</span> {c.pieces}</p></div></div>
    <p className="mt-1 text-xs text-muted-foreground">{assetTime(batch.createdAt,language)}</p>
    <p className="mt-2 text-sm text-muted-foreground">{c.batchConfirmHint}</p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" data-testid="clothing-batch-confirm" className={`${assetPrimary} max-w-full whitespace-normal`} disabled={pending} onClick={()=>onCommand({type:'confirm-clothing-batch',batchId:batch.id,members:batch.items.map(({id,revision})=>({id,revision}))})}><Check size={18} aria-hidden className="shrink-0"/>{c.confirmAll} · {batch.items.length} {c.pieces}</button><button type="button" data-testid="clothing-batch-details" aria-expanded={expanded} aria-controls={`clothing-batch-${batch.id}`} className={assetButton} disabled={pending} onClick={()=>setExpanded(value=>!value)}>{expanded?c.fewerDetails:c.allDetails}<ChevronDown size={16} aria-hidden className={expanded?'rotate-180':''}/></button></div>
    <div id={`clothing-batch-${batch.id}`} hidden={!expanded}>{expanded?<div className="mt-3 grid min-w-0 gap-3">{batch.items.map(item=><HandoverCard key={item.id} item={item} c={c} language={language} pending={pending} onOpen={()=>onOpen(item.asset)} onCommand={(type,h)=>onCommand({type,handoverId:h.id,revision:h.revision})}/>)}</div>:null}</div>
  </article>;
}
