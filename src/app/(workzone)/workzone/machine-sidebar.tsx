"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Ban, CalendarCheck, CheckCircle2, ImageIcon, MessageCircle, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/ui/cn";
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
  funksioni: string | null;
  patentaEnevojshme: string | null;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  coneTotal?: number;
  coneAvailable?: number;
};

function machineLabel(machine: MachineSideItem) {
  return machine.nickname ?? machine.name;
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

export function MachineSidebar({ machines, isAdmin }: { machines: MachineSideItem[]; isAdmin: boolean }) {
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
      setMessage(t("workzone.defectRequired"));
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
        title={t("workzone.fleet")}
        onClick={() => setFleetOpen((open) => !open)}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold shadow-sm transition hover:scale-105",
          fleetOpen ? "ring-2 ring-brand-green ring-offset-2 ring-offset-background" : "",
        )}
      >
        {t("workzone.fleet").toUpperCase()}
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
                  title={`${label}${machine.isActive ? "" : ` - ${t("workzone.blockedStatus").toUpperCase()}`}`}
                  onClick={() => {
                    setSelectedId(selectedMachine ? null : machine.id);
                    setMessage(undefined);
                  }}
                  className={cn(
                    "relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-xs font-semibold shadow-sm transition hover:scale-105",
                    selectedMachine ? "ring-2 ring-brand-green ring-offset-2 ring-offset-background" : "",
                    machine.isActive ? "border-border" : "border-red-500 bg-red-600 text-white",
                  )}
                >
                  {machine.imageUrl ? (
                    <img src={machine.imageUrl} alt={label} className="size-full object-cover" />
                  ) : (
                    <span className="block whitespace-nowrap px-1 text-center text-[9px] leading-none tracking-tight">{shortLabel(label) || initials(label)}</span>
                  )}
                  <span
                    className={cn(
                      "absolute right-0.5 top-0.5 size-3 rounded-full border border-background",
                      machine.isActive ? (hasDefect ? "bg-orange-500" : "bg-green-500") : "bg-red-500",
                    )}
                  />
                  <span className="pointer-events-none absolute -bottom-1 left-2 size-2 rounded-full border border-background/80 bg-zinc-700" />
                  <span className="pointer-events-none absolute -bottom-1 right-2 size-2 rounded-full border border-background/80 bg-zinc-700" />
                  {!machine.isActive ? <span className="absolute inset-x-1 bottom-0.5 rounded-full bg-red-700 px-1 text-[8px] leading-3 text-white">{t("workzone.stopBadge")}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-x-3 bottom-20 max-h-[calc(100dvh-7rem)] overflow-hidden rounded-lg border bg-card shadow-2xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-14 lg:top-0 lg:w-[min(26rem,calc(100vw-6rem))] lg:max-h-none">
          <div className="relative h-36 bg-muted">
            {selected.imageUrl ? (
              <img src={selected.imageUrl} alt={machineLabel(selected)} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-10" />
              </div>
            )}
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full border bg-background/85 p-1.5 shadow-sm"
              onClick={() => setSelectedId(null)}
              title={t("common.close")}
            >
              <X className="size-4" />
            </button>
            <div className="absolute bottom-3 left-3 rounded-md bg-background/90 px-3 py-2 shadow-sm">
              <div className="text-lg font-semibold leading-none">{machineLabel(selected)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{selected.targe ?? t("workzone.noLicensePlate")} · {selected.funksioni ?? t("workzone.fleet")}</div>
            </div>
            {!selected.isActive ? (
              <div className="absolute bottom-3 right-3 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                {t("workzone.blockedStatus").toUpperCase()}
              </div>
            ) : null}
          </div>

          <div className="no-scrollbar max-h-[calc(100dvh-16rem)] space-y-4 overflow-y-auto p-4 lg:max-h-[calc(100vh-16rem)]">
            <div className="grid grid-cols-2 gap-2">
              <Detail label={t("workzone.model")} value={selected.model} />
              <Detail label={t("workzone.licensePlate")} value={selected.targe} />
              <Detail label={t("workzone.function")} value={selected.funksioni} />
              <Detail label={t("workzone.requiredLicense")} value={selected.patentaEnevojshme} />
              <Detail label={t("workzone.productionYear")} value={selected.vitiProdhimit} />
              <Detail label={t("workzone.purchaseYear")} value={selected.vitiBlerjes} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Detail label="HU" value={dateLabel(selected.tuvDate)} />
              <Detail label="SP" value={dateLabel(selected.spDate)} />
              <Detail label="UVV" value={dateLabel(selected.uvvDate)} />
            </div>

            {message ? <div className="rounded-md border bg-background/70 px-3 py-2 text-xs text-muted-foreground">{message}</div> : null}

            <div className="rounded-md border bg-muted/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{t("workzone.cones")}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("workzone.total")}: <span className="font-medium text-foreground">{selected.coneTotal ?? 0}</span>
                  </span>
                  <span>
                    {t("workzone.available")}: <span className="font-medium text-foreground">{selected.coneAvailable ?? 0}</span>
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
                    {t("workzone.history")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConeTransferOpen((v) => !v)}
                  >
                    {t("workzone.transfer")}
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
                      {t("common.save")}
                    </Button>
                  </div>
                ) : null}
              </div>

              {coneTransferOpen ? (
                <div className="mt-3 grid gap-2 rounded-md border bg-background/70 p-2">
                  <div className="text-xs font-medium text-muted-foreground">{t("workzone.transferConesToMachine")}</div>
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <select
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                      value={coneTransferTo}
                      onChange={(e) => setConeTransferTo(e.target.value)}
                    >
                      <option value="">{t("workzone.targetMachine")}</option>
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
                          setMessage(`${t("workzone.notEnoughCones")} ${avail}`);
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
                      {t("workzone.send")}
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
                      {t("workzone.closeLower")}
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
                          {r.from ? `${t("workzone.from")} ${r.from}` : ""}
                          {r.to ? ` → ${r.to}` : ""}
                          {` · ${r.actor}`}
                        </div>
                      </li>
                    ))}
                    {(coneHistory[selected.id] ?? []).length === 0 ? (
                      <li className="text-muted-foreground">{t("workzone.noConeMovements")}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border bg-muted/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="size-4 text-orange-500" />
                  {t("workzone.notes")}
                </div>
                <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => setDefectFormOpen((open) => !open)}>
                  <Plus className="size-4" />
                  {t("common.add")}
                </Button>
              </div>

              {activeDefect ? (
                <div className="mb-3 rounded-md border border-orange-500/40 bg-orange-500/10 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-orange-700 dark:text-orange-300">{activeDefect.text}</div>
                      <div className="mt-1 text-muted-foreground">
                        {activeDefect.reportedBy}
                        {defectDateLabel(activeDefect.reportedAt) ? ` · ${defectDateLabel(activeDefect.reportedAt)}` : ""}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[11px]" disabled={isPending} onClick={() => setResolveConfirmDefect(activeDefect)}>
                      <CheckCircle2 className="size-3.5" />
                      {t("workzone.defectResolvedButton")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-brand-green/30 bg-brand-green/10 px-2 py-1.5 text-xs text-brand-green">
                  <CheckCircle2 className="size-4" />
                  {t("workzone.noOpenDefect")}
                </div>
              )}

              {defectFormOpen ? (
                <div className="mb-3 rounded-md border bg-background/70 p-2">
                  <Textarea
                    rows={2}
                    value={defectDrafts[selected.id] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setMessage(undefined);
                      setDefectDrafts((prev) => ({ ...prev, [selected.id]: nextValue }));
                    }}
                    placeholder={t("workzone.defectPlaceholder")}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button type="button" size="sm" disabled={isPending} onClick={addDefect}>
                      <Plus className="size-4" />
                      {t("common.add")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {getVisibleMachineNotes(selected.notes) ? (
                <pre className="max-h-36 whitespace-pre-wrap rounded-md bg-background/70 p-2 text-xs leading-relaxed text-muted-foreground">
                  {getVisibleMachineNotes(selected.notes)}
                </pre>
              ) : null}

              {selectedNotes.defects.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("workzone.defectHistoryLast5")}</div>
                  <ul className="space-y-1">
                    {selectedNotes.defects.map((defect) => (
                      <li key={defect.id} className="rounded-md border bg-background/60 px-2 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("font-medium", defect.resolvedAt ? "text-muted-foreground" : "text-orange-600 dark:text-orange-300")}>{defect.text}</span>
                          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px]", defect.resolvedAt ? "bg-brand-green/10 text-brand-green" : "bg-orange-500/10 text-orange-600 dark:text-orange-300")}>
                            {defect.resolvedAt ? t("workzone.defectResolved") : t("workzone.defectOpen")}
                          </span>
                        </div>
                        <div className="mt-0.5 text-muted-foreground">
                          {defect.reportedBy}
                          {defectDateLabel(defect.reportedAt) ? ` · ${defectDateLabel(defect.reportedAt)}` : ""}
                          {defect.resolvedAt ? ` · ${t("workzone.defectResolvedBy")} ${defect.resolvedBy ?? t("common.unknown")} ${defectDateLabel(defect.resolvedAt)}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {isAdmin ? (
              <Button type="button" variant="destructive" className="w-full" disabled={isPending || !selected.isActive} onClick={() => setBlockConfirmOpen(true)}>
                <Ban className="size-4" />
                {t("workzone.blockMachineButton")}
              </Button>
            ) : selected.isActive ? (
              <div className="flex items-center gap-2 rounded-md border bg-brand-green/10 px-3 py-2 text-sm text-brand-green">
                <CalendarCheck className="size-4" />
                {t("workzone.machineActive")}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                <AlertTriangle className="size-4" />
                {t("workzone.machineBlockedDoNotUse")}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <SimpleDialog
        open={Boolean(blockConfirmOpen && selected)}
        title={t("common.confirm")}
        description={selected ? `${machineLabel(selected)} ${t("workzone.confirmBlockMachine")}` : null}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        confirmVariant="destructive"
        onCancel={() => setBlockConfirmOpen(false)}
        onConfirm={blockMachine}
      />
      <SimpleDialog
        open={Boolean(resolveConfirmDefect && selected)}
        title={t("common.confirm")}
        description={t("workzone.confirmDefectResolved")}
        confirmLabel={t("common.yes")}
        cancelLabel={t("common.no")}
        onCancel={() => setResolveConfirmDefect(null)}
        onConfirm={() => {
          if (resolveConfirmDefect) resolveDefect(resolveConfirmDefect);
        }}
      />
    </aside>
  );
}
