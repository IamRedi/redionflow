"use client";

import { Check, HardHat, Loader2, MapPin, Pencil, Search, Truck, X } from "lucide-react";
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

type DraggableWorker = { id: string; name: string; licenses: string | null; availability: string; hasApprovedVacation: boolean };
type DraggableMachine = { id: string; name: string; requiredLicense: string | null; isActive: boolean };
type Assignment = { id: string; kind: "WORKER" | "MACHINE"; labelSnapshot: string; workerId: string | null; machineId: string | null };
type Column = {
  id: string;
  title: string;
  note: string | null;
  baustelleId: string | null;
  assignments: Assignment[];
};
type Picked = { kind: "WORKER" | "MACHINE"; id: string; name: string };
type PendingPlanConfirmation = { columnId: string; item: Picked; message: string };

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

  const siteOfWorker = useMemo(() => new Map(columns.flatMap((column) => column.assignments.filter((a) => a.workerId).map((a) => [a.workerId as string, column.title] as const))), [columns]);
  const siteOfMachine = useMemo(() => new Map(columns.flatMap((column) => column.assignments.filter((a) => a.machineId).map((a) => [a.machineId as string, column.title] as const))), [columns]);
  const freeWorkers = workers.filter((worker) => !siteOfWorker.has(worker.id)).length;
  const freeMachines = machines.filter((machine) => !siteOfMachine.has(machine.id)).length;

  // Saved = what workers see. Compare it with the board to show unsaved changes.
  const boardRows = columns.map((column) => ({
    baustelleName: column.title,
    workerNames: column.assignments.filter((a) => a.kind === "WORKER").map((a) => a.labelSnapshot).join(", "),
    machineNames: column.assignments.filter((a) => a.kind === "MACHINE").map((a) => a.labelSnapshot).join(", "),
    note: column.note,
  })).filter(hasContent).map(rowKey).sort();
  const savedKeys = savedRows.filter(hasContent).map(rowKey).sort();
  const dirty = boardRows.join("\n") !== savedKeys.join("\n");
  const neverSaved = savedRows.length === 0;

  const needle = query.trim().toLocaleLowerCase();
  // Free ones first, then the ones already placed today.
  const placed = tab === "WORKER" ? siteOfWorker : siteOfMachine;
  const list = (tab === "WORKER" ? workers : machines)
    .filter((entry) => !needle || entry.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => Number(placed.has(a.id)) - Number(placed.has(b.id)));

  function assign(columnId: string, item: Picked, force = false) {
    startTransition(async () => {
      const result = await moveDailyPlanItemAction({ date, columnId, kind: item.kind, itemId: item.id, force, lang: currentLang });
      if (result.requiresConfirmation && result.warningMessage) {
        setPendingConfirmation({ columnId, item, message: result.warningMessage });
      } else if (!result.ok) {
        setMessage(result.message);
      } else {
        setMessage(undefined);
      }
      setPicked(null);
    });
  }

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
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${neverSaved ? "bg-muted text-muted-foreground" : dirty ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"}`} data-testid="plan-status">
          {neverSaved ? c.notSaved : dirty ? c.unsaved : <><Check className="size-3.5" />{c.saved}</>}
        </span>
        {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
        {message ? <span role="status" className="text-xs text-red-700 dark:text-red-300">{message}</span> : null}
        <div className="ml-auto flex gap-2">
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
        <section className="rounded-2xl border bg-card p-3 shadow-sm lg:sticky lg:top-4">
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
          <ul className="mt-2 grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-3 lg:max-h-[calc(100vh-17rem)] lg:grid-cols-1" data-testid="plan-pick-list">
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
                    onDragStart={() => setPicked({ kind: tab, id: entry.id, name: entry.name })}
                    onClick={() => setPicked(active ? null : { kind: tab, id: entry.id, name: entry.name })}
                    aria-pressed={active}
                    className={`flex min-h-11 w-full flex-col items-start justify-center rounded-xl border px-2.5 py-1.5 text-left text-sm transition ${
                      active ? "border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950"
                        : site ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                          : "bg-background hover:border-orange-400 hover:bg-orange-500/5"
                    }`}
                  >
                    <span className="flex w-full items-center gap-1.5">
                      {needsOk ? <span className="size-2 shrink-0 rounded-full bg-sky-500" title={c.needsOk} aria-label={c.needsOk} /> : null}
                      <span className="min-w-0 truncate font-medium">{entry.name}</span>
                    </span>
                    {site ? <span className={`flex max-w-full items-center gap-1 truncate text-[11px] ${active ? "" : "text-orange-700 dark:text-orange-300"}`}><MapPin className="size-3 shrink-0" />{site}</span>
                      : sub ? <span className={`max-w-full truncate text-[11px] ${active ? "" : "text-muted-foreground"}`}>{sub}</span> : null}
                    {machine && operational?.enabled ? <AssetOperationalStatusBadge status={operational.statusFor(machine.id)} c={assets} compact className="mt-1" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Sites of the day. */}
        <section className="min-w-0 space-y-3">
          {picked ? (
            <div className="flex items-center gap-2 rounded-2xl border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm" role="status" data-testid="plan-picked">
              <span className="min-w-0 flex-1"><strong>{picked.name}</strong>: {c.picked}</span>
              <button type="button" onClick={() => setPicked(null)} className="min-h-9 shrink-0 rounded-lg border bg-card px-3 text-xs font-semibold hover:bg-muted">{c.cancel}</button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {columns.map((column) => {
              const warnings = columnLicenseWarnings(column, workers, machines, currentLang);
              const people = column.assignments.filter((a) => a.kind === "WORKER");
              const things = column.assignments.filter((a) => a.kind === "MACHINE");
              return (
                <article
                  key={column.id}
                  data-testid="plan-site"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => { if (picked) assign(column.id, picked); }}
                  onClick={() => { if (picked) assign(column.id, picked); }}
                  className={`min-w-0 rounded-2xl border bg-card p-3 shadow-sm transition ${picked ? "cursor-pointer border-dashed border-orange-500 hover:bg-orange-500/5" : ""} ${warnings.length ? "border-amber-500/60" : ""}`}
                >
                  <header className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-base font-semibold leading-tight">{column.title}</h3>
                      <p className="mt-1 flex items-center gap-3 text-xs tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1" title={c.workers}><HardHat className="size-3.5" aria-label={c.workers} />{people.length}</span><span className="inline-flex items-center gap-1" title={c.machines}><Truck className="size-3.5" aria-label={c.machines} />{things.length}</span></p>
                    </div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setNoteDraft(column.note ?? ""); setNoteFor(column); }}
                      className="grid size-10 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${c.note}: ${column.title}`} title={c.note}>
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  </header>
                  {column.note?.trim() ? <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">{column.note}</p> : null}
                  {warnings.length ? <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-100">{warnings.map((w) => <div key={w}>{w}</div>)}</div> : null}
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {column.assignments.map((item) => (
                      <li key={item.id} className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg border bg-background pl-2 text-sm">
                        {item.kind === "WORKER" ? <HardHat className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden /> : <Truck className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />}
                        <span className="min-w-0 truncate">{item.labelSnapshot}</span>
                        {item.kind === "MACHINE" && item.machineId && operational?.enabled ? <AssetOperationalStatusBadge status={operational.statusFor(item.machineId)} c={assets} compact /> : null}
                        <button type="button" onClick={(event) => { event.stopPropagation(); remove(item.id); }} disabled={isPending}
                          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-600" aria-label={`${c.remove}: ${item.labelSnapshot}`} title={c.remove}>
                          <X className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                    {column.assignments.length === 0 && !picked ? <li className="text-sm text-muted-foreground">{c.nobody}</li> : null}
                  </ul>
                  {picked ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); assign(column.id, picked); }} disabled={isPending}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-3 text-sm font-semibold text-white hover:bg-orange-700 dark:bg-orange-500 dark:text-slate-950">
                      + {picked.name} · {c.dropHere}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <SavedPlanList rows={savedRows} c={c} title={c.savedPlan} hint={c.savedHint} />

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
          if (pending) assign(pending.columnId, pending.item, true);
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
