'use client';
import {useCallback,useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Play,Square} from 'lucide-react';
import {getWorkshopPresenceAction,workInWorkshopAction} from '@/app/(workzone)/workzone/workshop-presence-actions';
import type {WorkshopPresence} from '@/lib/workzone/workshop-presence';
import {LiveWorkerNames} from '@/app/(workzone)/workzone/live-worker-names';
import {assetButton} from './shared';
import type {AssetCopy} from './copy';

export function WorkshopWorkPresence({c}:{c:AssetCopy}){
 const [data,setData]=useState<WorkshopPresence|null>(null),[error,setError]=useState(''),[pending,start]=useTransition();
 const epoch=useRef(0),router=useRouter();
 const invalidate=useCallback(()=>{epoch.current++;},[]);
 const load=useCallback(async()=>{const own=++epoch.current;try{const result=await getWorkshopPresenceAction();if(own!==epoch.current)return;if(result.ok){setData(result.data);setError('');}else{setData(null);setError(c.loadError);}}catch{if(own===epoch.current){setData(null);setError(c.loadError);}}},[c.loadError]);
 useEffect(()=>{let active=true;const refresh=()=>{if(document.visibilityState==='visible')void load();};queueMicrotask(()=>{if(active)void load();});const timer=setInterval(refresh,20000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{active=false;invalidate();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[load,invalidate]);
 const work=()=>start(async()=>{epoch.current++;try{const result=await workInWorkshopAction(data?.active?{stopSessionId:data.sessionId}:{});epoch.current++;if(result.ok){setData(result.data);setError('');router.refresh();}else{await load();setError(c.saveError);}}catch{await load();setError(c.saveError);}});
 return <div data-testid="workshop-presence" className={`flex min-w-0 flex-wrap items-center gap-2 ${data&&(data.canWork||data.names.length||data.active)?'rounded-xl border bg-card px-2 py-1':''}`}>
  {data?.canWork?<button type="button" disabled={pending} onClick={work} data-testid="workshop-work-here" className={`${assetButton} gap-1.5 px-3 text-xs ${data.active?'text-green-800 dark:text-green-200':''}`}>{data.active?<Square size={13}/>:<Play size={14}/>}<span>{data.active?c.stopWorking:c.workHere}</span></button>:null}
  {data?.active?<span className="text-xs font-medium text-green-700 dark:text-green-200">{c.workingHere}{data.paused?` · ${c.pausedShort}`:''}</span>:null}
  {data?.names.length?<LiveWorkerNames layer={1550} names={data.names} className="!w-auto max-w-[20rem] !text-xs"/>:null}
  {error?<span role="status" className="max-w-xs text-xs text-muted-foreground">{error}</span>:null}
 </div>;
}
