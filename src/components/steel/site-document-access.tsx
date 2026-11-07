'use client';
import { useCallback,useEffect,useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/i18n/language-provider';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { AssetFeedback,AssetLoading,assetButton,assetPrimary } from '@/components/company-assets/shared';
import { assetCopy } from '@/components/company-assets/copy';
import { siteAccessCopy } from '@/lib/site-phase-documents/access-copy';
import { getDocumentEngineerOptionsAction,getSiteDocumentAccessAction,setSiteDocumentAccessAction } from '@/app/(workzone)/workzone/site-access-actions';
type Engineer={id:string;name:string;eligible?:boolean};
function Choices({people,selected,onChange,disabled=false}:{people:Engineer[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean}){
 const {currentLang}=useLanguage(),c=siteAccessCopy(currentLang);
 return <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-semibold">{c.title}</legend><p className="mb-3 text-xs leading-relaxed text-muted-foreground">{c.hint}</p>{people.map(person=><label key={person.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"><input type="checkbox" name="documentEngineerId" value={person.id} checked={selected.includes(person.id)} onChange={e=>onChange(e.target.checked?[...selected,person.id]:selected.filter(id=>id!==person.id))} className="size-5 shrink-0 accent-orange-600"/><span className="min-w-0 break-words">{person.name}{person.eligible===false?<span className="mt-1 block text-xs text-amber-800 dark:text-amber-300">{c.inactive}</span>:null}</span></label>)}{!selected.length?<p className="text-xs text-muted-foreground">{c.empty}</p>:null}</fieldset>;
}
/** No grants are implied by opening the creation form; an empty selection is safe. */
export function SiteEngineerPicker({selected,onChange}:{selected:string[];onChange:(ids:string[])=>void}){
 const {currentLang}=useLanguage(),a=assetCopy(currentLang);
 const [people,setPeople]=useState<Engineer[]|null>(null),[allowed,setAllowed]=useState(false),[failed,setFailed]=useState(false);
 const load=useCallback(async()=>{try{const r=await getDocumentEngineerOptionsAction();if(r.ok){setAllowed(r.data.canManage);setPeople(r.data.engineers);setFailed(false);}else setFailed(true);}catch{setFailed(true);}},[]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void load();});return()=>{active=false;};},[load]);
 if(failed)return <button type="button" onClick={()=>void load()} className={assetButton}>{a.retry}</button>;
 if(!allowed||!people)return null;
 return <Choices people={people} selected={selected} onChange={onChange}/>;
}
export function SiteDocumentAccessButton({siteId}:{siteId:string}){
 const {currentLang}=useLanguage(),c=siteAccessCopy(currentLang),a=assetCopy(currentLang),[open,setOpen]=useState(false);
 return <><button type="button" className={assetButton} onClick={()=>setOpen(true)} data-testid="site-document-access-open"><ShieldCheck size={17}/>{c.access}</button><AssetWorkspaceDialog open={open} onOpenChange={setOpen} title={c.access} scrollBody compact>{open?<AccessEditor siteId={siteId} close={()=>setOpen(false)} closeLabel={a.close}/>:null}</AssetWorkspaceDialog></>;
}
function AccessEditor({siteId,close,closeLabel}:{siteId:string;close:()=>void;closeLabel:string}){
 const {currentLang}=useLanguage(),a=assetCopy(currentLang),router=useRouter();
 const [snapshot,setSnapshot]=useState<Awaited<ReturnType<typeof getSiteDocumentAccessAction>>|null>(null),[selected,setSelected]=useState<string[]>([]),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const r=await getSiteDocumentAccessAction(siteId);setSnapshot(r);if(r.ok)setSelected(r.data.engineers.filter(p=>p.selected).map(p=>p.id));else setMessage(r.message||a.loadError);}catch{setMessage(a.loadError);}},[siteId,a.loadError]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void load();});return()=>{active=false;};},[load]);
 async function save(){if(!snapshot?.ok||busy)return;setBusy(true);setMessage(null);try{const r=await setSiteDocumentAccessAction({siteId,workerIds:selected,revision:snapshot.data.revision});if(r.ok){router.refresh();close();}else setMessage(r.message||a.saveError);}catch{setMessage(a.saveError);}finally{setBusy(false);}}
 return <div className="space-y-4" data-testid="site-document-access"><AssetFeedback message={message} failed/>{snapshot?.ok?<><Choices people={snapshot.data.engineers} selected={selected} onChange={setSelected} disabled={busy}/><div className="flex gap-2"><button type="button" className={assetPrimary} disabled={busy||snapshot.data.engineers.some(p=>!p.eligible&&selected.includes(p.id))} onClick={()=>void save()}>{a.save}</button><button type="button" className={assetButton} disabled={busy} onClick={close}>{closeLabel}</button><button type="button" className={assetButton} disabled={busy} onClick={()=>void load()}>{a.refresh}</button></div></>:message?<button type="button" className={assetButton} onClick={()=>void load()}>{a.retry}</button>:<AssetLoading label={a.loading}/>}</div>;
}
