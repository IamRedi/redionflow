"use client";

import { useEffect, useState } from 'react';
import { Barcode, Package, Plus, Printer, ScanLine, Shirt, Wrench, X } from 'lucide-react';
import { ScanGatewayDialog } from '@/components/inventory/scan-gateway-dialog';
import { generateAssetLabelCode, normalizeScanCode } from '@/lib/inventory/scan-code';
import { assetLabelUrl } from './asset-codes';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AssetCategory, AssetRef } from '@/lib/company-assets/types';
import { assetCopy } from './copy';
import { AssetDetailDialog, HandoverCard } from './asset-detail-panel';
import { AssetLookup } from './asset-lookup';
import { AssetFeedback, AssetField, AssetLoading, AssetPicture, AssetSearch, AssetStatus, assetButton, assetIdentity, assetInput, assetPrimary, useAssetMutation, useAssetSnapshot } from './shared';
import { AccessKeyButton } from '@/components/access/access-key-button';

const categories = [{key:'tool',label:'tools',icon:Wrench},{key:'clothing',label:'clothing',icon:Shirt},{key:'equipment',label:'equipment',icon:Package}] as const;
export function AssetWarehouse({workerId,initialFactoryCode='',initialRegister=false}: {workerId?:string;initialFactoryCode?:string;initialRegister?:boolean}) {
  const {currentLang:language}=useLanguage();
  const c=assetCopy(language);
  const [category,setCategory]=useState<Exclude<AssetCategory,'vehicle'>>('tool');
  const [query,setQuery]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [inactive,setInactive]=useState(false);
  const [selected,setSelected]=useState<AssetRef|null>(null);
  const [register,setRegister]=useState(initialRegister||!!initialFactoryCode);
  const [factoryCode,setFactoryCode]=useState(initialFactoryCode);
  const [scanFactory,setScanFactory]=useState(false);
  const [name,setName]=useState('');
  const [size,setSize]=useState('');
  const [code,setCode]=useState('');
  const [barcode,setBarcode]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [note,setNote]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPage(1);},250);return()=>clearTimeout(timer);},[query]);
  const data=useAssetSnapshot({category,query:search,page,includeInactive:inactive,workerId},c);
  const mutation=useAssetMutation(c,data.reload);
  const filtering=query.trim()!==search;
  const snapshot=filtering?null:data.snapshot;
  const busy=mutation.pending||data.loading||filtering||!!data.error;
  const canManage=!!snapshot?.permissions.canManage;
  const canRegister=!!snapshot?.permissions.canRegister;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4" data-testid="asset-warehouse" aria-busy={data.loading||filtering}>
    <div className="flex flex-wrap items-center gap-3"><h1 className="min-w-0 flex-1 basis-full break-words text-xl font-semibold sm:basis-auto">{c.warehouse}</h1>{workerId?null:<AccessKeyButton place="warehouse"/>}<AssetLookup c={c} onSelect={setSelected} onRegister={workerId?undefined:value=>{setFactoryCode(value);setRegister(true);}}/>{canRegister&&!workerId?<button type="button" className={assetPrimary} disabled={busy} onClick={()=>setRegister(!register)}>{register?<X size={18}/>:<Plus size={18}/>}<span>{register?c.cancel:c.addAsset}</span></button>:null}</div>
    <div role="tablist" aria-label={c.warehouse} className="flex min-w-0 flex-wrap gap-2">{categories.map(({key,label,icon:Icon})=><button type="button" key={key} role="tab" aria-selected={category===key} aria-controls="warehouse-items" id={`asset-tab-${key}`} onClick={()=>{setCategory(key);setPage(1);setRegister(false);}} className={`${assetButton} flex-1 sm:flex-none ${category===key?'border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300':''}`}><Icon size={18} className="shrink-0"/><span>{c[label]}</span></button>)}</div>
    {register&&canRegister&&!workerId?<form className="grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async event=>{event.preventDefault();if(await mutation.run({type:'register',name:name.trim(),category,size:category==='clothing'?size.trim():undefined,quantity,code:quantity===1?code.trim()||undefined:undefined,barcode:quantity===1?barcode.trim()||undefined:undefined,factoryCode:normalizeScanCode(factoryCode)||undefined,note:note.trim()})){setRegister(false);setName('');setSize('');setCode('');setBarcode('');setFactoryCode('');setQuantity(1);setNote('');}}}>
      <AssetField label={c.name}><input autoFocus required value={name} onChange={event=>setName(event.target.value)} maxLength={120} className={assetInput} disabled={busy}/></AssetField>
      {category==='clothing'?<AssetField label={c.size}><input required value={size} onChange={event=>setSize(event.target.value)} maxLength={40} className={assetInput} disabled={busy}/></AssetField>:null}
      <AssetField label={c.quantity}><input required type="number" min={1} max={100} step={1} value={quantity} onChange={event=>setQuantity(Number(event.target.value))} className={assetInput} disabled={busy}/></AssetField>
      <div className="min-w-0"><AssetField label={c.factoryCode}><input value={factoryCode} onChange={event=>setFactoryCode(event.target.value)} maxLength={2048} className={assetInput} disabled={busy}/></AssetField><button type="button" aria-label={`${c.scan} · ${c.factoryCode}`} className={`${assetButton} mt-2`} disabled={busy} onClick={()=>setScanFactory(true)}><ScanLine size={16}/>{c.scan}</button></div>
      {quantity===1?<><AssetField label={c.code}><input value={code} onChange={event=>setCode(event.target.value)} maxLength={80} className={assetInput} disabled={busy}/></AssetField><div><AssetField label={c.unitCode}><input value={barcode} onChange={event=>setBarcode(event.target.value)} maxLength={80} className={assetInput} disabled={busy}/></AssetField><button type="button" className={`${assetButton} mt-2`} disabled={busy} onClick={()=>setBarcode(generateAssetLabelCode())}><Barcode size={16}/>{c.generateCode}</button></div></>:null}
      <AssetField label={c.note}><input value={note} onChange={event=>setNote(event.target.value)} maxLength={2000} className={assetInput} disabled={busy}/></AssetField><p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">{c.individual}</p><div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button className={assetPrimary} disabled={busy||!name.trim()||!Number.isInteger(quantity)||quantity<1||quantity>100||(category==='clothing'&&!size.trim())}>{c.add}</button><button type="button" className={assetButton} disabled={busy} onClick={()=>setRegister(false)}>{c.cancel}</button></div>
    </form>:null}
    <AssetFeedback message={mutation.message} failed={mutation.failed}/>
    {mutation.result&&typeof mutation.result==='object'&&'assets' in mutation.result&&Array.isArray(mutation.result.assets)?<a className={`${assetButton} self-start`} href={assetLabelUrl(mutation.result.assets as AssetRef[])} target="_blank" rel="noopener"><Printer size={18}/>{c.printLabels}</a>:null}
    {snapshot?.queueHasMore&&(snapshot.queueHasMore.handovers||snapshot.queueHasMore.incidents)?<p role="status" className="text-sm text-muted-foreground">{c.queueLimit}</p>:null}
    {snapshot?.handovers.some(item=>item.canConfirm||item.canCancel)?<details open className="min-w-0 rounded-2xl border bg-card/50 p-3"><summary className="min-h-11 cursor-pointer font-semibold">{c.handovers} · {c.pending}</summary><div className="grid gap-3 lg:grid-cols-2">{snapshot.handovers.filter(item=>item.canConfirm||item.canCancel).map(item=><HandoverCard key={item.id} item={item} c={c} language={language} pending={busy} onOpen={()=>setSelected(item.asset)} onCommand={(type,h)=>void mutation.run({type,handoverId:h.id,revision:h.revision})}/>)}</div></details>:null}
    {canManage&&snapshot?.incidents.some(item=>item.status==='pending'&&item.kind!=='defect')?<details className="rounded-2xl border bg-card/50 p-3"><summary className="min-h-11 cursor-pointer font-semibold">{c.reports} · {c.pending}</summary><ul className="divide-y">{snapshot.incidents.filter(item=>item.status==='pending'&&item.kind!=='defect').map(item=><li key={item.id}><button type="button" onClick={()=>setSelected(item.asset)} className="flex min-h-14 w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="min-w-0 break-words font-medium">{item.name}</span><span className="text-sm text-orange-800 dark:text-orange-300">{item.kind==='lost'?c.reportLost:c.reportRetire}</span></button></li>)}</ul></details>:null}
    <div className="flex flex-wrap items-center gap-3"><AssetSearch value={query} onChange={setQuery} label={c.search}/><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={inactive} onChange={event=>{setInactive(event.target.checked);setPage(1);}} className="size-5 accent-orange-600"/>{c.showInactive}</label></div>
    <section role="tabpanel" id="warehouse-items" aria-labelledby={`asset-tab-${category}`} aria-busy={data.loading||filtering} className="min-w-0">
      {data.error?<div className="space-y-3"><AssetFeedback message={data.error} failed/><button type="button" className={assetButton} onClick={()=>void data.reload()}>{c.retry}</button></div>:null}
      {(data.loading||filtering)&&!snapshot?<AssetLoading label={c.loading}/>:null}
      {snapshot?<><div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{snapshot.assets.map(asset=><button type="button" key={asset.key} onClick={()=>setSelected(asset)} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left transition hover:border-orange-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="block aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-950"><AssetPicture asset={asset}/></span><span className="flex min-w-0 flex-1 flex-col items-start gap-2 p-3"><span className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{asset.name}</span><span className="break-words font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{assetIdentity(asset)||'—'}</span><AssetStatus value={asset.availability} c={c}/>{asset.holder?<span className="break-words text-xs text-muted-foreground">{asset.holder.name}</span>:null}</span></button>)}</div>{!snapshot.assets.length?<p role="status" className="py-8 text-center text-sm text-muted-foreground">{c.empty}</p>:null}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm tabular-nums text-muted-foreground">{snapshot.total} · {c[category==='tool'?'tools':category==='clothing'?'clothing':'equipment']}</p><div className="flex gap-2"><button type="button" disabled={page<=1||data.loading} className={assetButton} onClick={()=>setPage(value=>value-1)}>{c.previous}</button><button type="button" disabled={!snapshot.hasMore||data.loading} className={assetButton} onClick={()=>setPage(value=>value+1)}>{c.next}</button></div></div></>:null}
    </section>
    <AssetDetailDialog asset={selected} onClose={()=>{setSelected(null);void data.reload();}}/>
    <ScanGatewayDialog open={scanFactory} title={c.factoryCode} value={factoryCode} onDetected={setFactoryCode} normalizeValue={normalizeScanCode} onCancel={()=>setScanFactory(false)} onConfirm={()=>setScanFactory(false)} confirmLabel={c.add}/>
  </div>;
}
