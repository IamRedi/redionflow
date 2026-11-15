"use client";

import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, Fence, Leaf, Pencil, RotateCcw, ShieldCheck, LayoutGrid, MapPin, X, Eye, BookOpenCheck } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import { treeIdentity } from "@/lib/workshop/identity-art";
import { useWorkshopDemo, type DemoInventoryCommand } from "./use-workshop-demo";
import { action, control, Field, Status } from "./workshop-ui";
import { flowError } from "./custody-panels";
import { MusterTreeCard, type TreeCardMode } from "./muster-tree-card";
import { BotanicalReference, BotanicalStudio } from "./botanical-studio";
import type { BotanicalSeason } from "@/lib/workshop/botanical";
import { SpeciesCard } from "./species-card";
import { atlasCopy } from "@/lib/workshop/atlas";
import { siteCardCopy } from "@/lib/workshop/site-card-copy";
import type { MusterTreePoint } from "./muster-tree-map";
const MusterTreeMap = dynamic(() => import("./muster-tree-map").then(module => module.MusterTreeMap), { ssr: false });
import { studioCopy } from "@/lib/workshop/studio-copy";

const treeNameFont = localFont({ src: "../../branding/fonts/manrope-variable.ttf", weight: "200 800", display: "swap", preload: false, fallback: ["system-ui", "sans-serif"] });

