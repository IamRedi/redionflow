"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, Fence, Leaf, MoreHorizontal, Pencil, RotateCcw, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import { treeIdentity } from "@/lib/workshop/identity-art";
import { useWorkshopDemo, type DemoInventoryCommand } from "./use-workshop-demo";
import { action, control, Field, Status, WorkshopDialog } from "./workshop-ui";
import { flowError } from "./custody-panels";
import { TreeArt } from "./tree-art";
import { BotanicalReference, BotanicalStudio } from "./botanical-studio";
import type { BotanicalSeason } from "@/lib/workshop/botanical";
import { studioCopy } from "@/lib/workshop/studio-copy";

export type TreeCardItem = { id: string; treeId: string; species: string | null; diameter: number | null; status: string; notes: string | null; siteEquipmentStatus?: unknown };
export function baseTreeNote(tree: TreeCardItem) { try { const p = JSON.parse(tree.notes || "{}"); return typeof p.note === "string" ? p.note : ""; } catch { return tree.notes || ""; } }
function baseEquipment(tree: TreeCardItem) {
  const raw = tree.siteEquipmentStatus as Record<string, { quantity?: number }> | null;
  let halt = false; try { halt = Boolean(JSON.parse(tree.notes || "{}").haltverbot); } catch { /* Plain historical note. */ }
  return { SIGN: Math.max(0, Number(raw?.SIGN?.quantity || 0)), PLATE: Math.max(0, Number(raw?.PLATE?.quantity || 0)), FENCE: Math.max(0, Number(raw?.FENCE?.quantity || 0)), halt };
}
export function MusterTreeGrid({ items, siteKey }: { items: TreeCardItem[]; siteKey: string }) {
  const { state, actor, hydrated, pending, status, dispatch } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), studio = studioCopy(currentLang);
  const [season, setSeason] = useState<BotanicalSeason>("summer"), [studioOpen, setStudioOpen] = useState(false);
  const [selected, setSelected] = useState<{ code: string; mode: "quick" | "detail" | "report" | "edit" | "equipment" } | null>(null), [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), held = useRef(false), start = useRef({ x: 0, y: 0 });
  useEffect(() => () => clearTimeout(timer.current), []);
  const view = (tree: TreeCardItem) => { const saved = state.custody.trees[treeIdentity(siteKey, tree.treeId)]; return { ...tree, ...(saved ? { status: saved.status, species: saved.species ?? tree.species, diameter: saved.diameter ?? tree.diameter } : {}), note: saved?.note ?? baseTreeNote(tree), equipment: saved?.equipment ?? baseEquipment(tree) }; };
  const rows = items.map(view), done = rows.filter(t => t.status === "done").length;
  const tree = rows.find(t => t.treeId === selected?.code), disabled = !hydrated || pending || status !== "ready";
  function open(code: string, mode: NonNullable<typeof selected>["mode"]) { setMessage(""); setSelected({ code, mode }); }
  async function change(command: DemoInventoryCommand) { setMessage(""); try { await dispatch(command); setSelected(null); setMessage(c.saved); } catch (e) { setMessage(flowError(e, c)); } }
  function form(e: FormEvent<HTMLFormElement>, actionName: "report" | "edit" | "equipment") {
    e.preventDefault(); if (!tree) return; const d = new FormData(e.currentTarget);
    void change({ type: "tree", siteKey, treeCode: tree.treeId, action: actionName, note: String(d.get("note") || ""), ...(actionName === "edit" ? { species: String(d.get("species")), diameter: Number(d.get("diameter")) } : {}), ...(actionName === "equipment" ? { equipment: { SIGN: Number(d.get("SIGN")), PLATE: Number(d.get("PLATE")), FENCE: Number(d.get("FENCE")), halt: d.get("halt") === "on" } } : {}) });
  }
  const mainActions = tree && <div className="flex flex-wrap gap-2">
    <Button className={`${action} flex-1`} disabled={disabled || (tree.status === "blocked" && actor.role !== "admin")} onClick={() => void change({ type: "tree", siteKey, treeCode: tree.treeId, action: tree.status === "done" || tree.status === "blocked" ? "reopen" : "done", note: "" })}>{tree.status === "todo" ? <Check /> : <RotateCcw />}{tree.status === "todo" ? c.done : c.reopen}</Button>
    <Button variant="outline" className={`${action} flex-1`} disabled={disabled} onClick={() => open(tree.treeId, "report")}><AlertTriangle />{c.report}</Button>
  </div>;
  return <section className="space-y-4" aria-label={c.trees}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{c.trees}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.treeHint}</p></div><div className="flex items-center gap-3 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-primary" /><span>{done} / {items.length}</span><progress aria-label={c.status} max={Math.max(1, items.length)} value={done} className="h-1.5 w-20 accent-green-700" /></div></div>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className={action} onClick={()=>setStudioOpen(true)}><Leaf />{studio.collection}</Button><select className="min-h-11 max-w-full rounded-xl border bg-card px-3 text-sm" aria-label={studio.seasonal} value={season} onChange={e=>setSeason(e.target.value as BotanicalSeason)}><option value="summer">{studio.summer}</option><option value="autumn">{studio.autumn}</option></select></div>
    <BotanicalStudio open={studioOpen} onClose={()=>setStudioOpen(false)} />
    {message && !selected && <p role="status" className="rounded-xl border bg-card p-3 text-sm">{message}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="muster-tree-grid">{rows.map(row => <article key={row.treeId} className={`relative min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors ${row.status === "done" ? "border-primary/35 bg-primary/5" : row.status === "blocked" ? "border-amber-600/40" : ""}`}>
      <button className="flex min-h-44 w-full touch-manipulation flex-col items-center justify-center px-3 pb-3 pt-6 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring" aria-label={`${row.treeId} · ${row.species || c.species} · ${row.status === "done" ? c.done : row.status === "blocked" ? c.openReport : c.ready}`} onPointerDown={e => { if (e.button !== 0) return; held.current = false; start.current = { x: e.clientX, y: e.clientY }; clearTimeout(timer.current); timer.current = setTimeout(() => { held.current = true; open(row.treeId, "detail"); }, 550); }} onPointerMove={e => { if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clearTimeout(timer.current); }} onPointerUp={() => clearTimeout(timer.current)} onPointerCancel={() => clearTimeout(timer.current)} onPointerLeave={() => clearTimeout(timer.current)} onClick={e => { if (e.detail === 0 || !held.current) open(row.treeId, "quick"); }} onContextMenu={e => { e.preventDefault(); clearTimeout(timer.current); held.current = true; open(row.treeId, "detail"); }}>
        <TreeArt species={row.species || ""} season={season} className="h-24 w-28 max-w-full" /><strong className="mt-2 line-clamp-2 min-h-9 text-sm leading-snug">{row.species || c.species}</strong><span className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">{row.treeId}</span>
      </button>
      <span className="pointer-events-none absolute left-2 top-2 text-primary" aria-hidden="true">{row.status === "done" ? <CheckCircle2 className="size-4" /> : row.status === "blocked" ? <AlertTriangle className="size-4 text-amber-600" /> : <Clock3 className="size-4 text-muted-foreground" />}</span>
      <button className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2" aria-label={`${c.treeDetails} · ${row.treeId}`} onClick={() => open(row.treeId, "detail")}><MoreHorizontal className="size-4" /></button>
    </article>)}</div>
    <WorkshopDialog open={Boolean(tree)} title={tree ? `${tree.species || c.species} · ${tree.treeId}` : c.treeDetails} description={selected?.mode === "quick" ? c.next : c.treeDetails} closeLabel={c.close} onClose={() => setSelected(null)}>
      {tree && <div className="space-y-4">
        <div className="flex items-center gap-4"><TreeArt species={tree.species || ""} className="h-20 w-24 shrink-0" /><div><Status tone={tree.status === "done" ? "green" : tree.status === "blocked" ? "amber" : "neutral"}>{tree.status === "done" ? c.done : tree.status === "blocked" ? c.openReport : c.ready}</Status>{tree.diameter !== null && <p className="mt-2 text-xs text-muted-foreground">{c.diameter}: {tree.diameter}</p>}</div></div>
        {tree.status === "blocked" && <p className="rounded-xl border border-amber-600/40 bg-amber-500/5 p-3 text-sm">{tree.note || c.blocked}</p>}
        {selected?.mode === "quick" && <>{mainActions}<Button variant="ghost" className={`${action} w-full`} onClick={() => open(tree.treeId, "detail")}>{c.treeDetails}</Button></>}
        {selected?.mode === "report" && <form className="space-y-4" onSubmit={e => form(e, "report")}><Field label={c.reportNote}><textarea className={`${control} h-28 py-3`} name="note" required maxLength={2000} /></Field><Button className={`${action} w-full`} disabled={disabled}><AlertTriangle />{c.report}</Button></form>}
        {selected?.mode === "edit" && <form className="space-y-4" onSubmit={e => form(e, "edit")}><Field label={c.species}><input name="species" className={control} maxLength={100} defaultValue={tree.species || ""} /></Field><Field label={c.diameter}><input type="number" min={0} max={1000} step="0.1" className={control} name="diameter" defaultValue={tree.diameter ?? 0} /></Field><Field label={c.note}><textarea name="note" className={`${control} h-24 py-3`} maxLength={2000} defaultValue={tree.note} /></Field><Button className={action} disabled={disabled}>{c.save}</Button></form>}
        {selected?.mode === "equipment" && <form className="space-y-4" onSubmit={e => form(e, "equipment")}>{([ ["SIGN",c.signs], ["PLATE",c.plates], ["FENCE",c.fences] ] as const).map(([key,label]) => <Field key={key} label={label}><input className={control} name={key} type="number" min={0} max={1000} step={1} required defaultValue={tree.equipment[key]} /></Field>)}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-green-700" name="halt" defaultChecked={tree.equipment.halt} />{c.halt}</label><Button className={action} disabled={disabled}>{c.save}</Button></form>}
        {selected?.mode === "detail" && <>
          {mainActions}
          <details className="rounded-xl border px-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><Leaf className="size-4 text-primary" />{studio.botanical}</summary><div className="pb-4"><BotanicalReference key={tree.treeId} species={tree.species || ""} /></div></details>
          {tree.note && tree.status !== "blocked" && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{tree.note}</p>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" className={action} onClick={() => open(tree.treeId, "equipment")}><ShieldCheck />{c.safety}</Button>{actor.role === "admin" && <Button variant="outline" className={action} onClick={() => open(tree.treeId, "edit")}><Pencil />{c.edit}</Button>}</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">{([ ["SIGN",c.signs], ["PLATE",c.plates], ["FENCE",c.fences] ] as const).map(([key,label]) => <div key={key} className="rounded-xl border bg-muted/20 p-3"><Fence className="mx-auto mb-2 size-4 text-primary" /><strong className="block text-base">{tree.equipment[key]}</strong><span className="mt-1 block break-words text-muted-foreground">{label}</span></div>)}</div>
          {tree.equipment.halt && <Status tone="amber">{c.halt}</Status>}
          <details className="rounded-xl border p-3"><summary className="flex min-h-11 cursor-pointer items-center font-medium text-sm">{c.history}</summary><ol className="space-y-3">{state.custody.treeEvents.filter(e => e.siteKey === siteKey && e.treeCode === tree.treeId).slice(0, 30).map(e => <li key={e.id} className="border-l-2 border-primary/25 pl-3 text-sm"><strong>{e.kind === "done" ? c.done : e.kind === "reopened" ? c.reopen : e.kind === "reported" ? c.report : e.kind === "equipment" ? c.safety : c.updated}</strong><p className="mt-1 text-xs text-muted-foreground">{e.actor.name} · {new Date(e.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })}</p>{e.note && <p className="mt-1 break-words text-sm">{e.note}</p>}</li>)}</ol></details>
        </>}
        {message && <p role="alert" className="rounded-xl border p-3 text-sm">{message}</p>}
      </div>}
    </WorkshopDialog>
  </section>;
}
