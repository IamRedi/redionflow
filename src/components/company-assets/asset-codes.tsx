"use client";
import { useState } from 'react';
import { Barcode, Plus, Printer, ScanLine, Trash2 } from 'lucide-react';
import { ScanGatewayDialog } from '@/components/inventory/scan-gateway-dialog';
import { normalizeScanCode, validScanCode } from '@/lib/inventory/scan-code';
import type { AssetCommand, AssetDetail, AssetRef } from '@/lib/company-assets/types';
import { assetButton, assetInput } from './shared';
import type { AssetCopy } from './copy';
export function assetLabelUrl(refs:AssetRef[]){return `/workzone/asset-labels?items=${encodeURIComponent(refs.map(r=>`${r.kind}:${r.id}`).join(','))}`;}
export function AssetCodes({detail,c,pending,run}:{detail:AssetDetail;c:AssetCopy;pending:boolean;run:(command:AssetCommand)=>Promise<boolean>}){
  const [value,setValue]=useState(''),[scan,setScan]=useState(false);
  const ref={kind:detail.asset.kind,id:detail.asset.id},canManage=detail.permissions.canManage;
  const label=detail.codes.find(code=>code.kind==='label')?.value||(detail.asset.code?.startsWith('AS-')&&detail.asset.code.length<=24?detail.asset.code:null);
  return <details className="min-w-0 rounded-xl border p-3" data-testid="asset-codes"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold"><Barcode size={18}/>{c.codes}</summary>
    <div className="space-y-3 pt-2"><p className="text-xs text-muted-foreground">{c.codeHint}</p>
      {detail.asset.code?<p className="break-all font-mono text-sm">{c.unitCode}: {detail.asset.code}</p>:null}
      <ul className="divide-y">{detail.codes.map(code=><li key={code.id} className="flex min-w-0 items-center gap-2 py-1"><span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{code.kind==='factory'?c.factoryCode:c.unitCode}</span><span className="break-all font-mono text-sm">{code.value}</span></span>{canManage&&code.kind==='factory'?<button type="button" disabled={pending} className={assetButton} aria-label={`${c.removeCode}: ${code.value}`} onClick={()=>void run({type:'code-remove',asset:ref,codeId:code.id})}><Trash2 size={16}/></button>:null}</li>)}</ul>
      {canManage?<><form className="flex min-w-0 flex-wrap gap-2" onSubmit={async e=>{e.preventDefault();if(await run({type:'code-add',asset:ref,value:normalizeScanCode(value)}))setValue('');}}><input aria-label={c.factoryCode} placeholder={c.factoryCode} maxLength={2048} value={value} onChange={e=>setValue(e.target.value)} className={`${assetInput} flex-1 basis-48`} disabled={pending}/><button type="button" aria-label={c.scan} onClick={()=>setScan(true)} className={assetButton} disabled={pending}><ScanLine size={18}/></button><button className={assetButton} disabled={pending||!validScanCode(normalizeScanCode(value))}><Plus size={18}/>{c.add}</button></form>
      <div className="flex flex-wrap gap-2">{label?<a className={assetButton} href={assetLabelUrl([ref])} target="_blank" rel="noopener"><Printer size={18}/>{c.printLabels}</a>:<button type="button" disabled={pending} className={assetButton} onClick={()=>void run({type:'code-generate',asset:ref})}><Barcode size={18}/>{c.generateCode}</button>}</div></>:null}
    </div><ScanGatewayDialog open={scan} title={c.factoryCode} value={value} onDetected={setValue} normalizeValue={normalizeScanCode} onCancel={()=>setScan(false)} onConfirm={()=>setScan(false)} confirmLabel={c.add} confirmDisabled={!validScanCode(normalizeScanCode(value))}/>
  </details>;
}