export type TreeCardItem = { id: string; treeId: string; species: string | null; diameter: number | null; status: string; notes: string | null; siteEquipmentStatus?: unknown };
export function baseTreeNote(tree: TreeCardItem) { try { const p = JSON.parse(tree.notes || "{}"); return typeof p.note === "string" ? p.note : ""; } catch { return tree.notes || ""; } }
function baseEquipment(tree: TreeCardItem) {
  const raw = tree.siteEquipmentStatus as Record<string, { quantity?: number }> | null;
  let halt = false; try { halt = Boolean(JSON.parse(tree.notes || "{}").haltverbot); } catch { /* Plain historical note. */ }
  return { SIGN: Math.max(0, Number(raw?.SIGN?.quantity || 0)), PLATE: Math.max(0, Number(raw?.PLATE?.quantity || 0)), FENCE: Math.max(0, Number(raw?.FENCE?.quantity || 0)), halt };
}
export function MusterTreeGrid({ items, siteKey, points = [], initialView = "list" }: { items: TreeCardItem[]; siteKey: string; points?: MusterTreePoint[]; initialView?: "list" | "map" }) {
  const { state, actor, hydrated, pending, status, dispatch } = useWorkshopDemo();
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), studio = studioCopy(currentLang), atlas = atlasCopy(currentLang), copy = siteCardCopy(currentLang);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all"), [viewMode, setViewMode] = useState(initialView);
  const filterFocus = useRef<HTMLButtonElement>(null);
  const [season, setSeason] = useState<BotanicalSeason>("summer"), [studioOpen, setStudioOpen] = useState(false), [atlasCode, setAtlasCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ code: string; mode: TreeCardMode } | null>(null), [message, setMessage] = useState("");
  const triggers = useRef(new Map<string, HTMLButtonElement>()), opener = useRef<HTMLElement | null>(null), restoreFocusRef = useRef<{ code: string; target: HTMLElement | null } | null>(null);
  const view = (tree: TreeCardItem) => { const saved = state.custody.trees[treeIdentity(siteKey, tree.treeId)]; return { ...tree, ...(saved ? { status: saved.status, species: saved.species ?? tree.species, diameter: saved.diameter ?? tree.diameter } : {}), note: saved?.note ?? baseTreeNote(tree), equipment: saved?.equipment ?? baseEquipment(tree) }; };
  const rows = items.map(view), done = rows.filter(t => t.status === "done").length;
  const visibleRows = rows.filter(row => filter === "all" || (filter === "done" ? row.status === "done" : row.status !== "done"));
  const visibleCodes = new Set(visibleRows.map(row => row.treeId));
  const mapPoints = points.filter(point => visibleCodes.has(point.treeId)).map(point => ({ ...point, status: rows.find(row => row.treeId === point.treeId)?.status || point.status }));
  const tree = rows.find(t => t.treeId === selected?.code), disabled = !hydrated || pending || status !== "ready";
  function dismiss(code = selected?.code) {
    restoreFocusRef.current = code ? { code, target: opener.current } : null;
    setSelected(null); setAtlasCode(null);
    requestAnimationFrame(() => { if (!code || !triggers.current.get(code)?.isConnected) { restoreFocusRef.current = null; filterFocus.current?.focus({ preventScroll: true }); } });
  }
  function open(code: string, mode: TreeCardMode) {
    if (selected?.code === code && mode === "quick") { dismiss(code); return; }
    if (selected?.code !== code) { const trigger = triggers.current.get(code), focused = document.activeElement; opener.current = focused instanceof HTMLElement && trigger?.closest("article")?.contains(focused) ? focused : trigger ?? null; }
    setMessage(""); setAtlasCode(null); setSelected({ code, mode }); setViewMode("list");
    if (viewMode === "map") requestAnimationFrame(() => triggers.current.get(code)?.scrollIntoView({ block: "nearest" }));
  }
  async function change(command: DemoInventoryCommand) { setMessage(""); try { await dispatch(command); dismiss(command.type === "tree" ? command.treeCode : undefined); setMessage(c.saved); } catch (e) { setMessage(flowError(e, c)); } }
  function form(e: FormEvent<HTMLFormElement>, actionName: "report" | "edit" | "equipment") {
    e.preventDefault(); if (!tree) return; const d = new FormData(e.currentTarget);
    void change({ type: "tree", siteKey, treeCode: tree.treeId, action: actionName, note: String(d.get("note") || ""), ...(actionName === "edit" ? { species: String(d.get("species")), diameter: Number(d.get("diameter")) } : {}), ...(actionName === "equipment" ? { equipment: { SIGN: Number(d.get("SIGN")), PLATE: Number(d.get("PLATE")), FENCE: Number(d.get("FENCE")), halt: d.get("halt") === "on" } } : {}) });
  }
  const mainActions = tree && <div className="baum-tree-actions">
    <Button className={`${action} flex-1`} disabled={disabled || (tree.status === "blocked" && actor.role !== "admin")} onClick={() => void change({ type: "tree", siteKey, treeCode: tree.treeId, action: tree.status === "done" || tree.status === "blocked" ? "reopen" : "done", note: "" })}>{tree.status === "todo" ? <Check /> : <RotateCcw />}<span>{tree.status === "todo" ? c.done : c.reopen}</span></Button>
    <Button variant="outline" className={`${action} flex-1`} disabled={disabled} onClick={() => open(tree.treeId, "report")}><AlertTriangle /><span>{c.report}</span></Button>
  </div>;
  const inlineContent = tree && <div className="baum-tree-inline-body">
        <div className="baum-tree-card-tools"><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={atlas.open} title={atlas.open} onClick={() => setAtlasCode(tree.treeId)}><BookOpenCheck className="baum-tree-inspect-icon" data-tree-species-logo /></Button><span className="baum-tree-back-code">{tree.treeId}</span><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${c.close} · ${tree.treeId}`} title={c.close} data-tree-inline-close onClick={() => dismiss()}><X className="size-4" /></Button></div>
        {selected?.mode !== "report" && <div className="baum-tree-card-meta"><h3 className={`baum-tree-back-name ${treeNameFont.className}`}>{tree.species || c.species}</h3><Status tone={tree.status === "done" ? "green" : tree.status === "blocked" ? "amber" : "neutral"}>{tree.status === "done" ? c.done : tree.status === "blocked" ? c.openReport : c.ready}</Status>{selected?.mode !== "quick" && tree.diameter !== null && <p>{c.diameter}: <strong>{tree.diameter}</strong></p>}</div>}
        {tree.status === "blocked" && selected?.mode !== "report" && selected?.mode !== "quick" && <p className="rounded-xl border border-amber-600/40 bg-amber-500/5 p-3 text-sm">{tree.note || c.blocked}</p>}
        {selected?.mode === "quick" && <>{mainActions}<div className="baum-tree-secondary-actions"><Button type="button" variant="outline" size="icon" aria-label={c.treeDetails} title={c.treeDetails} onClick={() => open(tree.treeId, "detail")}><Eye /></Button>{actor.role === "admin" && <Button type="button" variant="outline" size="icon" aria-label={c.edit} title={c.edit} onClick={() => open(tree.treeId, "edit")}><Pencil /></Button>}</div></>}
        {selected?.mode === "report" && <form className="baum-tree-card-form" onSubmit={e => form(e, "report")}><Field label={c.reportNote}><textarea className={`${control} h-28 py-3`} name="note" required maxLength={2000} /></Field><Button className={`${action} w-full`} disabled={disabled}><AlertTriangle />{c.report}</Button></form>}
        {selected?.mode === "edit" && <form className="baum-tree-card-form" onSubmit={e => form(e, "edit")}><Field label={c.species}><input name="species" className={control} maxLength={100} defaultValue={tree.species || ""} /></Field><Field label={c.diameter}><input type="number" min={0} max={1000} step="0.1" className={control} name="diameter" defaultValue={tree.diameter ?? 0} /></Field><Field label={c.note}><textarea name="note" className={`${control} h-24 py-3`} maxLength={2000} defaultValue={tree.note} /></Field><Button className={action} disabled={disabled}>{c.save}</Button></form>}
        {selected?.mode === "equipment" && <form className="baum-tree-card-form" onSubmit={e => form(e, "equipment")}>{([ ["SIGN",c.signs], ["PLATE",c.plates], ["FENCE",c.fences] ] as const).map(([key,label]) => <Field key={key} label={label}><input className={control} name={key} type="number" min={0} max={1000} step={1} required defaultValue={tree.equipment[key]} /></Field>)}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-green-700" name="halt" defaultChecked={tree.equipment.halt} />{c.halt}</label><Button className={action} disabled={disabled}>{c.save}</Button></form>}
        {selected?.mode === "detail" && <>
          {mainActions}
          <details className="rounded-xl border px-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><Leaf className="size-4 text-primary" />{studio.botanical}</summary><div className="pb-4"><BotanicalReference key={tree.treeId} species={tree.species || ""} /></div></details>
          {tree.note && tree.status !== "blocked" && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{tree.note}</p>}
          <div className="baum-tree-actions"><Button variant="outline" className={action} onClick={() => open(tree.treeId, "equipment")}><ShieldCheck />{c.safety}</Button>{actor.role === "admin" && <Button variant="outline" className={action} onClick={() => open(tree.treeId, "edit")}><Pencil />{c.edit}</Button>}</div>
          <div className="baum-tree-equipment-summary grid grid-cols-3 gap-2 text-center text-xs">{([ ["SIGN",c.signs], ["PLATE",c.plates], ["FENCE",c.fences] ] as const).map(([key,label]) => <div key={key} className="rounded-xl border bg-muted/20 p-3"><Fence className="mx-auto mb-2 size-4 text-primary" /><strong className="block text-base">{tree.equipment[key]}</strong><span className="mt-1 block break-words text-muted-foreground">{label}</span></div>)}</div>
          {tree.equipment.halt && <Status tone="amber">{c.halt}</Status>}
          <details className="rounded-xl border p-3"><summary className="flex min-h-11 cursor-pointer items-center font-medium text-sm">{c.history}</summary><ol className="space-y-3">{state.custody.treeEvents.filter(e => e.siteKey === siteKey && e.treeCode === tree.treeId).slice(0, 30).map(e => <li key={e.id} className="border-l-2 border-primary/25 pl-3 text-sm"><strong>{e.kind === "done" ? c.done : e.kind === "reopened" ? c.reopen : e.kind === "reported" ? c.report : e.kind === "equipment" ? c.safety : c.updated}</strong><p className="mt-1 text-xs text-muted-foreground">{e.actor.name} · {new Date(e.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })}</p>{e.note && <p className="mt-1 break-words text-sm">{e.note}</p>}</li>)}</ol></details>
        </>}
        {message && <p role="alert" className="rounded-xl border p-3 text-sm">{message}</p>}
      </div>;
  return <section className="baum-tree-workspace space-y-4" aria-label={c.trees}>
    <div className="baum-tree-toolbar">
      <div className="baum-tree-topline"><div className="baum-tree-filters" role="group" aria-label={c.status}>{([ ["all", copy.all, rows.length, Leaf], ["todo", copy.todo, rows.length - done, Clock3], ["done", copy.done, done, CheckCircle2] ] as const).map(([value, label, count, Icon]) => <Button key={value} ref={filter === value ? filterFocus : undefined} type="button" variant="outline" aria-pressed={filter === value} data-tree-filter={value} onClick={() => { setSelected(null); setMessage(""); setAtlasCode(null); setFilter(value); }}><Icon className="size-4 shrink-0" /><span>{label}</span><span className="baum-filter-count">{count}</span></Button>)}</div>
      </div>
      <div className="baum-tree-tools"><Button type="button" variant="outline" className={action} onClick={() => setStudioOpen(true)}><Leaf className="size-4" />{studio.collection}</Button><select className="min-h-11 max-w-full rounded-xl border bg-card px-3 text-sm" aria-label={studio.seasonal} value={season} onChange={event => setSeason(event.target.value as BotanicalSeason)}><option value="summer">{studio.summer}</option><option value="autumn">{studio.autumn}</option></select><Button type="button" variant="outline" size="icon" className="baum-tree-view-toggle size-11 shrink-0" aria-label={viewMode === "list" ? copy.map : copy.list} title={viewMode === "list" ? copy.map : copy.list} onClick={() => { setSelected(null); setAtlasCode(null); setViewMode(value => value === "list" ? "map" : "list"); }}>{viewMode === "list" ? <MapPin className="size-4" /> : <LayoutGrid className="size-4" />}</Button><span className="sr-only">{done} / {items.length} {copy.progress}</span></div>
    </div>
    <p className="text-center text-xs leading-relaxed text-muted-foreground">{c.treeHint}</p>
    <BotanicalStudio open={studioOpen} onClose={()=>setStudioOpen(false)} />
    {message && !selected && <p role="status" className="rounded-xl border bg-card p-3 text-sm">{message}</p>}
    {viewMode === "map" ? <MusterTreeMap points={mapPoints} onOpenTree={code => open(code, "detail")} /> : !visibleRows.length ? <p role="status" className="baum-site-empty">{copy.empty}</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="muster-tree-grid">{visibleRows.map(row => <MusterTreeCard key={row.treeId} row={row} season={season} mode={selected?.code === row.treeId ? selected.mode : undefined} busy={pending} labels={c} restoreFocusRef={restoreFocusRef} inspectLabel={atlas.open} onInspect={() => setAtlasCode(row.treeId)} onOpen={mode => open(row.treeId, mode)} onTrigger={element => { if (element) triggers.current.set(row.treeId, element); else triggers.current.delete(row.treeId); }}>{selected?.code === row.treeId ? inlineContent : null}</MusterTreeCard>)}</div>}
    <SpeciesCard species={rows.find(row => row.treeId === atlasCode)?.species || ""} open={Boolean(atlasCode)} onClose={()=>setAtlasCode(null)} />

  </section>;
}
