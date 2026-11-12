"use client";
import {ChevronRight,Shirt} from 'lucide-react';
import type {AssetRef,AssetSummary,ClothingGroup,ClothingGroupFilter} from '@/lib/company-assets/types';
import type {AssetCopy} from './copy';
import {AssetStatus} from './shared';

export function ClothingGroups({groups,c,onOpen}:{groups:ClothingGroup[];c:AssetCopy;onOpen:(group:ClothingGroupFilter)=>void}){
 return <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">{groups.map(group=><button key={group.key} type="button" data-testid="clothing-group" onClick={()=>onOpen({name:group.name,size:group.size})} className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-orange-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
  <span className="flex w-full min-w-0 items-start gap-2"><Shirt size={20} className="mt-0.5 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden="true"/><span className="min-w-0 flex-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{group.name}</span><ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true"/></span>
  <span className="break-words text-xs text-muted-foreground">{group.size?`${c.size}: ${group.size}`:c.noSize}</span>
  <span className="mt-auto grid w-full gap-1.5 text-sm tabular-nums">
   <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2"><span className="text-muted-foreground">{c.reserve}</span><strong data-testid="clothing-reserve">{group.reserve}</strong></span>
   <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2"><span className="text-muted-foreground">{c.withWorkers}</span><strong data-testid="clothing-assigned">{group.assigned}</strong></span>
   {group.other>0?<span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 text-muted-foreground"><span>{c.otherState}</span><strong>{group.other}</strong></span>:null}
  </span>
 </button>)}</div>;
}

/** Exact units remain available for the existing custody, scan and history flows. */
export function ClothingUnits({assets,c,onOpen}:{assets:AssetSummary[];c:AssetCopy;onOpen:(asset:AssetRef)=>void}){
 return <ul className="min-w-0 divide-y overflow-hidden rounded-2xl border bg-card">{assets.map(asset=><li key={asset.key}><button type="button" data-testid="clothing-unit" onClick={()=>onOpen(asset)} className="flex min-h-14 w-full min-w-0 flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
  <span className="min-w-0 flex-1 basis-40"><span className="block break-words text-sm font-medium">{asset.holder?.name||asset.name}</span>{asset.site?<span className="block break-words text-xs text-muted-foreground">{asset.site.name}</span>:null}</span><AssetStatus value={asset.availability} c={c}/><ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground"/>
 </button></li>)}</ul>;
}
