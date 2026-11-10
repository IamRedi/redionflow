"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, ExternalLink, FolderCheck, Plus, RotateCw, Send, Trash2, Upload } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import { AssetWorkspaceDialog } from '@/components/company-assets/workspace-dialog';
import { assetCopy } from '@/components/company-assets/copy';
import { AssetFeedback, AssetField, AssetLoading, assetButton, assetInput, assetPrimary } from '@/components/company-assets/shared';
import { deletePhaseDocumentAction, getPhaseDocumentsAction, phaseDocumentAction, uploadPhaseDocumentAction } from '@/app/(workzone)/workzone/phase-document-actions';
import { DOCUMENT_PHASES, type DocumentPhase, type PhaseDocumentSnapshot, type PhaseDocumentView } from '@/lib/site-phase-documents/types';
import { phaseDocumentCopy } from '@/lib/site-phase-documents/copy';
import { siteAccessCopy } from '@/lib/site-phase-documents/access-copy';

export function PhaseDocumentsButton({siteId}:{siteId:string}){
  const [open,setOpen]=useState(false),{currentLang}=useLanguage(),c=phaseDocumentCopy(currentLang);
  return <><button type="button" onClick={()=>setOpen(true)} className={assetButton} aria-label={c.title} data-testid="phase-documents-open"><FolderCheck size={17}/>{c.phases}</button><AssetWorkspaceDialog open={open} onOpenChange={setOpen} title={c.title} scrollBody>{open?<PhaseDocuments siteId={siteId}/>:null}</AssetWorkspaceDialog></>;
}
function PhaseDocuments({siteId}:{siteId:string}){
  const {currentLang}=useLanguage(),c=phaseDocumentCopy(currentLang),a=assetCopy(currentLang);
  const [phase,setPhase]=useState<DocumentPhase>('piketim'),[data,setData]=useState<PhaseDocumentSnapshot|null>(null),[history,setHistory]=useState(false),[upload,setUpload]=useState(false),[previous,setPrevious]=useState<PhaseDocumentView|null>(null);
  const [title,setTitle]=useState(''),[note,setNote]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[failed,setFailed]=useState(false),[archive,setArchive]=useState<string|null>(null),[remove,setRemove]=useState<string|null>(null);
  const epoch=useRef(0),guard=useRef(false),requestId=useRef<string|null>(null),file=useRef<HTMLInputElement>(null);
  const invalidate=useCallback(()=>{epoch.current++;},[]);
  const load=useCallback(async()=>{
    const own=++epoch.current;setLoading(true);
    try{const result=await getPhaseDocumentsAction(siteId);if(own!==epoch.current)return;if(!result.ok){setFailed(true);setMessage(result.message||a.loadError);}else setData(result.data);}catch{if(own===epoch.current){setFailed(true);setMessage(a.loadError);}}finally{if(own===epoch.current)setLoading(false);}
  },[siteId,a.loadError]);
  useEffect(()=>{let current=true;queueMicrotask(()=>{if(current)void load();});return()=>{current=false;invalidate();};},[load,invalidate]);
  async function perform(action:()=>Promise<{ok:boolean;message?:string}>,done?:()=>void){
    if(guard.current)return;guard.current=true;setBusy(true);setMessage(null);setFailed(false);
    try{const result=await action();if(!result.ok){setMessage(result.message||a.saveError);setFailed(true);return;}done?.();await load();}catch{setMessage(a.saveError);setFailed(true);}finally{guard.current=false;setBusy(false);}
  }
  function startUpload(doc?:PhaseDocumentView){setPrevious(doc??null);setTitle(doc?.title??'');setNote(doc?.note??'');setUpload(true);requestId.current=null;if(file.current)file.current.value='';}
  function selectPhase(key:DocumentPhase){setPhase(key);setUpload(false);setPrevious(null);setArchive(null);setRemove(null);}
  const stamp=(iso:string)=>new Date(iso).toLocaleString(currentLang==='sq'?'sq-AL':currentLang,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Tirane'});
  async function share(doc:PhaseDocumentView){
    if(guard.current)return;guard.current=true;setBusy(true);setMessage(null);
    try{
      if(navigator.share){
        const response=await fetch(`/api/site-phase-documents/${doc.id}?download`,{cache:'no-store'});if(!response.ok)throw new Error('file');
        const file=new File([await response.blob()],doc.fileName,{type:doc.mime});
        if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:doc.title});
        else await navigator.share({title:doc.title,url:`${location.origin}/api/site-phase-documents/${doc.id}`});
      }else{await navigator.clipboard.writeText(`${location.origin}/api/site-phase-documents/${doc.id}`);setMessage(c.copied);setFailed(false);}
    }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError')){setMessage(c.shareError);setFailed(true);}}finally{guard.current=false;setBusy(false);}
  }
  const docs=data?.documents.filter(doc=>doc.phase===phase&&(history||!doc.archivedAt))??[];
  return <div className="min-w-0 space-y-4" data-testid="phase-documents">
    <p className="max-w-3xl text-sm text-muted-foreground">{c.hint}</p>
    <div role="tablist" aria-label={c.title} className="flex flex-wrap gap-2">{DOCUMENT_PHASES.map((key,index)=><button type="button" role="tab" tabIndex={phase===key?0:-1} id={`document-phase-${key}`} aria-controls="phase-document-list" aria-selected={phase===key} disabled={busy} key={key} onClick={()=>selectPhase(key)} onKeyDown={event=>{const next=event.key==='Home'?0:event.key==='End'?5:event.key==='ArrowRight'?(index+1)%6:event.key==='ArrowLeft'?(index+5)%6:null;if(next!==null){event.preventDefault();selectPhase(DOCUMENT_PHASES[next]);document.getElementById(`document-phase-${DOCUMENT_PHASES[next]}`)?.focus();}}} className={`${assetButton} ${phase===key?'border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300':''}`}>{c[key]}<span className="text-xs tabular-nums text-muted-foreground">{data?.documents.filter(d=>d.phase===key&&!d.archivedAt).length??0}</span></button>)}</div>
    {data&&!data.canUpload?<p className="text-xs text-muted-foreground">{siteAccessCopy(currentLang).readOnly}</p>:null}
    <div className="flex flex-wrap items-center gap-2">{data?.canUpload?<button type="button" className={assetPrimary} disabled={busy||loading} onClick={()=>startUpload()}><Plus size={18}/>{c.upload}</button>:null}<button type="button" className={assetButton} aria-label={a.refresh} disabled={busy||loading} onClick={()=>void load()}><RotateCw size={17}/></button><label className="ml-auto flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)} className="size-5 accent-orange-600"/>{c.history}</label></div>
    {upload&&data?.canUpload?<form className="space-y-3 rounded-xl border bg-card p-3" onChange={()=>{requestId.current=null;}} onSubmit={event=>{event.preventDefault();const chosen=file.current?.files?.[0];if(!chosen)return;const form=new FormData();requestId.current??=crypto.randomUUID();form.set('requestId',requestId.current);form.set('siteId',siteId);form.set('phase',phase);form.set('title',title);form.set('note',note);if(previous)form.set('supersedesId',previous.id);form.set('file',chosen);void perform(()=>uploadPhaseDocumentAction(form),()=>{setUpload(false);requestId.current=null;});}}>
      <h3 className="font-semibold">{previous?c.version:c.upload} · {c[phase]}</h3>{previous?<p className="text-sm text-muted-foreground">{c.versionHint}</p>:null}
      <div className="grid gap-3 sm:grid-cols-2"><AssetField label={c.name}><input autoFocus required value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} className={assetInput} disabled={busy}/></AssetField><AssetField label={c.note}><input value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} className={assetInput} disabled={busy}/></AssetField></div>
      <AssetField label={c.file}><input ref={file} type="file" required disabled={busy} accept="application/pdf,.docx,.xlsx,image/jpeg,image/png,image/webp" className="min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:bg-muted file:px-3 file:text-foreground"/></AssetField>
      <div className="flex gap-2"><button className={assetPrimary} disabled={busy||!title.trim()}><Upload size={17}/>{a.save}</button><button type="button" className={assetButton} disabled={busy} onClick={()=>setUpload(false)}>{a.cancel}</button></div>
    </form>:null}
    <AssetFeedback message={message} failed={failed}/>{loading&&!data?<AssetLoading label={a.loading}/>:null}{failed&&!data?<button type="button" className={assetButton} onClick={()=>void load()}>{a.retry}</button>:null}
    <section id="phase-document-list" role="tabpanel" aria-labelledby={`document-phase-${phase}`} aria-busy={loading||busy} className="min-w-0 space-y-3">
      {data&&!docs.length?<p className="py-5 text-sm text-muted-foreground">{c.empty}</p>:null}
      {docs.map(doc=>{const received=doc.receipts.some(r=>r.mine),url=`/api/site-phase-documents/${doc.id}`;return <article key={doc.id} data-testid="phase-document" className={`min-w-0 rounded-xl border bg-card p-3 sm:p-4 ${doc.archivedAt?'opacity-75':''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 basis-56"><h3 className="break-words font-semibold">{doc.title}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{doc.fileName} · {(doc.size/1000).toLocaleString(currentLang,{maximumFractionDigits:0})} {c.kilobytes}</p><p className="mt-1 break-words text-xs text-muted-foreground">{doc.uploadedBy} · {stamp(doc.uploadedAt)}</p>{doc.note?<p className="mt-2 whitespace-pre-wrap break-words text-sm">{doc.note}</p>:null}</div>{doc.archivedAt?<span className="text-xs text-muted-foreground">{c.archived}</span>:<button type="button" disabled={busy||received} onClick={()=>void perform(()=>phaseDocumentAction({documentId:doc.id,action:'receive'}))} className={`${assetButton} ${received?'border-green-600/40 text-green-800 dark:text-green-300':''}`}><Check size={18}/>{received?c.received:c.receive}</button>}</div>
        <div className="mt-3 flex flex-wrap gap-2"><a className={assetButton} href={url} target="_blank" rel="noopener"><ExternalLink size={16}/>{c.open}</a><a className={assetButton} href={`${url}?download`} download={doc.fileName}><Download size={16}/>{c.download}</a><button type="button" className={assetButton} disabled={busy} onClick={()=>void share(doc)}><Send size={16}/>{c.send}</button>{doc.canEdit&&!doc.archivedAt?<><button type="button" className={assetButton} disabled={busy} onClick={()=>startUpload(doc)}>{c.version}</button><button type="button" className={`${assetButton} text-muted-foreground`} disabled={busy} onClick={()=>archive===doc.id?void perform(()=>phaseDocumentAction({documentId:doc.id,action:'archive'}),()=>setArchive(null)):setArchive(doc.id)}>{archive===doc.id?c.confirmArchive:c.archive}</button></>:null}{doc.canEdit?<button type="button" data-testid="phase-document-delete" className={`${assetButton} ${remove===doc.id?'border-red-600 bg-red-600 text-white hover:bg-red-700':'text-red-600 dark:text-red-400'}`} disabled={busy} onClick={()=>remove===doc.id?void perform(()=>deletePhaseDocumentAction({documentId:doc.id}),()=>{setRemove(null);setMessage(c.removed);}):setRemove(doc.id)}><Trash2 size={16}/>{remove===doc.id?c.confirmRemove:c.remove}</button>:null}{remove===doc.id?<button type="button" className={assetButton} disabled={busy} onClick={()=>setRemove(null)}>{a.cancel}</button>:null}</div>
        {remove===doc.id?<p className="mt-2 text-xs text-red-700 dark:text-red-300">{c.removeHint}</p>:null}
        <div className="mt-3 border-t pt-2">{doc.receipts.length?<ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">{doc.receipts.map((r,i)=><li key={i} className="flex min-w-0 items-center gap-1.5"><Check size={14} className="shrink-0 text-green-700 dark:text-green-300"/><span className="break-words">{r.name} · {stamp(r.at)}</span></li>)}</ul>:<p className="text-xs text-muted-foreground">{c.noReceipts}</p>}</div>
      </article>;})}
    </section>
  </div>;
}
