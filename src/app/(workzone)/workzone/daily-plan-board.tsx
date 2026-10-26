"use client";

import { Pencil } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";
import {
  clearDailyPlanAction,
  moveDailyPlanItemAction,
  removeDailyPlanItemAction,
  saveDailyPlanAction,
  updateDailyPlanColumnNoteAction,
} from "./daily-plan-actions";

type DraggableWorker = { id: string; name: string; licenses: string | null; availability: string; hasApprovedVacation: boolean };
type DraggableMachine = { id: string; name: string; requiredLicense: string | null; isActive: boolean };
type Column = {
  id: string;
  title: string;
  note: string | null;
  baustelleId: string | null;
  assignments: Array<{ id: string; kind: "WORKER" | "MACHINE"; labelSnapshot: string; workerId: string | null; machineId: string | null }>;
};
type SavedRow = { id: string; workerNames: string; machineNames: string; baustelleName: string; note: string | null };
type PendingPlanConfirmation = {
  columnId: string;
  item: { kind: "WORKER" | "MACHINE"; id: string };
  message: string;
};
type PendingNoteEdit = {
  columnId: string;
  title: string;
};

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

export function DailyPlanBoard({
  date,
  columns,
  workers,
  machines,
  baustellen,
  savedRows,
  showCurrentVersionHint,
}: {
  date: string;
  columns: Column[];
  workers: DraggableWorker[];
  machines: DraggableMachine[];
  baustellen: Array<{ id: string; name: string }>;
  savedRows: SavedRow[];
  showCurrentVersionHint?: boolean;
}) {
  const { currentLang } = useLanguage();
  const [message, setMessage] = useState<string>();
  const [activeItem, setActiveItem] = useState<{ kind: "WORKER" | "MACHINE"; id: string } | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingPlanConfirmation | null>(null);
  const [pendingNoteEdit, setPendingNoteEdit] = useState<PendingNoteEdit | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [columnNotes, setColumnNotes] = useState<Record<string, string>>(
    Object.fromEntries(columns.map((col) => [col.id, col.note ?? ""])),
  );

  const assignedWorkerIds = new Set(columns.flatMap((column) => column.assignments.map((item) => item.workerId).filter(Boolean)));
  const assignedMachineIds = new Set(columns.flatMap((column) => column.assignments.map((item) => item.machineId).filter(Boolean)));
  const workersByUsage = useMemo(() => workers, [workers]);
  const machinesByUsage = useMemo(() => machines, [machines]);

  function assignToColumn(columnId: string) {
    if (!activeItem) return;
    const itemToAssign = activeItem;
    startTransition(async () => {
      const result = await moveDailyPlanItemAction({
        date,
        columnId,
        kind: itemToAssign.kind,
        itemId: itemToAssign.id,
        lang: currentLang,
      });
      if (result.requiresConfirmation && result.warningMessage) {
        setPendingConfirmation({ columnId, item: itemToAssign, message: result.warningMessage });
        setActiveItem(null);
        return;
      }
      setMessage(result.message);
      setActiveItem(null);
    });
  }

  function confirmPendingAssignment() {
    if (!pendingConfirmation) return;
    const confirmation = pendingConfirmation;
    setPendingConfirmation(null);
    startTransition(async () => {
      const confirmedResult = await moveDailyPlanItemAction({
        date,
        columnId: confirmation.columnId,
        kind: confirmation.item.kind,
        itemId: confirmation.item.id,
        force: true,
        lang: currentLang,
      });
      setMessage(confirmedResult.message);
    });
  }

  function openNoteEdit(column: Column) {
    setNoteDraft(columnNotes[column.id] ?? "");
    setPendingNoteEdit({ columnId: column.id, title: column.title });
  }

  function savePendingNoteEdit() {
    if (!pendingNoteEdit) return;
    const note = noteDraft;
    const columnId = pendingNoteEdit.columnId;

    setPendingNoteEdit(null);
    setColumnNotes((prev) => ({ ...prev, [columnId]: note }));
    startTransition(async () => {
      await updateDailyPlanColumnNoteAction({ date, columnId, note, lang: currentLang });
    });
  }

  return (
    <div className="space-y-4">
      {showCurrentVersionHint ? (
        <div className="px-1 text-xs font-medium text-orange-600 dark:text-orange-300">
          {t("workzone.currentVersionHint", currentLang)}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => {
            startTransition(async () => {
              const result = await saveDailyPlanAction({ date, lang: currentLang });
              setMessage(result.message);
            });
          }}
          disabled={isPending}
        >
          {t("workzone.saveDay", currentLang)}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            startTransition(async () => {
              const result = await clearDailyPlanAction({ date, lang: currentLang });
              setMessage(result.message);
            });
          }}
          disabled={isPending}
        >
          {t("workzone.clearDayPlan", currentLang)}
        </Button>
        {activeItem ? (
          <button
            type="button"
            onClick={() => setActiveItem(null)}
            className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-muted dark:border-white/10 dark:bg-white/[0.04] dark:text-foreground"
          >
            {t("workzone.activeSelectionClear", currentLang).replace(
              "{type}",
              activeItem.kind === "WORKER" ? t("workzone.workerDrag", currentLang) : t("workzone.machineDrag", currentLang),
            )}
          </button>
        ) : null}
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <div className="lg:relative lg:min-h-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20 lg:absolute lg:inset-0">
            <h3 className="text-sm font-semibold">{t("workzone.workers", currentLang)}</h3>
            <div className="mt-2 grid max-h-[calc(100vh-18rem)] min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:grid-cols-3 lg:max-h-none lg:grid-cols-1 [&::-webkit-scrollbar]:hidden">
              {workersByUsage.map((worker) => {
                const needsConfirmation = worker.availability !== "AVAILABLE" || worker.hasApprovedVacation;
                return (
                  <button
                    key={worker.id}
                    type="button"
                    draggable
                    disabled={assignedWorkerIds.has(worker.id)}
                    title={needsConfirmation ? t("workzone.planRequiresConfirmation", currentLang).replace("{name}", worker.name) : worker.name}
                    onDragStart={() => setActiveItem({ kind: "WORKER", id: worker.id })}
                    onDragEnd={() => setActiveItem(null)}
                    onClick={() => setActiveItem((current) => (current?.kind === "WORKER" && current.id === worker.id ? null : { kind: "WORKER", id: worker.id }))}
                    className={`min-h-12 w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:bg-muted disabled:cursor-not-allowed sm:px-2 sm:text-xs lg:min-h-0 lg:px-2 lg:py-1 lg:text-sm ${
                      assignedWorkerIds.has(worker.id)
                        ? "border-red-200 bg-red-50 text-red-800 opacity-90 dark:border-red-500/30 dark:bg-red-500/12 dark:text-red-100"
                        : needsConfirmation
                          ? "border-sky-400/70 bg-sky-500/15 text-sky-900 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.22)] dark:border-sky-400/50 dark:bg-sky-500/18 dark:text-sky-100"
                          : "dark:border-white/10 dark:bg-white/[0.03]"
                    } ${
                      activeItem?.kind === "WORKER" && activeItem.id === worker.id ? "border-emerald-500 bg-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-500/15" : ""
                    }`}
                  >
                    <span className="line-clamp-2">{worker.name}</span>
                    {worker.licenses ? <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:inline lg:ml-2 lg:mt-0">({worker.licenses})</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-3 xl:grid-cols-3">
            {columns.map((column) => {
              const warnings = columnLicenseWarnings(column, workers, machines, currentLang);
              return (
              <div
                key={column.id}
                className={`min-w-0 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-2.5 shadow-sm transition sm:p-3 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08] dark:shadow-black/20 ${
                  warnings.length > 0 ? "border-amber-500/60 dark:border-amber-500/50 dark:bg-amber-500/[0.08]" : ""
                } ${
                  activeItem ? "cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] dark:hover:border-emerald-400/50 dark:hover:bg-emerald-500/[0.14]" : ""
                }`}
                onDragOver={(event) => event.preventDefault()}
                onClick={() => assignToColumn(column.id)}
                onDrop={() => {
                  if (!activeItem) return;
                  assignToColumn(column.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="line-clamp-2 text-[12px] font-semibold leading-4 sm:text-[13px] xl:text-sm">{column.title}</h4>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:text-emerald-100/80 dark:hover:bg-white/10"
                    onClick={(event) => {
                      event.stopPropagation();
                      openNoteEdit(column);
                    }}
                    aria-label={t("common.note", currentLang)}
                    title={columnNotes[column.id]?.trim() ? `${t("common.note", currentLang)}: ${columnNotes[column.id]}` : t("common.note", currentLang)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                {warnings.length > 0 ? (
                  <div className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/14 dark:text-amber-100 sm:text-xs">
                    {warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 space-y-1 text-[11px] sm:min-h-16 sm:text-xs">
                  {column.assignments.map((item) => (
                    <div
                      key={item.id}
                      className="truncate rounded-md border px-2 py-1 dark:border-white/10 dark:bg-black/10"
                      title={t("workzone.doubleClickRemove", currentLang)}
                      onDoubleClick={() => {
                        startTransition(async () => {
                          const result = await removeDailyPlanItemAction({ date, assignmentId: item.id, lang: currentLang });
                          setMessage(result.message);
                        });
                      }}
                    >
                      {item.kind === "WORKER" ? "👷" : "🚚"} {item.labelSnapshot}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="lg:relative lg:min-h-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-sky-200/80 bg-sky-50/70 p-3 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/[0.08] dark:shadow-black/20 lg:absolute lg:inset-0">
            <h3 className="text-sm font-semibold">{t("workzone.machines", currentLang)}</h3>
            <div className="mt-2 grid max-h-[calc(100vh-18rem)] min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:grid-cols-3 lg:max-h-none lg:grid-cols-1 [&::-webkit-scrollbar]:hidden">
              {machinesByUsage.map((machine) => (
                <button
                  key={machine.id}
                  type="button"
                  draggable
                  disabled={assignedMachineIds.has(machine.id)}
                  onDragStart={() => setActiveItem({ kind: "MACHINE", id: machine.id })}
                  onDragEnd={() => setActiveItem(null)}
                  onClick={() => setActiveItem((current) => (current?.kind === "MACHINE" && current.id === machine.id ? null : { kind: "MACHINE", id: machine.id }))}
                  className={`min-h-12 w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:bg-muted disabled:cursor-not-allowed sm:px-2 sm:text-xs lg:min-h-9 lg:px-2 lg:py-1 lg:text-xs ${
                    assignedMachineIds.has(machine.id)
                      ? "border-red-200 bg-red-50 text-red-800 opacity-90 dark:border-red-500/30 dark:bg-red-500/12 dark:text-red-100"
                      : !machine.isActive
                        ? "border-sky-400/70 bg-sky-500/15 text-sky-900 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.22)] dark:border-sky-400/50 dark:bg-sky-500/18 dark:text-sky-100"
                        : "dark:border-white/10 dark:bg-white/[0.03]"
                  } ${
                    activeItem?.kind === "MACHINE" && activeItem.id === machine.id ? "border-emerald-500 bg-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-500/15" : ""
                  }`}
                  title={!machine.isActive ? t("workzone.planRequiresConfirmation", currentLang).replace("{name}", machine.name) : machine.name}
                >
                  <span className="line-clamp-1">{machine.name}</span>
                  {machine.requiredLicense ? (
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground lg:mt-0">({machine.requiredLicense})</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20">
        <h3 className="text-sm font-semibold">{t("workzone.dailyTable", currentLang)}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse border text-sm dark:border-white/10">
            <thead>
              <tr className="bg-muted/30 dark:bg-white/[0.05]">
                <th className="border px-2 py-1 text-left dark:border-white/10">{t("common.group", currentLang)}</th>
                <th className="border px-2 py-1 text-left dark:border-white/10">{t("workzone.machines", currentLang)}</th>
                <th className="border px-2 py-1 text-left dark:border-white/10">{t("workzone.newSite", currentLang)}</th>
                <th className="border px-2 py-1 text-left dark:border-white/10">{t("common.note", currentLang)}</th>
              </tr>
            </thead>
            <tbody>
              {savedRows.map((row) => (
                <tr key={row.id}>
                  <td className="border px-2 py-1 dark:border-white/10">{row.workerNames || "-"}</td>
                  <td className="border px-2 py-1 dark:border-white/10">{row.machineNames || "-"}</td>
                  <td className="border px-2 py-1 dark:border-white/10">{row.baustelleName}</td>
                  <td className="border px-2 py-1 dark:border-white/10">{row.note ?? "-"}</td>
                </tr>
              ))}
              {savedRows.length === 0 ? (
                <tr>
                  <td className="border px-2 py-2 text-muted-foreground dark:border-white/10" colSpan={4}>
                    {t("workzone.dayNotSaved", currentLang)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <SimpleDialog
        open={Boolean(pendingConfirmation)}
        title={t("workzone.planWarningTitle", currentLang)}
        description={pendingConfirmation?.message ?? null}
        confirmLabel={t("workzone.assignAnyway", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        confirmVariant="secondary"
        confirmDisabled={isPending}
        onConfirm={confirmPendingAssignment}
        onCancel={() => {
          setPendingConfirmation(null);
          setMessage(t("workzone.assignmentCancelled", currentLang));
        }}
      />
      <SimpleDialog
        open={Boolean(pendingNoteEdit)}
        title={pendingNoteEdit ? `${t("common.note", currentLang)}: ${pendingNoteEdit.title}` : t("common.note", currentLang)}
        confirmLabel={t("common.save", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        confirmDisabled={isPending}
        onConfirm={savePendingNoteEdit}
        onCancel={() => setPendingNoteEdit(null)}
      >
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-white/10"
          placeholder={t("workzone.adminNotePlaceholder", currentLang)}
        />
      </SimpleDialog>
    </div>
  );
}
