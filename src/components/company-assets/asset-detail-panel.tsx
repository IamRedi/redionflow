"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, FileText, ImagePlus, PenLine, RotateCcw, Upload, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/i18n/language-provider';
import { getAssetDetailAction, getAssetSnapshotAction, uploadAssetFileAction } from '@/app/(workzone)/workzone/asset-operations-actions';
import { AssetCodes } from './asset-codes';
import type { AssetDetail, AssetHandoverView, AssetPerson, AssetRef, AssetRepairView } from '@/lib/company-assets/types';
import { operationalStatusFromSummary } from '@/lib/company-assets/status';
import { assetCopy, type AssetCopy } from './copy';
import { AssetWorkspaceDialog } from './workspace-dialog';
import { AssetFeedback, AssetField, AssetLoading, AssetOperationalStatusBadge, AssetPicture, AssetStatus, assetButton, assetIdentity, assetInput, assetPrimary, assetTime, useAssetMutation } from './shared';

type ReportKind = 'defect' | 'lost' | 'retire';
export function AssetDetailDialog({ asset, onClose, initialReport }: { asset: AssetRef | null; onClose: () => void; initialReport?: ReportKind }) {
  const { currentLang } = useLanguage();
  const c = assetCopy(currentLang);
  return <AssetWorkspaceDialog open={!!asset} onOpenChange={open => { if (!open) onClose(); }} title={c.details} scrollBody layer={1600}>
    {asset ? <AssetDetailPanel key={`${asset.kind}:${asset.id}`} asset={{kind:asset.kind,id:asset.id}} initialReport={initialReport} /> : null}
  </AssetWorkspaceDialog>;
}

export function HandoverCard({ item, c, language, pending, onCommand, onOpen }: {
  item: AssetHandoverView; c: AssetCopy; language: string; pending: boolean;
  onCommand: (type: 'confirm-handover' | 'decline-handover' | 'cancel-handover', item: AssetHandoverView) => void;
  onOpen?: () => void;
}) {
  return <article className="min-w-0 rounded-xl border bg-card p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      {onOpen ? <button type="button" onClick={onOpen} className="min-h-11 min-w-0 break-words text-left font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{item.name}</button> : <h4 className="break-words font-semibold">{c[item.kind]}</h4>}
      <AssetStatus value={item.status} c={c} />
    </div>
    <p className="break-words text-sm text-muted-foreground">{item.from?.name || c.warehouse} → {item.to?.name || c.warehouse}{item.site ? ` · ${item.site.name}` : ''}</p>
    <p className="mt-1 text-xs text-muted-foreground">{assetTime(item.createdAt, language)}</p>
    {item.note ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.note}</p> : null}
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{item.confirmations.map((confirmation, index) => <li key={`${confirmation.name}:${index}`} className="inline-flex items-center gap-1">{confirmation.confirmed ? <Check size={14} className="text-emerald-600 dark:text-emerald-300" /> : null}{confirmation.name} · {confirmation.confirmed ? c.confirmed : c.pending}</li>)}</ul>
    {item.canConfirm || item.canCancel ? <div className="mt-3 flex flex-wrap gap-2">
      {item.canConfirm ? <><button type="button" disabled={pending} onClick={() => onCommand('confirm-handover',item)} className={assetPrimary}>{c.confirm}</button><button type="button" disabled={pending} onClick={() => onCommand('decline-handover',item)} className={assetButton}>{c.decline}</button></> : null}
      {item.canCancel ? <button type="button" disabled={pending} onClick={() => onCommand('cancel-handover',item)} className={assetButton}>{c.cancel}</button> : null}
    </div> : null}
  </article>;
}

