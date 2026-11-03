"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, CalendarCheck, CheckCircle2, ImageIcon, MessageCircle, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MachineArt, machineKind } from "@/components/steel/machine-art";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
import { machineDeadlines } from "@/lib/workzone/machine-deadlines";
import { getActiveMachineDefect, getVisibleMachineNotes, parseMachineNotes, type MachineDefect } from "@/lib/workzone/machine-notes";
import { addMachineDefectAction, blockMachineAction, resolveMachineDefectAction } from "./machine-actions";
import { getMachineConeHistoryAction, setMachineConeTotalAction, transferConesAction } from "./cone-actions";

type MachineSideItem = {
  id: string;
  name: string;
  nickname: string | null;
  model: string | null;
  targe: string | null;
  vitiProdhimit: number | null;
  vitiBlerjes: number | null;
  tuvDate: Date | string | null;
  auDate: Date | string | null;
  huStatus: string | null;
  spDate: Date | string | null;
  spStatus: string | null;
  uvvDate: Date | string | null;
  uvvStatus: string | null;
  insuranceDate?: Date | string | null;
  taxDate?: Date | string | null;
  transportPermitDate?: Date | string | null;
  tachographDate?: Date | string | null;
  ownership?: string | null;
  tonnage?: number | null;
  funksioni: string | null;
  patentaEnevojshme: string | null;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  coneTotal?: number;
  coneAvailable?: number;
  category?: string | null;
};

function machineLabel(machine: MachineSideItem) {
  return machine.nickname ?? machine.name;
}

/** Tile caption in the fleet rail. Albanian fleets have many vehicles of one brand, so the plate tells them apart. */
function tileLabel(machine: MachineSideItem, country: string) {
  if (country === "AL") return machine.targe ?? machineLabel(machine);
  return machineLabel(machine).split(/\s+/)[0];
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function shortLabel(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return compact.slice(0, 6);
}

function dateLabel(date: Date | string | null) {
  if (!date) return "-";
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("de-DE");
}

function defectDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  if (parsed.getTime() === 0) return "";
  return parsed.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border bg-background/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value ?? "-"}</div>
    </div>
  );
}

function daysUntil(date: Date) {
  return Math.floor((date.getTime() - Date.now()) / 86_400_000);
}

/** Inspection date: red when overdue, amber within 30 days, green otherwise. */
function InspectionChip({ label, date }: { label: string; date: Date | string | null }) {
  const parsed = date ? (date instanceof Date ? date : new Date(date)) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime());
  const days = valid ? daysUntil(parsed) : null;
  const tone =
    days === null
      ? "border-border bg-muted/40 text-muted-foreground"
      : days < 0
        ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
        : days <= 30
          ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          : "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300";
  return (
    <div className={cn("rounded-xl border px-3 py-2", tone)}>
      <div className="text-[11px] font-bold uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{valid ? dateLabel(parsed) : "-"}</div>
    </div>
  );
}

