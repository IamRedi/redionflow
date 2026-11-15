"use client";

import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, Leaf, Pencil, RotateCcw, LayoutGrid, MapPin, X, Eye, BookOpenCheck } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { workshopCopy } from "@/lib/workshop/copy";
import { treeIdentity } from "@/lib/workshop/identity-art";
import { useWorkshopDemo, type DemoInventoryCommand } from "./use-workshop-demo";
import { action, control, Field, Status } from "./workshop-ui";
import { flowError } from "./custody-panels";
import { MusterTreeCard, type TreeCardMode } from "./muster-tree-card";
import type { TreeDetailMode } from "./muster-tree-details";
const MusterTreeDetails = dynamic(() => import("./muster-tree-details").then(module => module.MusterTreeDetails));
import { WindowedGrid } from "./windowed-grid";
const BotanicalStudio = dynamic(() => import("./botanical-studio").then(module => module.BotanicalStudio));
import type { BotanicalSeason } from "@/lib/workshop/botanical";
const SpeciesCard = dynamic(() => import("./species-card").then(module => module.SpeciesCard));
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
  const filterFocus = useRef<HTMLButtonElement>(null), dialogReturnRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<{ code: string; mode: TreeDetailMode } | null>(null);
  const [season, setSeason] = useState<BotanicalSeason>("summer"), [studioOpen, setStudioOpen] = useState(false), [atlasCode, setAtlasTarget] = useState<string | null>(null);
  const [studioLoaded, setStudioLoaded] = useState(false), [atlasLoaded, setAtlasLoaded] = useState(false);
  function setAtlasCode(code: string | null) { if (code) setAtlasLoaded(true); setAtlasTarget(code); }
  const [revealCode, setRevealCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ code: string; mode: TreeCardMode } | null>(null), [message, setMessage] = useState("");
  const triggers = useRef(new Map<string, HTMLButtonElement>()), opener = useRef<HTMLElement | null>(null), restoreFocusRef = useRef<{ code: string; target: HTMLElement | null } | null>(null);
  const rows = useMemo(() => items.map(tree => { const saved = state.custody.trees[treeIdentity(siteKey, tree.treeId)]; return { ...tree, ...(saved ? { status: saved.status, species: saved.species ?? tree.species, diameter: saved.diameter ?? tree.diameter } : {}), note: saved?.note ?? baseTreeNote(tree), equipment: saved?.equipment ?? baseEquipment(tree) }; }), [items, siteKey, state.custody.trees]);
  const done = useMemo(() => rows.filter(tree => tree.status === "done").length, [rows]);
  const visibleRows = useMemo(() => rows.filter(row => filter === "all" || (filter === "done" ? row.status === "done" : row.status !== "done")), [rows, filter]);
  const mapPoints = useMemo(() => { if (viewMode !== "map") return []; const lookup = new Map(visibleRows.map(row => [row.treeId, row.status])); return points.filter(point => lookup.has(point.treeId)).map(point => ({ ...point, status: lookup.get(point.treeId) || point.status })); }, [viewMode, visibleRows, points]);
  const tree = rows.find(t => t.treeId === (detail?.code || selected?.code)), disabled = !hydrated || pending || status !== "ready";
  function dismiss(code = selected?.code) {
    if (code) dialogReturnRef.current = triggers.current.get(code) || filterFocus.current;
    restoreFocusRef.current = code ? { code, target: opener.current } : null;
    setSelected(null); setDetail(null); setAtlasCode(null);
    requestAnimationFrame(() => { if (!code || !triggers.current.get(code)?.isConnected) { restoreFocusRef.current = null; filterFocus.current?.focus({ preventScroll: true }); } });
  }
  function open(code: string, mode: TreeCardMode) {
    if (mode === "detail" || mode === "edit" || mode === "equipment") {
      const focused = document.activeElement, trigger = triggers.current.get(code);
      dialogReturnRef.current = focused instanceof HTMLElement && trigger?.closest("article")?.contains(focused) ? focused : trigger || filterFocus.current;
      if (selected?.code !== code) { setSelected(null); opener.current = dialogReturnRef.current; }
      setMessage(""); setDetail({ code, mode }); setAtlasCode(null); setViewMode("list");
      if (viewMode === "map") setRevealCode(code);
      return;
    }
    setDetail(null);
    if (selected?.code === code && mode === "quick") { dismiss(code); return; }
    if (selected?.code !== code) { const trigger = triggers.current.get(code), focused = document.activeElement; opener.current = focused instanceof HTMLElement && trigger?.closest("article")?.contains(focused) ? focused : trigger ?? null; }
    setMessage(""); setAtlasCode(null); setSelected({ code, mode }); setViewMode("list");
    if (viewMode === "map") setRevealCode(code);
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
  const inlineContent = tree && selected && <div className="baum-tree-inline-body">
        <div className="baum-tree-card-tools"><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={atlas.open} title={atlas.open} onClick={() => setAtlasCode(tree.treeId)}><BookOpenCheck className="baum-tree-inspect-icon" data-tree-species-logo /></Button><span className="baum-tree-back-code">{tree.treeId}</span><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${c.close} · ${tree.treeId}`} title={c.close} data-tree-inline-close onClick={() => dismiss()}><X className="size-4" /></Button></div>
        {selected?.mode !== "report" && <div className="baum-tree-card-meta"><h3 className={`baum-tree-back-name ${treeNameFont.className}`}>{tree.species || c.species}</h3><Status tone={tree.status === "done" ? "green" : tree.status === "blocked" ? "amber" : "neutral"}>{tree.status === "done" ? c.done : tree.status === "blocked" ? c.openReport : c.ready}</Status>{selected?.mode !== "quick" && tree.diameter !== null && <p>{c.diameter}: <strong>{tree.diameter}</strong></p>}</div>}
        {tree.status === "blocked" && selected?.mode !== "report" && selected?.mode !== "quick" && <p className="rounded-xl border border-amber-600/40 bg-amber-500/5 p-3 text-sm">{tree.note || c.blocked}</p>}
        {selected?.mode === "quick" && <>{mainActions}<div className="baum-tree-secondary-actions"><Button type="button" variant="outline" size="icon" aria-label={c.treeDetails} title={c.treeDetails} onClick={() => open(tree.treeId, "detail")}><Eye /></Button>{actor.role === "admin" && <Button type="button" variant="outline" size="icon" aria-label={c.edit} title={c.edit} onClick={() => open(tree.treeId, "edit")}><Pencil /></Button>}</div></>}
        {selected?.mode === "report" && <form className="baum-tree-card-form" onSubmit={e => form(e, "report")}><Field label={c.reportNote}><textarea className={`${control} h-28 py-3`} name="note" required maxLength={2000} /></Field><Button className={`${action} w-full`} disabled={disabled}><AlertTriangle />{c.report}</Button></form>}
        {message && <p role="alert" className="rounded-xl border p-3 text-sm">{message}</p>}
      </div>;
  return <section className="baum-tree-workspace space-y-4" aria-label={c.trees}>
    <div className="baum-tree-toolbar">
      <div className="baum-tree-topline"><div className="baum-tree-filters" role="group" aria-label={c.status}>{([ ["all", copy.all, rows.length, Leaf], ["todo", copy.todo, rows.length - done, Clock3], ["done", copy.done, done, CheckCircle2] ] as const).map(([value, label, count, Icon]) => <Button key={value} ref={filter === value ? filterFocus : undefined} type="button" variant="outline" aria-pressed={filter === value} data-tree-filter={value} onClick={() => { setSelected(null); setMessage(""); setAtlasCode(null); setFilter(value); }}><Icon className="size-4 shrink-0" /><span>{label}</span><span className="baum-filter-count">{count}</span></Button>)}</div>
      </div>
      <div className="baum-tree-tools"><Button type="button" variant="outline" className={action} onClick={() => { setStudioLoaded(true); setStudioOpen(true); }}><Leaf className="size-4" />{studio.collection}</Button><select className="min-h-11 max-w-full rounded-xl border bg-card px-3 text-sm" aria-label={studio.seasonal} value={season} onChange={event => setSeason(event.target.value as BotanicalSeason)}><option value="summer">{studio.summer}</option><option value="autumn">{studio.autumn}</option><option value="winter">{studio.winter}</option></select><Button type="button" variant="outline" size="icon" className="baum-tree-view-toggle size-11 shrink-0" aria-label={viewMode === "list" ? copy.map : copy.list} title={viewMode === "list" ? copy.map : copy.list} onClick={() => { setSelected(null); setAtlasCode(null); setViewMode(value => value === "list" ? "map" : "list"); }}>{viewMode === "list" ? <MapPin className="size-4" /> : <LayoutGrid className="size-4" />}</Button><span className="sr-only">{done} / {items.length} {copy.progress}</span></div>
    </div>
    <p className="baum-tree-reference-caption text-center text-xs leading-relaxed text-muted-foreground">{studio.guide}</p>
    {studioLoaded && <BotanicalStudio open={studioOpen} onClose={()=>setStudioOpen(false)} />}
    {message && !selected && <p role="status" className="rounded-xl border bg-card p-3 text-sm">{message}</p>}
    {viewMode === "map" ? <MusterTreeMap points={mapPoints} onOpenTree={code => open(code, "detail")} /> : !visibleRows.length ? <p role="status" className="baum-site-empty">{copy.empty}</p> : <WindowedGrid key={filter} items={visibleRows} itemKey={row => row.treeId} label={c.trees} testId="muster-tree-grid" onNavigate={() => { restoreFocusRef.current = null; }} pinnedKeys={[selected?.code, detail?.code, atlasCode].filter((key): key is string => Boolean(key))} revealKey={revealCode} renderItem={row => <MusterTreeCard key={row.treeId} row={row} season={season} mode={selected?.code === row.treeId ? selected.mode : undefined} busy={pending} labels={c} restoreFocusRef={restoreFocusRef} inspectLabel={atlas.open} onInspect={() => setAtlasCode(row.treeId)} onOpen={mode => open(row.treeId, mode)} onTrigger={element => { if (element) { triggers.current.set(row.treeId, element); if (detail?.code === row.treeId && !dialogReturnRef.current?.isConnected) dialogReturnRef.current = element; } else triggers.current.delete(row.treeId); }}>{selected?.code === row.treeId ? inlineContent : null}</MusterTreeCard>} />}
    {tree && detail && <MusterTreeDetails key={tree.treeId} tree={tree} mode={detail.mode} season={season} events={state.custody.treeEvents.filter(e => e.siteKey === siteKey && e.treeCode === tree.treeId)} role={actor.role} disabled={disabled} message={message} actions={mainActions} returnFocus={dialogReturnRef} onMode={mode => { setMessage(""); setDetail({ code: tree.treeId, mode }); }} onClose={() => { setDetail(null); setMessage(""); }} onInspect={() => setAtlasCode(tree.treeId)} onSubmit={form} />}
    {atlasLoaded && <SpeciesCard fixed species={rows.find(row => row.treeId === atlasCode)?.species || ""} open={Boolean(atlasCode)} onClose={()=>setAtlasCode(null)} />}

  </section>;
}
