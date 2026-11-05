"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Download, FileText, History, Package, Plus, Search, ShieldCheck, Truck, Wrench } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { activeJob, availability, inspectionOverdue, workshopDay, type WorkshopAsset, type WorkshopCommand, type WorkshopDocument, type WorkshopJob } from "@/lib/workshop/demo-model";
import { workshopCopy } from "@/lib/workshop/copy";
import { WORKSHOP_STORAGE_KEY, workshopTabs, type WorkshopTab } from "@/lib/workshop/demo-model";
import { useWorkshopDemo } from "./use-workshop-demo";
import { action, control, Field, Status, WorkshopDialog } from "./workshop-ui";
type Modal = {
  type: "receive" | "asset" | "issue" | "inspection";
  id?: string;
} | {
  type: "job";
  id: string;
} | {
  type: "reset";
} | null;
const icons = {
  orders: ClipboardList,
  fleet: Truck,
  tools: Wrench,
  parts: Package,
  documents: FileText,
  history: History
};
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function documentBlob(doc: WorkshopDocument) {
  return doc.mime === "text/plain" ? new Blob([doc.data], {
    type: doc.mime
  }) : new Blob([Uint8Array.from(atob(doc.data), c => c.charCodeAt(0))], {
    type: doc.mime
  });
}
export function WorkshopDemo({
  tab,
  initialAsset = "",
  now
}: {
  tab: WorkshopTab;
  initialAsset?: string;
  now: string;
}) {
  const {
    currentLang
  } = useLanguage();
  const c = workshopCopy(currentLang);
  const {
    state,
    status,
    hydrated,
    dispatch,
    reset
  } = useWorkshopDemo();
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState(initialAsset);
  const [modal, setModal] = useState<Modal>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [documentAsset, setDocumentAsset] = useState(initialAsset || state.assets[0].id);
  const [documentJob, setDocumentJob] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const today = now;
  const date = (value: string) => new Date(value).toLocaleString(currentLang, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  });
  const money = (cents: number) => new Intl.NumberFormat(currentLang, {
    style: "currency",
    currency: "EUR"
  }).format(cents / 100);
  const assetFor = (id: string) => state.assets.find(a => a.id === id)!;
  const selectedAsset = modal && "id" in modal ? state.assets.find(a => a.id === modal.id) : null;
  const selectedJob = modal?.type === "job" ? state.jobs.find(j => j.id === modal.id) : null;
  const matchAsset = (asset: WorkshopAsset) => `${asset.name} ${asset.code}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!assetFilter || asset.id === assetFilter);
  const matchJob = (job: WorkshopJob) => (!assetFilter || job.assetId === assetFilter) && `${assetFor(job.assetId).name} ${assetFor(job.assetId).code} ${job.problem} ${job.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  function errorText(code: string) {
    return ({
      required: c.required,
      duplicate: c.duplicate,
      transition: c.transition,
      testRequired: c.testRequired,
      inspectionRequired: c.inspectionRequired,
      stock: c.stockError,
      storage: c.storage,
      unavailable: c.unavailable,
      corrupt: c.corrupt
    } as Record<string, string>)[code] || c.error;
  }
  function run(command: WorkshopCommand) {
    try {
      dispatch(command);
      setMessage({
        text: c.saved,
        error: false
      });
      return true;
    } catch (error) {
      setMessage({
        text: errorText(error instanceof Error ? error.message : "error"),
        error: true
      });
      return false;
    }
  }
  function submit(event: FormEvent<HTMLFormElement>, handler: (data: FormData) => WorkshopCommand) {
    event.preventDefault();
    if (run(handler(new FormData(event.currentTarget)))) setModal(null);
  }
  function assetStatus(asset: WorkshopAsset) {
    const value = availability(state, asset, today);
    return <Status tone={value === "available" ? "green" : value === "issued" ? "blue" : "amber"}>{c[value === "inspection" ? "inspectionDue" : value]}</Status>;
  }
  function events(asset: WorkshopAsset) {
    return asset.events.length ? <ol className="space-y-4">{asset.events.map((e, index) => <li key={`${e.id}-${index}`} className="border-l-2 border-primary/30 pl-4"><div className="flex flex-wrap items-center justify-between gap-1 text-sm"><strong>{c[`${e.kind}Event` as keyof typeof c]}</strong><time className="text-xs text-muted-foreground" dateTime={e.at}>{date(e.at)} · {e.actor}</time></div>{e.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{e.note}</p>}{e.ref && <span className="text-xs text-muted-foreground">{e.ref.slice(0, 12)}</span>}</li>)}</ol> : <p className="text-sm text-muted-foreground">{c.noHistory}</p>;
  }
  async function addDocument(file?: File) {
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "text/plain"];
    if (!allowed.includes(file.type) || file.size < 1 || file.size > 256000) {
      setMessage({
        text: c.fileError,
        error: true
      });
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const data = file.type === "text/plain" ? new TextDecoder().decode(bytes) : btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
      run({
        type: "document",
        document: {
          id: crypto.randomUUID(),
          name: file.name.slice(0, 120),
          assetId: documentAsset,
          ...(documentJob ? {
            jobId: documentJob
          } : {}),
          mime: file.type as WorkshopDocument["mime"],
          data,
          bytes: file.size,
          at: new Date().toISOString()
        }
      });
    } catch {
      setMessage({
        text: c.fileError,
        error: true
      });
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  const disabled = status !== "ready" || !hydrated;
  const visibleJobs = state.jobs.filter(matchJob);
  return <div className="space-y-5" data-testid="workshop-demo">
    <header className="overflow-hidden rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">BaumdienstFlow · {c.demo}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{c.title}</h1><p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p></div><Button className={action} disabled={disabled} onClick={() => setModal({
          type: "receive"
        })}><Plus />{c.newJob}</Button></div>
      <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">{c.demoHint}</p>
    </header>
    <nav aria-label={c.filters} className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1 sm:grid-cols-3 lg:grid-cols-6">{workshopTabs.map(key => {
        const Icon = icons[key];
        return <Link key={key} href={`/demo/workshop?tab=${key}${assetFilter ? `&asset=${encodeURIComponent(assetFilter)}` : ""}`} aria-current={tab === key ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === key ? "bg-primary text-primary-foreground dark:text-black" : "text-muted-foreground hover:bg-muted"}`}><Icon className="size-4 shrink-0" />{c[key]}</Link>;
      })}</nav>
    {status !== "ready" && <p role="alert" className="rounded-xl border border-amber-600 bg-card p-4 text-sm">{c[status]}</p>}
    <div className="flex flex-col gap-3 sm:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><input aria-label={c.search} placeholder={c.search} value={query} onChange={e => setQuery(e.target.value)} className={`${control} pl-10`} /></label>{tab !== "parts" && <select aria-label={c.asset} className={`${control} sm:w-64`} value={assetFilter} onChange={e => setAssetFilter(e.target.value)}><option value="">{c.all}</option>{state.assets.map(a => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}</select>}</div>
    <div role={message?.error ? "alert" : "status"} aria-live="polite" className={message ? `rounded-lg border px-4 py-3 text-sm ${message.error ? "border-amber-600 bg-amber-500/10" : "border-primary/30 bg-card"}` : "sr-only"}>{message?.text}</div>
    {tab === "orders" && <div className="grid items-start gap-4 lg:grid-cols-3">{(["received", "repairing", "repaired"] as const).map(stage => <section key={stage} aria-labelledby={`stage-${stage}`} className="min-w-0 rounded-2xl border bg-muted/30 p-3"><h2 id={`stage-${stage}`} className="mb-3 flex items-center justify-between gap-2 px-1 text-sm font-semibold"><span>{c[stage]}</span><span className="rounded-full border bg-card px-2 py-0.5 tabular-nums">{visibleJobs.filter(j => j.status === stage).length}</span></h2><div className="space-y-3">{visibleJobs.filter(j => j.status === stage).map(job => {
            const asset = assetFor(job.assetId);
            return <button key={job.id} onClick={() => setModal({
              type: "job",
              id: job.id
            })} className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${c.details}: ${asset.name} · ${asset.code}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{job.id.slice(0, 12)}</span><Status tone={job.releasedAt ? "green" : job.priority === "urgent" ? "amber" : "neutral"}>{job.releasedAt ? c.released : c[job.priority]}</Status></div><h3 className="mt-3 text-base font-semibold">{asset.name}</h3><p className="mt-0.5 text-xs font-medium text-primary">{asset.code}</p><p className="mt-3 break-words text-sm">{job.problem}</p><p className="mt-4 text-xs text-muted-foreground">{job.assignee || c.assignee}</p><div className="mt-3 flex items-center justify-between border-t pt-3 text-xs font-medium"><span>{job.releasedAt ? c.history : job.status === "received" ? c.start : job.status === "repairing" ? c.finish : c.pendingRelease}</span><ArrowRight className="size-4" /></div></button>;
          })}{!visibleJobs.some(j => j.status === stage) && <p className="p-4 text-sm text-muted-foreground">{c.empty}</p>}</div></section>)}</div>}
    {(tab === "fleet" || tab === "tools") && <div className="grid gap-3 sm:grid-cols-2">{state.assets.filter(a => a.kind === (tab === "fleet" ? "fleet" : "tool") && matchAsset(a)).map(asset => <article key={asset.id} className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2">{assetStatus(asset)}{asset.kind === "fleet" ? <Truck className="size-5 text-muted-foreground" /> : <Wrench className="size-5 text-muted-foreground" />}</div><h2 className="mt-3 text-lg font-semibold">{asset.name}</h2><p className="text-sm font-medium text-primary">{asset.code}</p><dl className="my-4 grid gap-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{c.location}</dt><dd>{asset.location}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{c.inspection}</dt><dd>{new Date(`${asset.inspection}T12:00:00Z`).toLocaleDateString(currentLang, {
                timeZone: "Europe/Berlin"
              })}</dd></div></dl><Button variant="outline" className={`${action} w-full`} onClick={() => setModal({
          type: "asset",
          id: asset.id
        })}>{c.details}<ArrowRight /></Button></article>)}{!state.assets.some(a => a.kind === (tab === "fleet" ? "fleet" : "tool") && matchAsset(a)) && <p>{c.empty}</p>}</div>}
    {tab === "parts" && <div className="grid gap-3 sm:grid-cols-2">{state.parts.filter(p => p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(part => <article key={part.id} className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{part.name}</h2><Package className="size-5 text-primary" /></div><p className="my-3"><strong className="text-3xl tabular-nums">{part.stock}</strong><span className="ml-2 text-sm text-muted-foreground">{c.stock} · {c.minimum} {part.minimum}</span></p>{part.stock < part.minimum && <Status tone="amber">{c.low}</Status>}<form className="mt-4 flex items-end gap-2" onSubmit={e => {
          e.preventDefault();
          run({
            type: "restock",
            partId: part.id,
            qty: Number(new FormData(e.currentTarget).get("qty"))
          });
        }}><Field label={c.count}><input className={control} type="number" name="qty" min="1" max="10000" step="1" defaultValue="1" required /></Field><Button className={action} variant="outline" disabled={disabled}>{c.restock}</Button></form></article>)}</div>}
    {tab === "documents" && <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{c.documents}</h2><p className="text-sm text-muted-foreground">{c.documentHint}</p><div className="grid gap-3 sm:grid-cols-2"><Field label={c.asset}><select className={control} value={documentAsset} onChange={e => {
            setDocumentAsset(e.target.value);
            setDocumentJob("");
          }}>{state.assets.map(a => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}</select></Field><Field label={c.selectJob}><select className={control} value={documentJob} onChange={e => setDocumentJob(e.target.value)}><option value="">{c.noJob}</option>{state.jobs.filter(j => j.assetId === documentAsset).map(j => <option key={j.id} value={j.id}>{j.id.slice(0, 12)} · {j.problem}</option>)}</select></Field></div><Field label={c.upload}><input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,text/plain" className="min-h-11 w-full min-w-0 rounded-md border p-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2 file:text-foreground" disabled={disabled} onChange={e => void addDocument(e.target.files?.[0])} /></Field><ul className="divide-y">{state.documents.filter(doc => matchAsset(assetFor(doc.assetId)) || !assetFilter && doc.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(doc => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-all text-sm font-medium">{doc.name}</p><p className="mt-1 text-xs text-muted-foreground">{assetFor(doc.assetId).code} · {doc.jobId?.slice(0, 12) || c.noJob} · {Math.ceil(doc.bytes / 1024)} KB</p></div><Button className={action} variant="outline" onClick={() => download(doc.name, documentBlob(doc))}><Download />{c.download}</Button></li>)}</ul></section>}
    {tab === "history" && <section className="space-y-6 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">{c.history}</h2>{state.assets.filter(a => matchAsset(a) && a.events.length).map(asset => <article key={asset.id}><h3 className="mb-4 font-semibold">{asset.name}<span className="ml-2 text-sm font-normal text-muted-foreground">{asset.code}</span></h3>{events(asset)}</article>)}{!state.assets.some(a => matchAsset(a) && a.events.length) && <p className="text-sm text-muted-foreground">{c.noHistory}</p>}</section>}
    <footer className="flex flex-wrap items-center gap-2 border-t pt-4"><Button variant="outline" className={action} onClick={() => {
        let raw = JSON.stringify(state);
        try {
          raw = localStorage.getItem(WORKSHOP_STORAGE_KEY) || raw;
        } catch {}
        download("baumdienst-workshop-demo.json", new Blob([raw], {
          type: "application/json"
        }));
      }}><Download />{c.export}</Button><Button variant="ghost" className={action} onClick={() => setModal({
        type: "reset"
      })}>{c.reset}</Button><p className="basis-full text-xs leading-relaxed text-muted-foreground">{c.localScope}</p></footer>
    <WorkshopDialog open={modal !== null} onClose={() => setModal(null)} closeLabel={c.close} title={modal?.type === "reset" ? c.reset : selectedJob ? `${assetFor(selectedJob.assetId).name} · ${assetFor(selectedJob.assetId).code}` : modal?.type === "receive" ? c.newJob : selectedAsset ? `${selectedAsset.name} · ${selectedAsset.code}` : c.title}>
      {/* Feedback is inside the modal as well so failures remain visible without closing it. */}
      {message?.error && <p role="alert" className="mb-4 rounded-lg border border-amber-600 p-3 text-sm">{message.text}</p>}
      {modal?.type === "reset" && <div className="space-y-4"><p className="text-sm text-muted-foreground">{c.resetHint}</p><Button className={action} onClick={() => {
          try {
            reset();
            setModal(null);
            setMessage({
              text: c.saved,
              error: false
            });
          } catch {
            setMessage({
              text: c.storage,
              error: true
            });
          }
        }}>{c.reset}</Button></div>}
      {modal?.type === "receive" && <form className="grid gap-4" onSubmit={e => submit(e, data => ({
        type: "receive",
        assetId: String(data.get("asset")),
        problem: String(data.get("problem")),
        priority: data.get("priority") === "urgent" ? "urgent" : "normal",
        assignee: String(data.get("assignee"))
      }))}><Field label={c.asset}><select className={control} name="asset" defaultValue={modal.id || ""} required><option value="">—</option>{state.assets.filter(a => !activeJob(state, a.id)).map(a => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}</select></Field><Field label={c.problem}><textarea className={`${control} h-24 py-3`} name="problem" maxLength={2000} required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={c.priority}><select className={control} name="priority"><option value="normal">{c.normal}</option><option value="urgent">{c.urgent}</option></select></Field><Field label={c.assignee}><input className={control} name="assignee" maxLength={100} defaultValue="Werkstatt-Team" /></Field></div><Button className={action} disabled={disabled}>{c.submit}</Button></form>}
      {selectedJob && <div className="space-y-5"><div className="flex flex-wrap gap-2"><Status tone={selectedJob.status === "repaired" ? "green" : "amber"}>{c[selectedJob.status]}</Status><Status>{selectedJob.releasedAt ? c.released : c.unavailable}</Status></div><p className="whitespace-pre-wrap break-words text-sm">{selectedJob.problem}</p><p className="text-xs text-muted-foreground">{date(selectedJob.createdAt)} · {selectedJob.assignee}</p>
        {selectedJob.status === "received" && <form className="grid gap-3" onSubmit={e => submit(e, data => ({
          type: "start",
          jobId: selectedJob.id,
          assignee: String(data.get("assignee"))
        }))}><Field label={c.assignee}><input className={control} name="assignee" maxLength={100} required defaultValue={selectedJob.assignee} /></Field><Button className={action} disabled={disabled}>{c.start}<ArrowRight /></Button></form>}
        {selectedJob.status === "repairing" && <><form className="grid gap-3 rounded-xl border p-4" onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            run({
              type: "part",
              jobId: selectedJob.id,
              partId: String(data.get("part")),
              qty: Number(data.get("qty"))
            });
          }}><Field label={c.parts}><select className={control} name="part">{state.parts.map(p => <option key={p.id} value={p.id}>{p.name} · {c.stock}: {p.stock}</option>)}</select></Field><div className="flex items-end gap-2"><Field label={c.count}><input className={control} name="qty" type="number" min="1" max="10000" step="1" defaultValue="1" required /></Field><Button variant="outline" className={action} disabled={disabled}>{c.consume}</Button></div></form><form className="grid gap-4" onSubmit={e => submit(e, data => ({
            type: "repair",
            jobId: selectedJob.id,
            note: String(data.get("note")),
            tested: data.get("tested") === "on"
          }))}><Field label={c.repairNote}><textarea className={`${control} h-24 py-3`} name="note" maxLength={2000} required /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="tested" required className="size-5 accent-green-700" />{c.tested}</label><Button className={action} disabled={disabled}><CheckCircle2 />{c.finish}</Button></form></>}
        {selectedJob.status === "repaired" && <div className="space-y-3"><p className="whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 text-sm">{selectedJob.repairNote}</p><p className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-primary" />{c.tested}</p>{!selectedJob.releasedAt && <><Button className={action} disabled={disabled || inspectionOverdue(assetFor(selectedJob.assetId), today)} onClick={() => {
              if (run({
                type: "release",
                jobId: selectedJob.id
              })) setModal(null);
            }}>{c.release}</Button>{inspectionOverdue(assetFor(selectedJob.assetId), today) && <p className="text-sm text-muted-foreground">{c.inspectionRequired}</p>}</>}</div>}
        {selectedJob.parts.length > 0 && <section className="border-t pt-4"><h3 className="mb-2 font-medium">{c.parts}</h3>{selectedJob.parts.map((p, i) => <p key={i} className="flex flex-wrap justify-between gap-2 text-sm">{p.qty} × {p.name}<span>{money(p.qty * p.unitCents)}</span></p>)}<p className="mt-3 flex flex-wrap justify-between gap-2 text-sm font-semibold">{c.cost}<span>{money(selectedJob.parts.reduce((n, p) => n + p.qty * p.unitCents, 0))}</span></p></section>}
        <Button asChild variant="outline" className={action}><Link href={`/demo/workshop?tab=documents&asset=${selectedJob.assetId}`}>{c.documents}</Link></Button><section className="border-t pt-4"><h3 className="mb-4 font-medium">{c.history}</h3>{events({
            ...assetFor(selectedJob.assetId),
            events: assetFor(selectedJob.assetId).events.filter(e => e.ref === selectedJob.id)
          })}</section></div>}
      {selectedAsset && modal?.type === "asset" && <div className="space-y-5">{assetStatus(selectedAsset)}<div className="flex flex-wrap gap-2"><Button className={action} variant="outline" disabled={disabled || !!activeJob(state, selectedAsset.id)} onClick={() => setModal({
            type: "receive",
            id: selectedAsset.id
          })}>{c.newJob}</Button>{selectedAsset.holder ? <Button className={action} disabled={disabled} onClick={() => {
            run({
              type: "return",
              assetId: selectedAsset.id
            });
          }}>{c.return}</Button> : <Button className={action} disabled={disabled || availability(state, selectedAsset, today) !== "available"} onClick={() => setModal({
            type: "issue",
            id: selectedAsset.id
          })}>{c.issue}</Button>}<Button className={action} variant="outline" disabled={disabled} onClick={() => setModal({
            type: "inspection",
            id: selectedAsset.id
          })}>{c.inspect}</Button></div><p className="text-sm text-muted-foreground">{c.location}: {selectedAsset.location}</p><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4" href={`/demo/workshop?tab=documents&asset=${selectedAsset.id}`}><FileText className="size-4" />{c.documents}</Link><h3 className="font-semibold">{c.history}</h3>{events(selectedAsset)}</div>}
      {selectedAsset && modal?.type === "issue" && <form className="grid gap-4" onSubmit={e => submit(e, data => ({
        type: "issue",
        assetId: selectedAsset.id,
        holder: String(data.get("holder"))
      }))}><Field label={c.holder}><input className={control} name="holder" maxLength={100} required placeholder="Jonas Becker" /></Field><Button className={action} disabled={disabled}>{c.issue}</Button></form>}
      {selectedAsset && modal?.type === "inspection" && <form className="grid gap-4" onSubmit={e => submit(e, data => ({
        type: "inspection",
        assetId: selectedAsset.id,
        date: String(data.get("date")),
        note: String(data.get("note"))
      }))}><p className="text-sm text-muted-foreground">{c.inspectHint}</p><Field label={c.inspection}><input className={control} type="date" name="date" min={workshopDay(today)} required /></Field><Field label={c.inspectionNote}><textarea className={`${control} h-24 py-3`} name="note" maxLength={2000} required /></Field><Button className={action} disabled={disabled}>{c.inspect}</Button></form>}
    </WorkshopDialog>
  </div>;
}
