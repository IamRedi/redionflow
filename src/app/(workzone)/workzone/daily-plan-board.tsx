"use client";

import { Check, HardHat, Loader2, MapPin, Pencil, Plus, Search, Truck, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { AssetOperationalStatusBadge } from '@/components/company-assets/shared';
import { assetCopy } from '@/components/company-assets/copy';
import { useMapOperationalStatuses } from './workzone-map-fleet';
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";
import {
  clearDailyPlanAction,
  moveDailyPlanItemAction,
  removeDailyPlanItemAction,
  saveDailyPlanAction,
  updateDailyPlanColumnNoteAction,
} from "./daily-plan-actions";
import { planCopy } from "./plan/plan-copy";
import { SavedPlanList, type SavedPlanRow } from "./plan/saved-plan";
import { planMachineLabel, planMachineName } from '@/lib/workzone/plan-machine-label';
import { Initials, shortName } from "./plan/initials";

type DraggableWorker = { id: string; name: string; licenses: string | null; availability: string; hasApprovedVacation: boolean };
type DraggableMachine = { id: string; name: string; targe?: string | null; requiredLicense: string | null; isActive: boolean };
type Assignment = { id: string; kind: "WORKER" | "MACHINE"; labelSnapshot: string; workerId: string | null; machineId: string | null };
type Column = {
  id: string;
  title: string;
  note: string | null;
  baustelleId: string | null;
  assignments: Assignment[];
};
type Picked = { kind: "WORKER" | "MACHINE"; id: string; name: string };
type PendingPlanConfirmation = { columnId: string; item: Picked; message: string; rest: Picked[] };

function licenseTokens(value: string | null) {
  return new Set(
    (value ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function columnLicenseWarnings(column: Column, workers: DraggableWorker[], machines: DraggableMachine[], lang: string) {
  const workerIds = new Set(column.assignments.filter((item) => item.kind === "WORKER").map((item) => item.workerId).filter(Boolean));
  const machineIds = new Set(column.assignments.filter((item) => item.kind === "MACHINE").map((item) => item.machineId).filter(Boolean));
  const columnWorkers = workers.filter((worker) => workerIds.has(worker.id));
  const columnMachines = machines.filter((machine) => machineIds.has(machine.id));
  const requirements = new Map<string, string[]>();

  for (const machine of columnMachines) {
    for (const token of licenseTokens(machine.requiredLicense)) {
      requirements.set(token, [...(requirements.get(token) ?? []), machine.name]);
    }
  }

  const warnings: string[] = [];
  for (const [token, machineNames] of requirements) {
    const capableWorkers = columnWorkers.filter((worker) => licenseTokens(worker.licenses).has(token));
    if (capableWorkers.length === 0) {
      warnings.push(`${t("workzone.noMatchingLicense", lang)} ${token} ${t("workzone.for", lang)} ${machineNames.join(", ")}.`);
    } else if (machineNames.length > capableWorkers.length) {
      warnings.push(`${machineNames.length} ${t("workzone.machinesNeedLicense", lang)} ${token}, ${t("workzone.butOnly", lang)} ${capableWorkers.length} ${t("workzone.workersHaveLicense", lang)} ${token}.`);
    }
  }

  return warnings;
}

/** "Kantieri Demo Durrës" → "Kantieri": enough to recognise the site on a small card. */
const firstWord = (name: string) => name.trim().split(/[\s,–-]+/).find(Boolean) ?? name;

const rowKey = (row: { workerNames: string; machineNames: string; baustelleName: string; note: string | null }) =>
  [row.baustelleName.trim(), row.workerNames.trim(), row.machineNames.trim(), row.note?.trim() ?? ""].join("|");
const hasContent = (row: { workerNames: string; machineNames: string; note: string | null }) => Boolean(row.workerNames.trim() || row.machineNames.trim() || row.note?.trim());

/**
 * The daily plan editor (admins and people with "Vepron" on the daily plan).
 * Pick a worker or a machine on the left, then tap the site it works at
 * today. Save publishes the plan: that saved version is what workers see.
 */
export function DailyPlanBoard({
  date,
  columns,
  workers,
  machines,
  savedRows,
}: {
  date: string;
  columns: Column[];
  workers: DraggableWorker[];
  machines: DraggableMachine[];
  baustellen?: Array<{ id: string; name: string }>;
  savedRows: SavedPlanRow[];
  showCurrentVersionHint?: boolean;
}) {
  const { currentLang } = useLanguage();
  const c = planCopy(currentLang);
  const operational = useMapOperationalStatuses();
  const assets = assetCopy(currentLang);
  const [message, setMessage] = useState<string>();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [tab, setTab] = useState<"WORKER" | "MACHINE">("WORKER");
  const [query, setQuery] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingPlanConfirmation | null>(null);
  const [noteFor, setNoteFor] = useState<Column | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [askClear, setAskClear] = useState(false);
  const [isPending, startTransition] = useTransition();
  // "+ Shto" on a site: pick several free people/machines at once.
  const [addTo, setAddTo] = useState<Column | null>(null);
  const [addTab, setAddTab] = useState<"WORKER" | "MACHINE">("WORKER");
  const [addQuery, setAddQuery] = useState("");
  const [addSel, setAddSel] = useState<Picked[]>([]);

  const siteOfWorker = useMemo(() => new Map(columns.flatMap((column) => column.assignments.filter((a) => a.workerId).map((a) => [a.workerId as string, column.title] as const))), [columns]);
  const siteOfMachine = useMemo(() => new Map(columns.flatMap((column) => column.assignments.filter((a) => a.machineId).map((a) => [a.machineId as string, column.title] as const))), [columns]);
  const machineById = useMemo(() => new Map(machines.map(machine => [machine.id, machine])), [machines]);
  const freeWorkers = workers.filter((worker) => !siteOfWorker.has(worker.id)).length;
  const freeMachines = machines.filter((machine) => !siteOfMachine.has(machine.id)).length;

  // Saved = what workers see. Compare it with the board to show unsaved changes.
  const boardRows = columns.map((column) => ({
    baustelleName: column.title,
    workerNames: column.assignments.filter((a) => a.kind === "WORKER").map((a) => a.labelSnapshot).join(", "),
    machineNames: column.assignments.filter((a) => a.kind === "MACHINE").map((a) => a.machineId && machineById.has(a.machineId) ? planMachineLabel(machineById.get(a.machineId)!) : a.labelSnapshot).join(", "),
    note: column.note,
  })).filter(hasContent).map(rowKey).sort();
  const savedKeys = savedRows.filter(hasContent).map(rowKey).sort();
  const dirty = boardRows.join("\n") !== savedKeys.join("\n");
  const neverSaved = savedRows.length === 0;

  const needle = query.trim().toLocaleLowerCase();
  // Free ones first, then the ones already placed today.
  const placed = tab === "WORKER" ? siteOfWorker : siteOfMachine;
  const list = (tab === "WORKER" ? workers : machines)
    .filter((entry) => !needle || `${entry.name} ${'targe' in entry ? entry.targe ?? '' : ''}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) => Number(placed.has(a.id)) - Number(placed.has(b.id)));

  function assign(columnId: string, item: Picked, force = false) {
    startTransition(async () => {
      const result = await moveDailyPlanItemAction({ date, columnId, kind: item.kind, itemId: item.id, force, lang: currentLang });
      if (result.requiresConfirmation && result.warningMessage) {
        setPendingConfirmation({ columnId, item, message: result.warningMessage, rest: [] });
      } else if (!result.ok) {
        setMessage(result.message);
      } else {
        setMessage(undefined);
      }
      setPicked(null);
    });
  }

  /** Places several items on one site in order; stops at a warning and continues after the answer. */
  function assignMany(columnId: string, items: Picked[], firstForce = false) {
    startTransition(async () => {
      for (const [index, item] of items.entries()) {
        const result = await moveDailyPlanItemAction({ date, columnId, kind: item.kind, itemId: item.id, force: firstForce && index === 0, lang: currentLang });
        if (result.requiresConfirmation && result.warningMessage) {
          setPendingConfirmation({ columnId, item, message: result.warningMessage, rest: items.slice(index + 1) });
          return;
        }
        if (!result.ok) { setMessage(result.message); return; }
      }
      setMessage(undefined);
      setPicked(null);
    });
  }

  function openAdd(column: Column) { setAddTo(column); setAddTab("WORKER"); setAddQuery(""); setAddSel([]); }
  const assignmentOf = (item: Picked) => columns.flatMap((column) => column.assignments).find((a) => (item.kind === "WORKER" ? a.workerId : a.machineId) === item.id);

  function remove(assignmentId: string) {
    startTransition(async () => {
      const result = await removeDailyPlanItemAction({ date, assignmentId, lang: currentLang });
      setMessage(result.ok ? undefined : result.message);
    });
  }

  const chip = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold shadow-sm transition disabled:opacity-50";

  return (
    <div className="space-y-4" data-testid="daily-plan-editor">
      {/* Status and the two actions. */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:flex-nowrap max-lg:rounded-b-none max-lg:rounded-t-3xl max-lg:border-x-0 max-lg:border-b-0 max-lg:bg-card/95 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-8px_24px_rgb(0_0_0/0.08)] max-lg:backdrop-blur" data-testid="plan-actions">
        <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${neverSaved ? "bg-muted text-muted-foreground" : dirty ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"}`} data-testid="plan-status">
          {neverSaved ? c.notSaved : dirty ? c.unsaved : <><Check className="size-3.5" />{c.saved}</>}
        </span>
        {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
        {message ? <span role="status" className="min-w-0 truncate text-xs text-red-700 dark:text-red-300">{message}</span> : null}
        <div className="ml-auto flex shrink-0 gap-2">
          <button type="button" onClick={() => setAskClear(true)} disabled={isPending} className={`${chip} bg-card hover:bg-muted`}>{c.clear}</button>
          <button
            type="button"
            onClick={() => startTransition(async () => {
              const result = await saveDailyPlanAction({ date, lang: currentLang });
              setMessage(result.ok ? undefined : result.message);
            })}
            disabled={isPending}
            className={`${chip} border-orange-700 bg-orange-600 text-white hover:bg-orange-700 dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950`}
            data-testid="plan-save"
          >
            {c.save}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* People and machines to place. */}
        <section className="rounded-2xl border bg-card p-3 shadow-sm max-lg:hidden lg:sticky lg:top-4">
          <div role="tablist" className="grid grid-cols-2 overflow-hidden rounded-xl border text-sm font-semibold">
            {(["WORKER", "MACHINE"] as const).map((kind) => (
              <button key={kind} type="button" role="tab" aria-selected={tab === kind} onClick={() => { setTab(kind); setQuery(""); }}
                className={`min-h-11 px-2 ${tab === kind ? "bg-orange-600 text-white dark:bg-orange-500 dark:text-slate-950" : "hover:bg-muted"}`}>
                {kind === "WORKER" ? c.workers : c.machines}
                <span className="ml-1 text-xs font-medium opacity-80">· {kind === "WORKER" ? freeWorkers : freeMachines} {c.free}</span>
              </button>
            ))}
          </div>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} aria-label={c.search}
              className="min-h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
          </label>
          <p className="mt-3 text-xs text-muted-foreground">{c.step}</p>
          <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:max-h-[calc(100vh-17rem)] lg:grid-cols-1 lg:overflow-y-auto lg:pr-0.5" data-testid="plan-pick-list">
            {list.length === 0 ? <li className="col-span-full py-3 text-sm text-muted-foreground">{c.noMatch}</li> : null}
            {list.map((entry) => {
              const isWorker = tab === "WORKER";
              const worker = isWorker ? (entry as DraggableWorker) : null;
              const machine = isWorker ? null : (entry as DraggableMachine);
              const site = isWorker ? siteOfWorker.get(entry.id) : siteOfMachine.get(entry.id);
              const needsOk = worker ? worker.availability !== "AVAILABLE" || worker.hasApprovedVacation : machine ? !operational?.enabled && !machine.isActive : false;
              const active = picked?.kind === tab && picked.id === entry.id;
              const sub = worker?.licenses ?? machine?.requiredLicense ?? null;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setPicked({ kind: tab, id: entry.id, name: machine ? planMachineLabel(machine) : entry.name })}
                    onClick={() => setPicked(active ? null : { kind: tab, id: entry.id, name: machine ? planMachineLabel(machine) : entry.name })}
                    aria-pressed={active}
                    className={`flex min-h-12 w-full flex-col justify-center gap-1 rounded-xl border px-2.5 py-1.5 text-left text-sm shadow-sm transition active:scale-[0.98] ${
                      active ? "border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950"
                        : site ? "border-orange-500/25 bg-orange-500/[0.06] hover:bg-orange-500/10"
                          : "bg-card hover:border-orange-400 hover:bg-orange-500/5"
                    }`}
                  >
                    <span className="flex w-full min-w-0 flex-col items-start gap-1 lg:flex-row lg:items-center lg:gap-1.5">
                      <span className="flex w-full min-w-0 items-center gap-1.5 lg:w-auto lg:flex-1">
                        {needsOk ? <span className="size-2 shrink-0 rounded-full bg-sky-500" title={c.needsOk} aria-label={c.needsOk} /> : null}
                        <span className="min-w-0 truncate font-medium" title={entry.name}>{machine ? planMachineName(machine) : entry.name}</span>
                        {machine?.targe ? <span className={`ml-auto shrink-0 font-mono text-[10px] tracking-tight ${active ? 'text-current' : 'text-muted-foreground'}`}>{machine.targe}</span> : null}
                      </span>
                      {site ? (
                        <span className={`inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full lg:max-w-[45%] px-1.5 py-0.5 text-[11px] font-semibold ${active ? "bg-white/20" : "bg-orange-500/15 text-orange-800 dark:text-orange-200"}`} title={site} data-testid="plan-pick-site">
                          <MapPin className="size-3 shrink-0" aria-hidden /><span className="truncate">{firstWord(site)}</span>
                        </span>
                      ) : sub ? <span className={`shrink-0 rounded-md border px-1 text-[10px] font-semibold leading-4 ${active ? "border-white/40" : "text-muted-foreground"}`} title={sub}>{sub}</span> : null}
                    </span>
                    {machine && operational?.enabled ? <AssetOperationalStatusBadge status={operational.statusFor(machine.id)} c={assets} compact /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Sites of the day. */}
        <section className="min-w-0 space-y-3">
          {/* Phone/tablet: who is still free, as one swipeable strip instead of a long list. */}
          <div className="rounded-2xl border bg-card p-3 shadow-sm lg:hidden" data-testid="plan-free-strip">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex size-2 rounded-full bg-emerald-500" aria-hidden />
              {c.freeNow}
              <span className="ml-auto inline-flex items-center gap-3 text-xs font-medium tabular-nums text-muted-foreground">
                <span className="inline-flex items-center gap-1"><HardHat className="size-3.5" aria-label={c.workers} />{freeWorkers}</span>
                <span className="inline-flex items-center gap-1"><Truck className="size-3.5" aria-label={c.machines} />{freeMachines}</span>
              </span>
            </div>
            {freeWorkers + freeMachines === 0 ? <p className="mt-2 text-xs text-muted-foreground">{c.allPlaced}</p> : (
              <ul className="-mx-3 mt-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[...workers.filter((w) => !siteOfWorker.has(w.id)).map((w) => ({ kind: "WORKER" as const, id: w.id, name: w.name, needsOk: w.availability !== "AVAILABLE" || w.hasApprovedVacation })),
                  ...machines.filter((m) => !siteOfMachine.has(m.id)).map((m) => ({ kind: "MACHINE" as const, id: m.id, name: planMachineLabel(m), needsOk: !operational?.enabled && !m.isActive }))].map((entry) => (
                  <li key={`${entry.kind}:${entry.id}`} className="shrink-0">
                    <button type="button" onClick={() => setPicked({ kind: entry.kind, id: entry.id, name: entry.name })} data-testid="plan-free-item"
                      className="flex min-h-12 items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3.5 text-sm font-medium shadow-sm transition active:scale-[0.97] hover:border-orange-400">
                      <Initials name={entry.name} machine={entry.kind === "MACHINE"} />
                      <span className="max-w-[9rem] truncate">{entry.kind === "WORKER" ? entry.name.split(" ")[0] : entry.name}</span>
                      {entry.needsOk ? <span className="size-2 shrink-0 rounded-full bg-sky-500" title={c.needsOk} aria-label={c.needsOk} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {picked ? (
            <div className="hidden items-center gap-2 rounded-2xl border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm lg:flex" role="status" data-testid="plan-picked">
              <span className="min-w-0 flex-1"><strong>{picked.name}</strong>: {c.picked}</span>
              <button type="button" onClick={() => setPicked(null)} className="min-h-9 shrink-0 rounded-lg border bg-card px-3 text-xs font-semibold hover:bg-muted">{c.cancel}</button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {columns.map((column) => {
              const warnings = columnLicenseWarnings(column, workers, machines, currentLang);
              const people = column.assignments.filter((a) => a.kind === "WORKER");
              const things = column.assignments.filter((a) => a.kind === "MACHINE");
              const filled = column.assignments.length > 0;
              return (
                <article
                  key={column.id}
                  data-testid="plan-site"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => { if (picked) assign(column.id, picked); }}
                  onClick={() => { if (picked) assign(column.id, picked); }}
                  className={`relative min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm transition ${picked ? "cursor-pointer border-dashed border-orange-500 hover:bg-orange-500/5" : ""} ${warnings.length ? "border-amber-500/60" : ""}`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${filled ? "bg-orange-500" : "bg-muted-foreground/20"}`} aria-hidden />
                  <header className="flex items-center gap-2 py-3 pl-4 pr-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${filled ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : "bg-muted text-muted-foreground"}`}><MapPin className="size-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold leading-tight" title={column.title}>{column.title}</h3>
                      <p className="mt-0.5 flex items-center gap-3 text-xs tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1" title={c.workers}><HardHat className="size-3.5" aria-label={c.workers} />{people.length}</span><span className="inline-flex items-center gap-1" title={c.machines}><Truck className="size-3.5" aria-label={c.machines} />{things.length}</span></p>
                    </div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setNoteDraft(column.note ?? ""); setNoteFor(column); }}
                      className="grid size-10 shrink-0 place-items-center rounded-xl border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${c.note}: ${column.title}`} title={c.note}>
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openAdd(column); }} disabled={isPending} data-testid="plan-site-add"
                      aria-label={`${c.addTo} ${column.title}`} title={`${c.addTo} ${column.title}`}
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-600 text-white shadow-sm hover:bg-orange-700 dark:bg-orange-500 dark:text-slate-950">
                      <Plus className="size-5" aria-hidden />
                    </button>
                  </header>
                  {column.note?.trim() ? <p className="mx-3 mb-2 ml-4 rounded-lg bg-muted px-2.5 py-1.5 text-xs">{column.note}</p> : null}
                  {warnings.length ? <div className="mx-3 mb-2 ml-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-100">{warnings.map((w) => <div key={w}>{w}</div>)}</div> : null}
                  {filled ? (
                    <ul className="grid grid-cols-2 gap-1.5 px-3 pb-3 pl-4">
                      {column.assignments.map((item) => {
                        const machine = item.kind === "MACHINE" && item.machineId ? machineById.get(item.machineId) : undefined;
                        const label = machine ? planMachineName(machine) : item.kind === "WORKER" ? shortName(item.labelSnapshot) : item.labelSnapshot;
                        const pick: Picked = { kind: item.kind, id: (item.kind === "WORKER" ? item.workerId : item.machineId) ?? item.id, name: machine ? planMachineLabel(machine) : item.labelSnapshot };
                        return (
                          <li key={item.id} className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-xl border bg-background py-1 pl-1 pr-0.5 text-sm">
                            <button type="button" onClick={(event) => { event.stopPropagation(); setPicked(pick); }} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={`${c.move}: ${item.labelSnapshot}`}>
                              <Initials name={item.labelSnapshot} machine={item.kind === "MACHINE"} />
                              <span className="min-w-0 truncate font-medium">{label}</span>
                              {machine?.targe ? <span className="hidden shrink-0 font-mono text-[10px] tracking-tight text-muted-foreground sm:inline">{machine.targe}</span> : null}
                            </button>
                            {item.kind === "MACHINE" && item.machineId && operational?.enabled ? <span className="hidden shrink-0 sm:inline-flex"><AssetOperationalStatusBadge status={operational.statusFor(item.machineId)} c={assets} compact /></span> : null}
                            <button type="button" onClick={(event) => { event.stopPropagation(); remove(item.id); }} disabled={isPending}
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-600" aria-label={`${c.remove}: ${item.labelSnapshot}`} title={c.remove}>
                              <X className="size-4" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : !picked ? <p className="px-4 pb-3 text-sm text-muted-foreground">{c.nobody}</p> : null}
                  {picked ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); assign(column.id, picked); }} disabled={isPending}
                      className="mx-3 mb-3 hidden min-h-11 w-[calc(100%-1.5rem)] items-center justify-center rounded-xl bg-orange-600 lg:inline-flex px-3 text-sm font-semibold text-white hover:bg-orange-700 dark:bg-orange-500 dark:text-slate-950">
                      + {picked.name} · {c.dropHere}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Phone and tablet: after picking someone, choose the site in a sheet; the list stays where it was. */}
      {picked ? (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden" role="dialog" aria-modal="true" aria-label={picked.name} data-testid="plan-site-sheet">
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label={c.cancel} onClick={() => setPicked(null)} />
          <div className="relative max-h-[78vh] w-full overflow-y-auto rounded-t-3xl border-t bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300">
                {picked.kind === "WORKER" ? <HardHat className="size-5" aria-hidden /> : <Truck className="size-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{picked.name}</p>
                <p className="text-xs text-muted-foreground">{c.chooseSite}</p>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="grid size-10 shrink-0 place-items-center rounded-full border hover:bg-muted" aria-label={c.cancel}><X className="size-5" aria-hidden /></button>
            </div>
            <ul className="space-y-2">
              {columns.map((column) => {
                const people = column.assignments.filter((a) => a.kind === "WORKER").length;
                const things = column.assignments.filter((a) => a.kind === "MACHINE").length;
                const here = column.assignments.some((a) => (picked.kind === "WORKER" ? a.workerId : a.machineId) === picked.id);
                return (
                  <li key={column.id}>
                    <button type="button" disabled={isPending || here} onClick={() => assign(column.id, picked)} data-testid="plan-sheet-site"
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] ${here ? "border-orange-500 bg-orange-500/10" : "bg-background hover:border-orange-400 hover:bg-orange-500/5"}`}>
                      <MapPin className="size-5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{column.title}</span>
                        <span className="mt-0.5 flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><HardHat className="size-3.5" aria-label={c.workers} />{people}</span>
                          <span className="inline-flex items-center gap-1"><Truck className="size-3.5" aria-label={c.machines} />{things}</span>
                        </span>
                      </span>
                      {here ? <Check className="size-5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {(() => { const placedHere = assignmentOf(picked); return placedHere ? (
              <button type="button" disabled={isPending} onClick={() => { remove(placedHere.id); setPicked(null); }} data-testid="plan-sheet-remove"
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 text-sm font-semibold text-red-700 hover:bg-red-500/10 dark:text-red-300">
                <X className="size-4" aria-hidden />{c.remove}
              </button>
            ) : null; })()}
          </div>
        </div>
      ) : null}

      {/* "+ Shto" on a site: choose several at once. */}
      {addTo ? (() => {
        const needleAdd = addQuery.trim().toLocaleLowerCase();
        const placedMap = addTab === "WORKER" ? siteOfWorker : siteOfMachine;
        const entries = (addTab === "WORKER"
          ? workers.map((w) => ({ id: w.id, name: w.name, label: w.name, sub: w.licenses, needsOk: w.availability !== "AVAILABLE" || w.hasApprovedVacation }))
          : machines.map((m) => ({ id: m.id, name: planMachineLabel(m), label: planMachineName(m), sub: m.targe ?? null, needsOk: !operational?.enabled && !m.isActive })))
          .filter((entry) => placedMap.get(entry.id) !== addTo.title)
          .filter((entry) => !needleAdd || `${entry.name} ${entry.sub ?? ""}`.toLocaleLowerCase().includes(needleAdd))
          .sort((a, b) => Number(placedMap.has(a.id)) - Number(placedMap.has(b.id)));
        const isSel = (id: string) => addSel.some((item) => item.kind === addTab && item.id === id);
        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={`${c.addTo} ${addTo.title}`} data-testid="plan-add-sheet">
            <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label={c.cancel} onClick={() => setAddTo(null)} />
            <div className="relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl border-t bg-card shadow-2xl lg:max-w-lg lg:rounded-3xl lg:border">
              <div className="px-4 pt-2">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-300"><MapPin className="size-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{c.addTo}</p><p className="truncate text-base font-semibold">{addTo.title}</p></div>
                  <button type="button" onClick={() => setAddTo(null)} className="grid size-10 shrink-0 place-items-center rounded-full border hover:bg-muted" aria-label={c.cancel}><X className="size-5" aria-hidden /></button>
                </div>
                <div role="tablist" className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border text-sm font-semibold">
                  {(["WORKER", "MACHINE"] as const).map((kind) => (
                    <button key={kind} type="button" role="tab" aria-selected={addTab === kind} onClick={() => { setAddTab(kind); setAddQuery(""); }}
                      className={`min-h-11 px-2 ${addTab === kind ? "bg-orange-600 text-white dark:bg-orange-500 dark:text-slate-950" : "hover:bg-muted"}`}>
                      {kind === "WORKER" ? c.workers : c.machines}<span className="ml-1 text-xs font-medium opacity-80">· {kind === "WORKER" ? freeWorkers : freeMachines} {c.free}</span>
                    </button>
                  ))}
                </div>
                <label className="relative mt-3 block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input type="text" value={addQuery} onChange={(event) => setAddQuery(event.target.value)} placeholder={c.search} aria-label={c.search}
                    className="min-h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500" />
                </label>
              </div>
              <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 [scrollbar-width:thin]">
                {entries.length === 0 ? <li className="py-4 text-center text-sm text-muted-foreground">{c.noMatch}</li> : null}
                {entries.map((entry) => {
                  const selected = isSel(entry.id), elsewhere = placedMap.get(entry.id);
                  return (
                    <li key={entry.id}>
                      <button type="button" aria-pressed={selected} data-testid="plan-add-option"
                        onClick={() => setAddSel((current) => selected ? current.filter((item) => !(item.kind === addTab && item.id === entry.id)) : [...current, { kind: addTab, id: entry.id, name: entry.name }])}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-2.5 py-1.5 text-left transition active:scale-[0.99] ${selected ? "border-orange-500 bg-orange-500/10" : "bg-background hover:border-orange-400"}`}>
                        <Initials name={entry.name} machine={addTab === "MACHINE"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold">{entry.label}</span>{entry.needsOk ? <span className="size-2 shrink-0 rounded-full bg-sky-500" title={c.needsOk} aria-label={c.needsOk} /> : null}</span>
                          {elsewhere ? <span className="mt-0.5 inline-flex max-w-full items-center gap-0.5 text-xs text-orange-700 dark:text-orange-300"><MapPin className="size-3 shrink-0" aria-hidden /><span className="truncate">{elsewhere}</span></span>
                            : entry.sub ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{entry.sub}</span> : null}
                        </span>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950" : "border-muted-foreground/30"}`}>{selected ? <Check className="size-4" aria-hidden /> : null}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <button type="button" disabled={isPending || addSel.length === 0} data-testid="plan-add-confirm"
                  onClick={() => { const column = addTo, items = addSel; setAddTo(null); assignMany(column.id, items); }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-500 dark:text-slate-950">
                  <Plus className="size-4" aria-hidden />{c.add}{addSel.length ? ` (${addSel.length})` : ""}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}

      <div className="max-lg:hidden"><SavedPlanList rows={savedRows} c={c} title={c.savedPlan} hint={c.savedHint} /></div>

      <SimpleDialog
        open={Boolean(pendingConfirmation)}
        title={t("workzone.planWarningTitle", currentLang)}
        description={pendingConfirmation?.message ?? null}
        confirmLabel={t("workzone.assignAnyway", currentLang)}
        cancelLabel={c.cancel}
        confirmVariant="secondary"
        confirmDisabled={isPending}
        onConfirm={() => {
          const pending = pendingConfirmation;
          setPendingConfirmation(null);
          if (pending) assignMany(pending.columnId, [pending.item, ...pending.rest], true);
        }}
        onCancel={() => setPendingConfirmation(null)}
      />
      <SimpleDialog
        open={askClear}
        title={c.clear}
        description={c.clearAsk}
        confirmLabel={c.clear}
        cancelLabel={c.cancel}
        confirmVariant="secondary"
        confirmDisabled={isPending}
        onConfirm={() => {
          setAskClear(false);
          startTransition(async () => {
            const result = await clearDailyPlanAction({ date, lang: currentLang });
            setMessage(result.ok ? undefined : result.message);
          });
        }}
        onCancel={() => setAskClear(false)}
      />
      <SimpleDialog
        open={Boolean(noteFor)}
        title={noteFor ? `${c.note}: ${noteFor.title}` : c.note}
        confirmLabel={t("common.save", currentLang)}
        cancelLabel={c.cancel}
        confirmDisabled={isPending}
        onConfirm={() => {
          const column = noteFor;
          setNoteFor(null);
          if (column) startTransition(async () => { await updateDailyPlanColumnNoteAction({ date, columnId: column.id, note: noteDraft, lang: currentLang }); });
        }}
        onCancel={() => setNoteFor(null)}
      >
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          placeholder={t("workzone.adminNotePlaceholder", currentLang)}
        />
      </SimpleDialog>
    </div>
  );
}