export function AssetDetailPanel({ asset: incomingAsset, initialReport, onClose }: { asset: AssetRef; initialReport?: ReportKind; onClose?: () => void }) {
  // TypeScript structural compatibility does not strip summary fields at runtime.
  const asset: AssetRef = {kind:incomingAsset.kind,id:incomingAsset.id};
  const { currentLang: language } = useLanguage();
  const c = assetCopy(language);
  const router = useRouter();
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [people, setPeople] = useState<{workers: AssetPerson[]; sites: AssetPerson[]}>({workers:[],sites:[]});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportKind | null>(initialReport ?? null);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [handover, setHandover] = useState(false);
  const [handoverKind, setHandoverKind] = useState<'issue'|'return'|'transfer'>('issue');
  const [toWorker, setToWorker] = useState('');
  const [toSite, setToSite] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<'photo'|'invoice'|'document'>('photo');
  const [uploadFailed, setUploadFailed] = useState(false);
  const uploadGuard = useRef(false);
  const uploadReceipt = useRef<{signature:string;requestId:string} | null>(null);
  const epoch = useRef(0);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  const cover = useRef<HTMLInputElement>(null);
  const coverCamera = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const {kind:assetKind,id:assetId}=asset;
  const load = useCallback(async () => {
    const own = ++epoch.current;
    setLoading(true); setError(null);
    try {
      const [result, options] = await Promise.all([getAssetDetailAction({kind:assetKind,id:assetId}), getAssetSnapshotAction({page:1})]);
      if (own !== epoch.current) return;
      if (!result.ok) { setDetail(null); setError(result.message || c.loadError); return; }
      setDetail(result.data);
      setPeople(options.ok ? {workers:options.data.workers,sites:options.data.sites} : {workers:[],sites:[]});
    } catch { if (own === epoch.current) { setDetail(null); setError(c.loadError); } }
    finally { if (own === epoch.current) setLoading(false); }
  }, [assetKind, assetId, c.loadError]);
  useEffect(() => {
    let current = true;
    queueMicrotask(() => { if (current) void load(); });
    return () => { current = false; invalidate(); };
  }, [load, invalidate]);
  const mutation = useAssetMutation(c,load);
  const busy = mutation.pending || uploading;
  const activeRepair = detail?.repairs.find(item => item.id === detail.asset.activeRepairId) ?? detail?.repairs.find(item => !['ready','cancelled'].includes(item.phase));
  const canRepair = !!detail && (detail.permissions.canRepair || detail.permissions.canManage);
  const canManage = !!detail?.permissions.canManage;

  async function upload(file: File | undefined, kind: 'photo'|'invoice'|'document'|'cover', repairId?: string) {
    if (!file || uploadGuard.current || mutation.pending) return;
    const image = file.type.startsWith('image/');
    if ((!image && file.type !== 'application/pdf') || file.size > (image ? 12 : 5) * 1024 * 1024 || ((kind === 'cover' || kind === 'photo') && !image)) { setUploadMessage(c.invalidFile); setUploadFailed(true); return; }
    uploadGuard.current = true; setUploading(true); setUploadMessage(null); setUploadFailed(false);
    const signature = JSON.stringify([asset.kind,asset.id,repairId,kind,file.name,file.size,file.lastModified]);
    if (uploadReceipt.current?.signature !== signature) uploadReceipt.current = {signature,requestId:crypto.randomUUID()};
    const data = new FormData();
    data.set('assetKind',asset.kind); data.set('assetId',asset.id); data.set('kind',kind); data.set('requestId',uploadReceipt.current.requestId); data.set('file',file);
    if (repairId) data.set('repairId',repairId);
    const own = epoch.current;
    try {
      const result = await uploadAssetFileAction(data);
      if (own !== epoch.current) return;
      if (!result.ok) { setUploadMessage(result.message || c.saveError); setUploadFailed(true); return; }
      uploadReceipt.current = null; setUploadMessage(c.saved); await load(); router.refresh();
    } catch { if (own === epoch.current) { setUploadMessage(c.saveError); setUploadFailed(true); } }
    finally { uploadGuard.current = false; setUploading(false); }
  }
  function fileChange(input: HTMLInputElement, kind: 'photo'|'invoice'|'document'|'cover', repairId?: string) { const file=input.files?.[0]; input.value=''; void upload(file,kind,repairId); }
  if (loading && !detail) return <AssetLoading label={c.loading} />;
  if (!detail) return <div className="space-y-3"><AssetFeedback message={error || c.loadError} failed /><button type="button" className={assetButton} onClick={() => void load()}>{c.retry}</button></div>;
  const item = detail.asset;
  const reportLabel = report === 'lost' ? c.reportLost : report === 'retire' ? c.reportRetire : c.reportDefect;
  const files = detail.files.filter(file => file.kind !== 'invoice' || canRepair);
  return <div className="mx-auto flex w-full min-w-0 flex-col gap-5 pb-2" aria-busy={busy} data-testid="asset-detail">
    <div className="flex flex-wrap items-start gap-4">
      <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-xl border bg-gradient-to-br from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-950">
        <AssetPicture asset={item} />
        {canManage ? <button type="button" className="absolute bottom-1 right-1 grid size-11 place-items-center rounded-xl border bg-card/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" disabled={busy} onClick={() => cover.current?.click()} aria-label={c.cover}><ImagePlus size={18} /></button> : null}
      </div>
      <div className="min-w-0 flex-1"><h2 className="break-words text-xl font-semibold">{item.name}</h2><p className="mt-1 break-words font-mono text-sm text-muted-foreground">{assetIdentity(item) || '—'}</p><div className="mt-2"><AssetOperationalStatusBadge status={operationalStatusFromSummary(item)} c={c} /></div>{item.holder ? <p className="mt-2 text-sm">{c.worker}: {item.holder.name}</p> : null}{item.site ? <p className="text-sm text-muted-foreground">{c.site}: {item.site.name}</p> : null}</div>
      <div className="flex flex-wrap gap-2">{canManage ? <><button type="button" aria-label={c.camera} disabled={busy} onClick={() => coverCamera.current?.click()} className={assetButton}><Camera size={18} /></button><button type="button" disabled={busy} onClick={() => {setEditing(!editing);setEditName(item.name);setEditSize(item.size || '');}} className={assetButton}><PenLine size={16} />{c.edit}</button></> : null}{onClose ? <button type="button" className={assetButton} onClick={onClose}>{c.close}</button> : null}</div>
    </div>
    <input ref={cover} hidden type="file" accept="image/*" onChange={event => fileChange(event.target,'cover')} /><input ref={coverCamera} hidden type="file" accept="image/*" capture="environment" onChange={event => fileChange(event.target,'cover')} />
    <AssetFeedback message={error} failed /><AssetFeedback message={mutation.message} failed={mutation.failed} /><AssetFeedback message={uploadMessage} failed={uploadFailed} />
    <AssetCodes detail={detail} c={c} pending={busy} run={mutation.run}/>
    {editing && canManage ? <form className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2" onSubmit={async event => {event.preventDefault();if(await mutation.run({type:'edit',asset,revision:item.revision,name:editName.trim(),size:editSize.trim()}))setEditing(false);}}><AssetField label={c.name}><input required maxLength={120} value={editName} onChange={event=>setEditName(event.target.value)} className={assetInput} disabled={busy} /></AssetField>{item.category==='clothing' ? <AssetField label={c.size}><input value={editSize} maxLength={40} onChange={event=>setEditSize(event.target.value)} className={assetInput} disabled={busy} /></AssetField> : null}<div className="flex gap-2 sm:col-span-2"><button disabled={busy||!editName.trim()} className={assetPrimary}>{c.save}</button><button type="button" disabled={busy} onClick={()=>setEditing(false)} className={assetButton}>{c.cancel}</button></div></form> : null}

    <div className="flex flex-wrap gap-2">
      {item.category!=='clothing'&&!activeRepair&&!['lost','retired'].includes(item.availability)?<button type="button" disabled={busy} onClick={()=>{setReport('defect');setNote('');setHandover(false);setRestoring(false);}} className={assetButton}><Wrench size={17} />{c.reportDefect}</button>:null}
      {!['lost','retired'].includes(item.availability)?<button type="button" disabled={busy} onClick={()=>{setReport('lost');setNote('');setHandover(false);setRestoring(false);}} className={assetButton}>{c.reportLost}</button>:null}
      {!['lost','retired'].includes(item.availability)?<button type="button" disabled={busy} onClick={()=>{setReport('retire');setNote('');setHandover(false);setRestoring(false);}} className={assetButton}>{c.reportRetire}</button>:null}
      {(canManage || item.holder?.id===detail.permissions.workerId || (!item.holder&&detail.permissions.workerId)) && ['available','issued'].includes(item.availability) ? <button type="button" disabled={busy} onClick={()=>{setHandover(!handover);setHandoverKind(item.holder?'return':'issue');setToWorker(detail.permissions.workerId||'');setReport(null);setRestoring(false);setNote('');}} className={assetButton}>{c.handover}</button> : null}
      {canManage && ['lost','retired','inactive'].includes(item.availability) ? <button type="button" disabled={busy} onClick={()=>{setRestoring(true);setReport(null);setHandover(false);setNote('');}} className={assetButton}><RotateCcw size={16} />{c.restore}</button> : null}
    </div>
    {report && (report !== 'defect' || !activeRepair) ? <form className="space-y-3 rounded-xl border border-orange-500/30 bg-card p-3" onSubmit={async event=>{event.preventDefault();if(await mutation.run({type:'report',asset,kind:report,note:note.trim()})){setReport(null);setNote('');}}}><h3 className="font-semibold">{reportLabel}</h3><AssetField label={c.note}><textarea autoFocus required maxLength={2000} rows={3} value={note} onChange={event=>setNote(event.target.value)} placeholder={c.requiredNote} className={assetInput} disabled={busy} /></AssetField><div className="flex flex-wrap gap-2"><button disabled={busy||!note.trim()} className={assetPrimary}>{c.report}</button><button type="button" disabled={busy} onClick={()=>setReport(null)} className={assetButton}>{c.cancel}</button></div></form> : null}
    {restoring ? <form className="space-y-3 rounded-xl border bg-card p-3" onSubmit={async event=>{event.preventDefault();if(await mutation.run({type:'restore',asset,revision:item.revision,note:note.trim()})){setRestoring(false);setNote('');}}}><AssetField label={c.note}><textarea required value={note} onChange={event=>setNote(event.target.value)} maxLength={2000} className={assetInput} disabled={busy}/></AssetField><div className="flex gap-2"><button disabled={busy||!note.trim()} className={assetPrimary}>{c.restore}</button><button type="button" onClick={()=>setRestoring(false)} className={assetButton}>{c.cancel}</button></div></form> : null}

    {handover ? <form className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2" onSubmit={async event=>{event.preventDefault();if(await mutation.run({type:'handover',asset,kind:handoverKind,toWorkerId:handoverKind==='return'?undefined:toWorker,siteId:toSite||undefined,note:note.trim()})){setHandover(false);setNote('');}}}>
      <AssetField label={c.handover}><select value={handoverKind} onChange={event=>setHandoverKind(event.target.value as typeof handoverKind)} className={assetInput} disabled={busy}>{!item.holder?<option value="issue">{c.issue}</option>:null}{item.holder?<><option value="return">{c.return}</option><option value="transfer">{c.transfer}</option></>:null}</select></AssetField>
      {handoverKind!=='return'?<AssetField label={c.worker}><select required value={toWorker} onChange={event=>setToWorker(event.target.value)} className={assetInput} disabled={busy}><option value="">{c.choose}</option>{people.workers.filter(person=>handoverKind!=='issue'||canManage||person.id===detail.permissions.workerId).map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></AssetField>:null}
      <AssetField label={c.site}><select value={toSite} onChange={event=>setToSite(event.target.value)} className={assetInput} disabled={busy}><option value="">—</option>{people.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></AssetField>
      <AssetField label={c.note}><input value={note} onChange={event=>setNote(event.target.value)} maxLength={2000} className={assetInput} disabled={busy}/></AssetField><p className="text-sm text-muted-foreground sm:col-span-2">{c.handoverHint}</p><div className="flex gap-2 sm:col-span-2"><button disabled={busy||(handoverKind!=='return'&&!toWorker)} className={assetPrimary}>{c.confirm}</button><button type="button" disabled={busy} onClick={()=>setHandover(false)} className={assetButton}>{c.cancel}</button></div>
    </form> : null}

    {detail.handovers.length ? <section className="space-y-3"><h3 className="font-semibold">{c.handovers}</h3><div className="grid gap-3 lg:grid-cols-2">{detail.handovers.map(h=><HandoverCard key={h.id} item={h} c={c} language={language} pending={busy} onCommand={(type,entry)=>void mutation.run({type,handoverId:entry.id,revision:entry.revision})} />)}</div></section>:null}
    {detail.incidents.length ? <section className="space-y-3"><h3 className="font-semibold">{c.reports}</h3>{detail.incidents.map(incident=><article key={incident.id} className="rounded-xl border bg-card p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium">{incident.kind==='defect'?c.reportDefect:incident.kind==='lost'?c.reportLost:c.reportRetire}</h4><AssetStatus value={incident.status} c={c}/></div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{incident.note}</p><p className="mt-2 text-xs text-muted-foreground">{incident.reportedBy} · {assetTime(incident.createdAt,language)}</p>{canManage&&incident.status==='pending'&&(incident.kind!=='defect'||activeRepair?.phase==='reported')?<div className="mt-3 space-y-2"><AssetField label={c.note}><input value={decision} onChange={event=>setDecision(event.target.value)} maxLength={2000} className={assetInput} disabled={busy}/></AssetField><div className="flex gap-2">{incident.kind!=='defect'?<button type="button" disabled={busy||!decision.trim()} onClick={()=>void mutation.run({type:'decide-incident',incidentId:incident.id,revision:incident.revision,approve:true,note:decision.trim()})} className={assetPrimary}>{c.approve}</button>:null}<button type="button" disabled={busy||!decision.trim()} onClick={()=>void mutation.run({type:'decide-incident',incidentId:incident.id,revision:incident.revision,approve:false,note:decision.trim()})} className={assetButton}>{c.reject}</button></div></div>:null}</article>)}</section>:null}

    {detail.repairs.length ? <section className="space-y-3"><h3 className="font-semibold">{c.workshop}</h3>{detail.repairs.map(repair=><RepairEditor key={repair.id} repair={repair} c={c} language={language} canRepair={canRepair} busy={busy} hasEvidence={files.some(file=>file.repairId===repair.id)} onCommand={mutation.run}/>)}</section>:null}

    <section className="space-y-3"><h3 className="font-semibold">{c.files}</h3><div className="flex flex-wrap items-end gap-2"><AssetField label={c.files}><select value={fileKind} onChange={event=>setFileKind(event.target.value as typeof fileKind)} className={assetInput} disabled={busy}><option value="photo">{c.photo}</option><option value="document">{c.document}</option>{canRepair?<option value="invoice">{c.invoice}</option>:null}</select></AssetField><button type="button" disabled={busy} onClick={()=>fileInput.current?.click()} className={assetButton}><Upload size={17}/>{c.upload}</button><button type="button" disabled={busy} onClick={()=>camera.current?.click()} aria-label={c.camera} className={assetButton}><Camera size={19}/></button></div><p className="text-xs text-muted-foreground">{c.fileLimits}</p><input ref={fileInput} data-testid="asset-file-input" hidden type="file" accept={fileKind==='photo'?'image/*':'image/*,application/pdf'} onChange={event=>fileChange(event.target,fileKind,activeRepair?.id)}/><input ref={camera} data-testid="asset-camera-input" hidden type="file" accept="image/*" capture="environment" onChange={event=>fileChange(event.target,fileKind,activeRepair?.id)}/><ul className="grid gap-2 sm:grid-cols-2">{files.map(file=><li key={file.id} className="min-w-0 rounded-xl border bg-card"><a href={file.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-start gap-2 rounded-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><FileText size={18} className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400"/><span className="min-w-0"><span className="block break-words text-sm font-medium">{file.name}</span><span className="block text-xs text-muted-foreground">{c[file.kind]} · {`${Math.ceil(file.bytes/1024)} KB`}</span><span className="mt-1 block text-xs text-muted-foreground">{file.uploadedBy} · {assetTime(file.uploadedAt,language)}</span></span></a></li>)}</ul></section>
    <section className="space-y-3"><h3 className="font-semibold">{c.history}</h3><ol className="space-y-0">{detail.history.map(event=><li key={event.id} className="relative ml-1 border-l pl-5 pb-5 last:pb-0"><span className="absolute -left-[4px] top-1.5 size-2 rounded-full bg-orange-500"/><p className="text-sm font-medium">{historyLabel(event.type,c)}</p>{event.note?<p className="mt-1 whitespace-pre-wrap break-words text-sm">{event.note}</p>:null}<p className="mt-1 text-xs text-muted-foreground">{event.actor} · {assetTime(event.at,language)}</p></li>)}</ol></section>
  </div>;
}

function historyLabel(type: string, c: AssetCopy) {
  if(type==='code.added')return `${c.add}: ${c.factoryCode}`;
  if(type==='code.removed')return c.removeCode;
  if(type==='code.generated')return c.generateCode;
  const labels: Record<string,string> = {registered:c.addAsset,updated:c.edit,restored:c.restore,'inactive-holder-return':c.return,'legacy.TAKE':c.issue,'legacy.RETURN':c.return,'machine.activated':c.available,'machine.blocked':c.inactive,'machine.updated':c.edit,'incident.defect.confirmed':c.ready,'incident.defect.rejected':c.rejected,'invoice-added':c.invoice,'file-added':c.files,'cover-added':c.cover,'handover.requested':c.handover,'handover.confirmed':c.confirm,'handover.declined':c.decline,'handover.cancelled':c.cancel,'handover.issue.completed':c.issue,'handover.return.completed':c.return,'handover.transfer.completed':c.transfer,'incident.defect.reported':c.reportDefect,'incident.lost.reported':c.reportLost,'incident.retire.reported':c.reportRetire,'incident.lost.confirmed':c.lost,'incident.retire.confirmed':c.retired,'incident.lost.rejected':c.rejected,'incident.retire.rejected':c.rejected,'repair.received':c.received,'repair.repairing':c.repairing,'repair.ready':c.ready,'repair.note':c.repairNote,'repair.location.internal':c.internal,'repair.location.external':c.external};
  return labels[type] || c.history;
}

function RepairEditor({repair,c,language,canRepair,busy,hasEvidence,onCommand}: {repair:AssetRepairView;c:AssetCopy;language:string;canRepair:boolean;busy:boolean;hasEvidence:boolean;onCommand:ReturnType<typeof useAssetMutation>['run']}) {
  const [note,setNote]=useState('');
  const [location,setLocation]=useState(repair.location);
  const [provider,setProvider]=useState(repair.provider);
  const [locationNote,setLocationNote]=useState('');
  const [tested,setTested]=useState(false);
  return <article className="space-y-3 rounded-xl border bg-card p-3"><div className="flex flex-wrap items-center justify-between gap-2"><AssetStatus value={repair.phase} c={c}/><span className="text-xs text-muted-foreground">{assetTime(repair.updatedAt,language)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{repair.problem}</p><p className="text-xs text-muted-foreground">{repair.reportedBy} · {c[repair.location]}{repair.provider?` · ${repair.provider}`:''}</p>
    {canRepair&&!['ready','cancelled'].includes(repair.phase)?<>
      {repair.phase==='reported'?<button type="button" disabled={busy} onClick={()=>void onCommand({type:'repair-phase',repairId:repair.id,revision:repair.revision,phase:'received'})} className={assetPrimary}>{c.receive}</button>:null}
      {repair.phase==='received'?<button type="button" disabled={busy} onClick={()=>void onCommand({type:'repair-phase',repairId:repair.id,revision:repair.revision,phase:'repairing'})} className={assetPrimary}>{c.startRepair}</button>:null}
      {repair.repairNote?<p className="whitespace-pre-wrap break-words text-sm">{repair.repairNote}</p>:null}
      <form className="space-y-2" onSubmit={async event=>{event.preventDefault();if(await onCommand({type:'repair-note',repairId:repair.id,revision:repair.revision,note:note.trim()}))setNote('');}}><AssetField label={c.repairNote}><textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={2000} rows={3} className={assetInput} disabled={busy}/></AssetField><button disabled={busy||!note.trim()} className={assetButton}>{c.save}</button></form>
      {repair.phase==='repairing'?<><form className="grid gap-3 border-t pt-3 sm:grid-cols-2" onSubmit={async event=>{event.preventDefault();if(await onCommand({type:'repair-location',repairId:repair.id,revision:repair.revision,location,provider:location==='external'?provider.trim():undefined,note:locationNote.trim()}))setLocationNote('');}}><AssetField label={c.location}><select value={location} onChange={event=>setLocation(event.target.value as typeof location)} className={assetInput} disabled={busy}><option value="internal">{c.internal}</option><option value="external">{c.external}</option></select></AssetField>{location==='external'?<AssetField label={c.provider}><input required value={provider} onChange={event=>setProvider(event.target.value)} maxLength={120} className={assetInput} disabled={busy}/></AssetField>:null}<AssetField label={c.note}><input required value={locationNote} onChange={event=>setLocationNote(event.target.value)} maxLength={2000} className={assetInput} disabled={busy}/></AssetField><div className="flex items-end"><button disabled={busy||!locationNote.trim()||(location==='external'&&!provider.trim())} className={assetButton}>{c.save}</button></div></form><div className="space-y-3 border-t pt-3"><p className="text-sm text-muted-foreground">{c.readyHint}</p>{note.trim()?<p className="text-sm text-orange-800 dark:text-orange-300">{c.saveNoteFirst}</p>:null}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={tested} onChange={event=>setTested(event.target.checked)} disabled={busy} className="size-5 shrink-0 accent-orange-600"/>{c.tested}</label><button type="button" disabled={busy||!tested||!!note.trim()||(!repair.repairNote.trim()&&!hasEvidence)} onClick={()=>void onCommand({type:'repair-phase',repairId:repair.id,revision:repair.revision,phase:'ready',tested:true})} className={assetPrimary}><Check size={18}/>{c.markReady}</button></div></>:null}
    </>:repair.repairNote?<p className="whitespace-pre-wrap break-words text-sm">{repair.repairNote}</p>:null}
  </article>;
}
