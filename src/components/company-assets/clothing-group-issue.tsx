"use client";
import {useState} from 'react';
import {Plus} from 'lucide-react';
import type {AssetPerson,ClothingGroupFilter} from '@/lib/company-assets/types';
import type {AssetCopy} from './copy';
import {AssetField,assetButton,assetInput,assetPrimary} from './shared';

export function ClothingGroupIssue({group,available,workers,c,pending,onIssue}:{group:ClothingGroupFilter;available:number;workers:AssetPerson[];c:AssetCopy;pending:boolean;onIssue:(workerId:string,quantity:number,note:string)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[worker,setWorker]=useState(''),[quantity,setQuantity]=useState(1),[note,setNote]=useState(''),[requested,setRequested]=useState<number|null>(null);
 const max=Math.min(100,available);
 return <div className="min-w-0 space-y-2" data-testid="clothing-group-issue">
  {requested!==null?<p role="status" className="text-sm">{requested} {c.groupIssuePending}</p>:null}
  {!open?<button type="button" data-testid="clothing-group-issue-open" className={assetPrimary} disabled={pending||max<1} onClick={()=>{setOpen(true);setRequested(null);}}><Plus size={18}/>{c.issueClothing}</button>:<form data-testid="clothing-group-issue-form" aria-label={`${c.issueClothing} · ${group.name}`} className="grid min-w-0 gap-3 rounded-2xl border bg-card/50 p-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async event=>{event.preventDefault();if(pending||!worker||!Number.isInteger(quantity)||quantity<1||quantity>max)return;const requestedQuantity=quantity;if(await onIssue(worker,requestedQuantity,note.trim())){setRequested(requestedQuantity);setOpen(false);setQuantity(1);setWorker('');setNote('');}}}>
   <AssetField label={c.worker}><select required value={worker} onChange={event=>setWorker(event.target.value)} className={assetInput} disabled={pending}><option value="">—</option>{workers.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></AssetField>
   <AssetField label={`${c.quantity}`}><input required type="number" min={1} max={max} step={1} value={quantity} onChange={event=>setQuantity(Number(event.target.value))} className={assetInput} disabled={pending}/></AssetField>
   <AssetField label={c.note}><input value={note} onChange={event=>setNote(event.target.value)} maxLength={2000} className={assetInput} disabled={pending}/></AssetField>
   <p className="text-sm tabular-nums sm:col-span-2 lg:col-span-3">{c.reserve}: {available} {c.pieces}</p><p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">{c.groupIssueHint}</p>
   <div className="flex min-w-0 flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button type="submit" className={assetPrimary} disabled={pending||!worker||!Number.isInteger(quantity)||quantity<1||quantity>max}>{c.requestGroupIssue}</button><button type="button" className={assetButton} disabled={pending} onClick={()=>setOpen(false)}>{c.cancel}</button></div>
  </form>}
 </div>;
}
