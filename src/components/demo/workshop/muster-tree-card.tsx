"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, MoreHorizontal } from "lucide-react";
import { TreeArt } from "./tree-art";
import type { BotanicalSeason } from "@/lib/workshop/botanical";

export type TreeCardMode = "quick" | "detail" | "report" | "edit" | "equipment";

export function MusterTreeCard({ row, season, mode, busy, labels, children, onOpen, onTrigger }: {
  row: { treeId: string; species: string | null; status: string };
  season: BotanicalSeason;
  mode?: TreeCardMode;
  busy: boolean;
  labels: { species: string; done: string; openReport: string; ready: string; treeDetails: string };
  children?: ReactNode;
  onOpen: (mode: TreeCardMode) => void;
  onTrigger: (element: HTMLButtonElement | null) => void;
}) {
  const id = useId(), panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), held = useRef(false), start = useRef({ x: 0, y: 0 });
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!mode || !panel.current) return;
    const target = mode === "report" || mode === "edit" || mode === "equipment" ? panel.current.querySelector<HTMLElement>("textarea,input") : panel.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [mode]);
  const state = row.status === "done" ? labels.done : row.status === "blocked" ? labels.openReport : labels.ready;
  const Icon = row.status === "done" ? CheckCircle2 : row.status === "blocked" ? AlertTriangle : Clock3;
  return <article data-tree-status={row.status} data-tree-code={row.treeId} data-tree-card-mode={mode} className="baum-tree-card" aria-busy={busy}>
    <button ref={onTrigger} type="button" className="baum-tree-trigger" aria-label={`${row.treeId} · ${row.species || labels.species} · ${state}`} aria-expanded={Boolean(mode)} aria-controls={mode ? id : undefined} disabled={busy}
      onPointerDown={event => { if (event.button !== 0) return; held.current = false; start.current = { x: event.clientX, y: event.clientY }; clearTimeout(timer.current); timer.current = setTimeout(() => { held.current = true; onOpen("detail"); }, 550); }}
      onPointerMove={event => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) clearTimeout(timer.current); }}
      onPointerUp={() => clearTimeout(timer.current)} onPointerCancel={() => clearTimeout(timer.current)} onPointerLeave={() => clearTimeout(timer.current)}
      onClick={event => { if (event.detail === 0 || !held.current) onOpen("quick"); }} onContextMenu={event => { event.preventDefault(); clearTimeout(timer.current); held.current = true; onOpen("detail"); }}>
      <TreeArt species={row.species || ""} season={season} className="baum-tree-illustration" />
      <strong id={`${id}-name`}>{row.species || labels.species}</strong><span className="baum-tree-code">{row.treeId}</span>
    </button>
    <span className="baum-tree-state-symbol" aria-hidden="true"><Icon /></span>
    {<button hidden={Boolean(mode)} type="button" className="baum-tree-more" aria-label={`${labels.treeDetails} · ${row.treeId}`} disabled={busy} onClick={() => onOpen("detail")}><MoreHorizontal /></button>}
    {mode && <div ref={panel} id={id} role="region" aria-labelledby={`${id}-name`} tabIndex={-1} data-testid="muster-tree-inline" className="baum-tree-inline">{children}</div>}
  </article>;
}
