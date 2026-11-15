"use client";

import localFont from "next/font/local";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BookOpenCheck, Eye, Pencil, ShieldCheck, History, Leaf, Fence, Ruler, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { studioCopy } from "@/lib/workshop/studio-copy";
import { atlasCopy } from "@/lib/workshop/atlas";
import type { BotanicalSeason } from "@/lib/workshop/botanical";
import type { DemoActor } from "@/lib/workshop/custody-schema";
import { WorkshopDialog, Field, control, Status } from "./workshop-ui";
import { BotanicalReference } from "./botanical-studio";
import { TreeArt } from "./tree-art";
import { ReaderPager, ReaderText } from "./reader-pages";

const nameFont = localFont({ src: "../../branding/fonts/manrope-variable.ttf", weight: "200 800", display: "swap", preload: false, fallback: ["system-ui", "sans-serif"] });
export type TreeDetailMode = "detail" | "edit" | "equipment" | "history" | "botanical";
type Tree = { treeId: string; species: string | null; diameter: number | null; status: string; note: string; equipment: { SIGN: number; PLATE: number; FENCE: number; halt: boolean } };
type Event = { id: string; kind: string; at: string; note: string; actor: DemoActor };
export function MusterTreeDetails({ tree, mode, season, events, role, disabled, message, actions, returnFocus, onMode, onClose, onInspect, onSubmit }: {
  tree: Tree; mode: TreeDetailMode; season: BotanicalSeason; events: Event[]; role: DemoActor["role"]; disabled: boolean; message: string; actions: ReactNode;
  returnFocus: { current: HTMLElement | null }; onMode: (mode: TreeDetailMode) => void; onClose: () => void; onInspect: () => void; onSubmit: (event: FormEvent<HTMLFormElement>, action: "edit" | "equipment") => void;
}) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), s = studioCopy(currentLang), a = atlasCopy(currentLang);
  const body = useRef<HTMLDivElement>(null), [eventPage, setEventPage] = useState(0);
  useEffect(() => { if (mode === "edit" || mode === "equipment") body.current?.querySelector<HTMLElement>("input,textarea")?.focus({ preventScroll: true }); }, [mode]);
  const recent = events.slice(0, 30), index = Math.min(eventPage, Math.max(0, recent.length - 1)), event = recent[index];
  const tabs = [["detail", c.treeDetails, Eye], ["botanical", s.botanical, Leaf], ["equipment", c.safety, ShieldCheck], ["history", c.history, History], ...(role === "admin" ? [["edit", c.edit, Pencil] as const] : [])] as const;
  return <WorkshopDialog open centered wide title={tree.species || c.species} titleClassName={nameFont.className} description={`${tree.treeId} · ${c.treeDetails}`} className="baum-reader-dialog baum-tree-detail-dialog" closeLabel={c.close} returnFocus={returnFocus} onClose={onClose} onOpenAutoFocus={event => { if (mode === "edit" || mode === "equipment") { const field = body.current?.querySelector<HTMLElement>("input,textarea"); if (field) { event.preventDefault(); field.focus({ preventScroll: true }); } } }} headerLeading={<Button type="button" variant="ghost" size="icon" className="baum-site-back size-11" aria-label={a.open} title={a.open} onClick={onInspect}><BookOpenCheck /></Button>}>
    <nav className="baum-tree-detail-nav" style={{ gridTemplateColumns: `repeat(${tabs.length},minmax(0,1fr))` }} aria-label={c.treeDetails}>{tabs.map(([value, label, Icon]) => <Button type="button" key={value} variant="outline" aria-pressed={mode === value} aria-label={label} title={label} onClick={() => onMode(value as TreeDetailMode)}><Icon /><span>{label}</span></Button>)}</nav>
    <div ref={body} className="baum-tree-detail-body" data-testid="muster-tree-details" data-detail-mode={mode}>
      {mode === "detail" && <div className="baum-tree-detail-overview">
        <div className="baum-tree-detail-identity"><TreeArt species={tree.species || ""} season={season} className="baum-tree-detail-art" /><Status tone={tree.status === "done" ? "green" : tree.status === "blocked" ? "amber" : "neutral"}>{tree.status === "done" ? c.done : tree.status === "blocked" ? c.openReport : c.ready}</Status><div className="baum-tree-detail-metric"><Ruler /><span>{c.diameter}</span><strong>{tree.diameter ?? "—"}</strong></div></div>
        <div className="baum-tree-detail-information"><div className={`baum-tree-detail-note ${!tree.note ? "baum-tree-detail-note--empty" : ""}`}><h3><FileText />{c.note}</h3>{tree.note ? <ReaderText key={tree.note} text={tree.note} /> : <p className="text-sm text-muted-foreground">{c.empty}</p>}</div><div className="baum-tree-detail-equipment">{([ ["SIGN", c.signs], ["PLATE", c.plates], ["FENCE", c.fences] ] as const).map(([key, label]) => <div key={key}><Fence /><strong>{tree.equipment[key]}</strong><span>{label}</span></div>)}</div>{tree.equipment.halt && <Status tone="amber">{c.halt}</Status>}{actions}</div>
      </div>}
      {mode === "botanical" && <div className="baum-tree-detail-botanical"><BotanicalReference species={tree.species || ""} /></div>}
      {mode === "edit" && role === "admin" && <form className="baum-tree-detail-form" onSubmit={e => onSubmit(e, "edit")}><div className="baum-tree-detail-fields"><Field label={c.species}><input name="species" className={control} maxLength={100} defaultValue={tree.species || ""} /></Field><Field label={c.diameter}><input name="diameter" type="number" className={control} min={0} max={1000} step="0.1" defaultValue={tree.diameter ?? 0} /></Field></div><div className="baum-tree-detail-note-field"><Field label={c.note}><textarea name="note" className={control} maxLength={2000} defaultValue={tree.note} /></Field></div><Button disabled={disabled}><Pencil />{c.save}</Button>{message && <p role="alert">{message}</p>}</form>}
      {mode === "equipment" && <form className="baum-tree-detail-form baum-tree-safety-form" onSubmit={e => onSubmit(e, "equipment")}><div className="baum-tree-detail-fields">{([ ["SIGN", c.signs], ["PLATE", c.plates], ["FENCE", c.fences] ] as const).map(([key, label]) => <Field key={key} label={label}><input name={key} type="number" className={control} min={0} max={1000} step={1} required defaultValue={tree.equipment[key]} /></Field>)}</div><label className="baum-tree-detail-checkbox"><input type="checkbox" name="halt" defaultChecked={tree.equipment.halt} />{c.halt}</label><Button disabled={disabled}><ShieldCheck />{c.save}</Button>{message && <p role="alert">{message}</p>}</form>}
      {mode === "history" && <div className="baum-tree-detail-history">{event ? <><div className="baum-tree-event-heading"><History /><strong>{event.kind === "done" ? c.done : event.kind === "reopened" ? c.reopen : event.kind === "reported" ? c.report : event.kind === "equipment" ? c.safety : c.updated}</strong><p>{event.actor.name}</p><time dateTime={event.at}>{new Date(event.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })}</time><ReaderPager index={index} count={recent.length} onChange={setEventPage} /></div><ReaderText key={event.id} text={event.note || c.empty} /></> : <p>{c.noHistory}</p>}</div>}
    </div>
    {message && mode !== "edit" && mode !== "equipment" && <p role="alert" className="baum-reader-feedback">{message}</p>}
  </WorkshopDialog>;
}