export function MachineSidebar({
  machines,
  isAdmin,
  showCones = true,
  country = "DE",
}: {
  machines: MachineSideItem[];
  isAdmin: boolean;
  showCones?: boolean;
  country?: string;
}) {
  const { currentLang: lang } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fleetOpen, setFleetOpen] = useState(true);
  const [message, setMessage] = useState<string>();
  const [defectDrafts, setDefectDrafts] = useState<Record<string, string>>({});
  const [defectFormOpen, setDefectFormOpen] = useState(false);
  const [coneTotalDrafts, setConeTotalDrafts] = useState<Record<string, string>>({});
  const [coneHistory, setConeHistory] = useState<Record<string, Array<{ at: string; type: string; qty: number; from: string | null; to: string | null; where: string | null; actor: string }>>>({});
  const [coneHistoryOpen, setConeHistoryOpen] = useState(false);
  const [coneTransferOpen, setConeTransferOpen] = useState(false);
  const [coneTransferTo, setConeTransferTo] = useState<string>("");
  const [coneTransferQty, setConeTransferQty] = useState<string>("1");
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [resolveConfirmDefect, setResolveConfirmDefect] = useState<MachineDefect | null>(null);
  const [isPending, startTransition] = useTransition();
  const selected = useMemo(() => machines.find((machine) => machine.id === selectedId) ?? null, [machines, selectedId]);
  const selectedNotes = useMemo(() => parseMachineNotes(selected?.notes ?? null), [selected?.notes]);
  const activeDefect = selectedNotes.defects.find((defect) => !defect.resolvedAt) ?? null;

  function blockMachine() {
    if (!selected) return;
    const formData = new FormData();
    formData.set("machineId", selected.id);
    startTransition(async () => {
      const result = await blockMachineAction(formData);
      setMessage(result.message);
      setBlockConfirmOpen(false);
    });
  }

  function addDefect() {
    if (!selected) return;
    const text = (defectDrafts[selected.id] ?? "").trim();
    if (!text) {
      setMessage(t("workzone.defectRequired", lang));
      return;
    }
    const formData = new FormData();
    formData.set("machineId", selected.id);
    formData.set("defect", text);
    startTransition(async () => {
      const result = await addMachineDefectAction(formData);
      setMessage(result.message);
      if (result.ok) {
        setDefectDrafts((prev) => ({ ...prev, [selected.id]: "" }));
        setDefectFormOpen(false);
      }
    });
  }

  function resolveDefect(defect: MachineDefect) {
    if (!selected) return;
    const formData = new FormData();
    formData.set("machineId", selected.id);
    formData.set("defectId", defect.id);
    startTransition(async () => {
      const result = await resolveMachineDefectAction(formData);
      setMessage(result.message);
      setResolveConfirmDefect(null);
    });
  }

  function saveConeTotal(machineId: string) {
    const raw = coneTotalDrafts[machineId] ?? "";
    const next = Math.max(0, Math.floor(Number(raw) || 0));
    const fd = new FormData();
    fd.set("machineId", machineId);
    fd.set("coneTotal", String(next));
    startTransition(async () => {
      const result = await setMachineConeTotalAction(fd);
      setMessage(result.message);
    });
  }

  function openConeHistory(machineId: string) {
    setConeHistoryOpen(true);
    if (coneHistory[machineId]) return;
    const fd = new FormData();
    fd.set("machineId", machineId);
    startTransition(async () => {
      const res = await getMachineConeHistoryAction(fd);
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      setConeHistory((prev) => ({ ...prev, [machineId]: res.rows }));
    });
  }

  if (machines.length === 0) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-20 flex items-end gap-2 print:hidden lg:inset-x-auto lg:bottom-auto lg:right-3 lg:top-24 lg:flex-col lg:items-center">
      <button
        type="button"
        title={t("workzone.fleet", lang)}
        onClick={() => setFleetOpen((open) => !open)}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold shadow-sm transition hover:scale-105",
          fleetOpen ? "ring-2 ring-brand-green ring-offset-2 ring-offset-background" : "",
        )}
      >
        {t("workzone.fleet", lang).toUpperCase()}
      </button>

      {fleetOpen ? (
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto pb-1 lg:max-h-[calc(100vh-13rem)] lg:flex-none lg:overflow-x-visible lg:overflow-y-auto lg:pr-1">
          <div className="flex items-center gap-2 lg:flex-col">
            {machines.map((machine) => {
              const label = machineLabel(machine);
              const hasDefect = Boolean(getActiveMachineDefect(machine.notes));
              const selectedMachine = selectedId === machine.id;
              return (
                <button
                  key={machine.id}
                  type="button"
                  title={`${label}${machine.isActive ? "" : ` - ${t("workzone.blockedStatus", lang).toUpperCase()}`}`}
                  onClick={() => {
                    setSelectedId(selectedMachine ? null : machine.id);
                    setMessage(undefined);
                  }}
                  className={cn(
                    "relative flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br from-orange-50 to-slate-100 text-xs font-semibold shadow-sm transition hover:scale-105 dark:from-slate-800 dark:to-slate-900",
                    selectedMachine ? "ring-2 ring-brand-green ring-offset-2 ring-offset-background" : "",
                    machine.isActive ? "border-border" : "border-2 border-red-500",
                  )}
                >
                  {machine.imageUrl ? (
                    <img src={machine.imageUrl} alt={label} className="size-full object-cover" />
                  ) : (
                    <MachineArt kind={machineKind(machine)} animate={false} className="size-full p-0.5" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1 text-center text-[9px] font-semibold leading-[14px]">{tileLabel(machine, country) || initials(label)}</span>
                  <span
                    className={cn(
                      "absolute right-1 top-1 size-2.5 rounded-full ring-2 ring-background",
                      machine.isActive ? (hasDefect ? "bg-orange-500" : "bg-green-500") : "bg-red-500",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selected && typeof document !== "undefined"
        ? createPortal(
            <div role="dialog" aria-modal="true" aria-label={machineLabel(selected)} className="fixed inset-0 z-[1200] flex h-dvh flex-col bg-background">
              <div className="flex items-center gap-3 border-b px-3 py-2 sm:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="grid size-12 place-items-center rounded-full border bg-card active:scale-95"
                  aria-label={t("common.close", lang)}
                >
                  <X className="size-6" />
                </button>
                <div className="min-w-0 flex-1 truncate text-center text-sm font-medium text-muted-foreground">{t("workzone.fleet", lang)}</div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold",
                    !selected.isActive
                      ? "border-red-500/50 bg-red-500/10 text-red-600"
                      : activeDefect
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
                  )}
                >
                  {!selected.isActive ? t("machineSheet.statusBlocked", lang) : activeDefect ? t("machineSheet.statusDefect", lang) : t("machineSheet.statusOk", lang)}
                </span>
              </div>

              <div className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-rows-[minmax(150px,32vh)_auto] gap-3 overflow-y-auto p-3 sm:p-5 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-1 lg:gap-5 lg:overflow-hidden">
                {/* Picture of the machine with its name on a plate in the corner */}
                <div className="relative min-h-0 overflow-hidden rounded-3xl border bg-gradient-to-br from-orange-50 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
                  {selected.imageUrl ? (
                    <img src={selected.imageUrl} alt={machineLabel(selected)} className="size-full object-cover" />
                  ) : (
                    <MachineArt kind={machineKind(selected)} animate={selected.isActive} className="absolute inset-0 h-full w-full p-4 pt-14" />
                  )}
                  <div className="absolute left-3 top-3 max-w-[80%] rounded-2xl border border-white/60 bg-white/90 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/85">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">{selected.funksioni ?? t("workzone.fleet", lang)}</div>
                    <div className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{machineLabel(selected)}</div>
                    {selected.nickname && selected.nickname !== selected.name ? <div className="text-xs text-muted-foreground">{selected.name}</div> : null}
                  </div>
                  {selected.targe ? (
                    <div className="absolute bottom-3 right-3 rounded-md border-2 border-slate-900 bg-white px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-slate-900 shadow-sm">{selected.targe}</div>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    <Detail label={t("workzone.model", lang)} value={selected.model} />
                    <Detail label={t("workzone.requiredLicense", lang)} value={selected.patentaEnevojshme} />
                    <Detail label={t("workzone.productionYear", lang)} value={selected.vitiProdhimit} />
                  </div>

                  {selected.ownership || selected.tonnage ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selected.tonnage ? <Detail label={t("machineSheet.papers.tonnage", lang)} value={`${selected.tonnage} t`} /> : null}
                      {selected.ownership ? <Detail label={t("machineSheet.papers.ownership", lang)} value={selected.ownership} /> : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    {machineDeadlines(selected, country).map((deadline) => (
                      <InspectionChip key={deadline.key} label={t(`machineSheet.papers.${deadline.key}`, lang)} date={deadline.date} />
                    ))}
                  </div>

                  {message ? <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">{message}</div> : null}

                  {showCones ? (
            <div className="rounded-md border bg-muted/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{t("workzone.cones", lang)}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("workzone.total", lang)}: <span className="font-medium text-foreground">{selected.coneTotal ?? 0}</span>
                  </span>
                  <span>
                    {t("workzone.available", lang)}: <span className="font-medium text-foreground">{selected.coneAvailable ?? 0}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openConeHistory(selected.id)}
                  >
                    {t("workzone.history", lang)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConeTransferOpen((v) => !v)}
                  >
                    {t("workzone.transfer", lang)}
                  </Button>
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="h-8 w-20 rounded-md border bg-background px-2 text-sm"
                      value={coneTotalDrafts[selected.id] ?? String(selected.coneTotal ?? 0)}
                      onChange={(e) => setConeTotalDrafts((p) => ({ ...p, [selected.id]: e.target.value }))}
                      inputMode="numeric"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => saveConeTotal(selected.id)}>
                      {t("common.save", lang)}
                    </Button>
                  </div>
                ) : null}
              </div>

              {coneTransferOpen ? (
                <div className="mt-3 grid gap-2 rounded-md border bg-background/70 p-2">
                  <div className="text-xs font-medium text-muted-foreground">{t("workzone.transferConesToMachine", lang)}</div>
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                      value={coneTransferTo}
                      onChange={(e) => setConeTransferTo(e.target.value)}
                    >
                      <option value="">{t("workzone.targetMachine", lang)}</option>
                      {machines
                        .filter((m) => m.id !== selected.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nickname ?? m.name}
                          </option>
                        ))}
                    </select>
                    <input
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={coneTransferQty}
                      onChange={(e) => setConeTransferQty(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!coneTransferTo || (selected.coneAvailable ?? 0) < Math.max(1, Math.floor(Number(coneTransferQty) || 1))}
                      onClick={() => {
                        if (!selected) return;
                        const qty = Math.max(1, Math.floor(Number(coneTransferQty) || 1));
                        const avail = selected.coneAvailable ?? 0;
                        if (avail < qty) {
                          setMessage(`${t("workzone.notEnoughCones", lang)} ${avail}`);
                          return;
                        }
                        const fd = new FormData();
                        fd.set("fromMachineId", selected.id);
                        fd.set("toMachineId", coneTransferTo);
                        fd.set("quantity", String(qty));
                        startTransition(async () => {
                          const res = await transferConesAction(fd);
                          setMessage(res.message);
                        });
                      }}
                    >
                      {t("workzone.send", lang)}
                    </Button>
                  </div>
                </div>
              ) : null}

              {coneHistoryOpen ? (
                <div className="mt-3 rounded-md border bg-background/70 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground">{t("workzone.historyLast40")}</div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => setConeHistoryOpen(false)}
                    >
                      {t("workzone.closeLower", lang)}
                    </button>
                  </div>
                  <ul className="max-h-44 space-y-1 overflow-auto text-xs">
                    {(coneHistory[selected.id] ?? []).map((r, idx) => (
                      <li key={`${r.at}-${idx}`} className="rounded-md border bg-muted/30 px-2 py-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {r.type} · {r.qty}
                          </span>
                          <span className="text-muted-foreground">{new Date(r.at).toLocaleString("de-DE")}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {r.where ? `${r.where} · ` : ""}
                          {r.from ? `${t("workzone.from", lang)} ${r.from}` : ""}
                          {r.to ? ` → ${r.to}` : ""}
                          {` · ${r.actor}`}
                        </div>
                      </li>
                    ))}
                    {(coneHistory[selected.id] ?? []).length === 0 ? (
                      <li className="text-muted-foreground">{t("workzone.noConeMovements", lang)}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>

                  ) : null}

                  {defectFormOpen ? (
                    <div className="space-y-2 rounded-2xl border-2 border-amber-500/40 bg-amber-500/[0.06] p-3">
                      <Textarea
                        rows={2}
                        autoFocus
                        value={defectDrafts[selected.id] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setMessage(undefined);
                          setDefectDrafts((prev) => ({ ...prev, [selected.id]: nextValue }));
                        }}
                        placeholder={t("workzone.defectPlaceholder", lang)}
                        className="text-base"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="h-12" onClick={() => setDefectFormOpen(false)}>
                          {t("common.cancel", lang)}
                        </Button>
                        <Button type="button" className="h-12 bg-amber-500 text-white hover:bg-amber-600" disabled={isPending} onClick={addDefect}>
                          {t("common.save", lang)}
                        </Button>
                      </div>
                    </div>
                  ) : activeDefect ? (
                    <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-amber-900 dark:text-amber-100">{activeDefect.text}</div>
                          <div className="text-xs text-muted-foreground">
                            {activeDefect.reportedBy}
                            {defectDateLabel(activeDefect.reportedAt) ? ` · ${defectDateLabel(activeDefect.reportedAt)}` : ""}
                          </div>
                        </div>
                      </div>
                      <Button type="button" variant="outline" className="mt-2 h-11 w-full" disabled={isPending} onClick={() => setResolveConfirmDefect(activeDefect)}>
                        <CheckCircle2 className="size-4" />
                        {t("machineSheet.resolveDefect", lang)}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-green-500/40 bg-green-500/10 px-3 py-3 text-sm font-medium text-green-700 dark:text-green-300">
                      <CheckCircle2 className="size-5" />
                      {t("machineSheet.noDefect", lang)}
                    </div>
                  )}

                  {getVisibleMachineNotes(selected.notes) ? (
                    <p className="line-clamp-3 rounded-xl bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{getVisibleMachineNotes(selected.notes)}</p>
                  ) : null}

                  <div className="mt-auto grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]">
                    <button
                      type="button"
                      disabled={isPending || defectFormOpen}
                      onClick={() => setDefectFormOpen(true)}
                      className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 text-base font-bold text-amber-800 active:scale-[0.98] disabled:opacity-50 dark:text-amber-200"
                    >
                      <AlertTriangle className="size-5" /> {t("machineSheet.reportDefect", lang)}
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={isPending || !selected.isActive}
                        onClick={() => setBlockConfirmOpen(true)}
                        className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-bold text-white active:scale-[0.98] disabled:opacity-40"
                      >
                        <Ban className="size-5" /> {t("machineSheet.block", lang)}
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex h-16 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold",
                          selected.isActive ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300" : "border-red-500/40 bg-red-500/10 text-red-600",
                        )}
                      >
                        {selected.isActive ? <CalendarCheck className="size-5" /> : <AlertTriangle className="size-5" />}
                        {selected.isActive ? t("machineSheet.statusOk", lang) : t("machineSheet.statusBlocked", lang)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <SimpleDialog
        open={Boolean(blockConfirmOpen && selected)}
        title={t("common.confirm", lang)}
        description={selected ? `${machineLabel(selected)} ${t("workzone.confirmBlockMachine", lang)}` : null}
        confirmLabel={t("common.confirm", lang)}
        cancelLabel={t("common.cancel", lang)}
        confirmVariant="destructive"
        onCancel={() => setBlockConfirmOpen(false)}
        onConfirm={blockMachine}
      />
      <SimpleDialog
        open={Boolean(resolveConfirmDefect && selected)}
        title={t("common.confirm", lang)}
        description={t("workzone.confirmDefectResolved", lang)}
        confirmLabel={t("common.yes", lang)}
        cancelLabel={t("common.no", lang)}
        onCancel={() => setResolveConfirmDefect(null)}
        onConfirm={() => {
          if (resolveConfirmDefect) resolveDefect(resolveConfirmDefect);
        }}
      />
    </aside>
  );
}
