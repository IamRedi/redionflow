"use client";

import Link from "next/link";
import { ImageIcon, X } from "lucide-react";
import { useMemo, useState } from "react";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/components/i18n/language-provider";
import { cn } from "@/lib/ui/cn";

type DemoMachine = {
  id: string;
  name: string;
  nickname: string | null;
  model: string | null;
  targe: string | null;
  vitiProdhimit: number | null;
  vitiBlerjes: number | null;
  tuvDate: Date | string | null;
  spDate: Date | string | null;
  uvvDate: Date | string | null;
  funksioni: string | null;
  patentaEnevojshme: string | null;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  coneTotal: number;
  coneAvailable: number;
};

function machineLabel(machine: DemoMachine) {
  return machine.nickname ?? machine.name;
}

function shortLabel(value: string) {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 6);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dateLabel(date: Date | string | null) {
  if (!date) return "-";
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("de-DE");
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border bg-background/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value ?? "-"}</div>
    </div>
  );
}

export function DemoMachineRail({ machines }: { machines: DemoMachine[] }) {
  const { currentLang } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fleetOpen, setFleetOpen] = useState(true);
  const selected = useMemo(() => machines.find((machine) => machine.id === selectedId) ?? null, [machines, selectedId]);

  if (machines.length === 0) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-20 flex items-end gap-2 print:hidden lg:inset-x-auto lg:bottom-auto lg:right-3 lg:top-24 lg:flex-col lg:items-center">
      <button
        type="button"
        title={t("workzone.fleet", currentLang)}
        onClick={() => setFleetOpen((open) => !open)}
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold shadow-sm transition hover:scale-105",
          fleetOpen ? "ring-2 ring-brand-green ring-offset-2 ring-offset-background" : "",
        )}
      >
        {t("workzone.fleet", currentLang).toUpperCase()}
      </button>

      {fleetOpen ? (
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto pb-1 lg:max-h-[calc(100vh-13rem)] lg:flex-none lg:overflow-x-visible lg:overflow-y-auto lg:pr-1">
          <div className="flex items-center gap-2 lg:flex-col">
            {machines.map((machine) => {
              const label = machineLabel(machine);
              const selectedMachine = selectedId === machine.id;
              return (
                <button
                  key={machine.id}
                  type="button"
                  title={`${label}${machine.isActive ? "" : ` - ${t("workzone.blockedStatus", currentLang).toUpperCase()}`}`}
                  onClick={() => setSelectedId(selectedMachine ? null : machine.id)}
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
                      machine.isActive ? "bg-emerald-500" : "bg-red-500",
                    )}
                  />
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
              title={t("common.close", currentLang)}
            >
              <X className="size-4" />
            </button>
            <div className="absolute bottom-3 left-3 rounded-md bg-background/90 px-3 py-2 shadow-sm">
              <div className="text-lg font-semibold leading-none">{machineLabel(selected)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selected.targe ?? t("workzone.noLicensePlate", currentLang)} · {selected.funksioni ?? t("workzone.fleet", currentLang)}
              </div>
            </div>
          </div>

          <div className="no-scrollbar max-h-[calc(100dvh-16rem)] space-y-4 overflow-y-auto p-4 lg:max-h-[calc(100vh-16rem)]">
            <div className="grid grid-cols-2 gap-2">
              <Detail label={t("workzone.model", currentLang)} value={selected.model} />
              <Detail label={t("workzone.licensePlate", currentLang)} value={selected.targe} />
              <Detail label={t("workzone.function", currentLang)} value={selected.funksioni} />
              <Detail label={t("workzone.requiredLicense", currentLang)} value={selected.patentaEnevojshme} />
              <Detail label={t("workzone.productionYear", currentLang)} value={selected.vitiProdhimit} />
              <Detail label={t("workzone.purchaseYear", currentLang)} value={selected.vitiBlerjes} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Detail label="HU" value={dateLabel(selected.tuvDate)} />
              <Detail label="SP" value={dateLabel(selected.spDate)} />
              <Detail label="UVV" value={dateLabel(selected.uvvDate)} />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/25 p-3">
              <Detail label={t("workzone.total", currentLang)} value={selected.coneTotal} />
              <Detail label={t("workzone.available", currentLang)} value={selected.coneAvailable} />
            </div>

            {selected.notes ? (
              <div className="rounded-md border bg-muted/25 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("form.notes", currentLang)}</div>
                <p className="mt-2 text-sm whitespace-pre-wrap">{selected.notes}</p>
              </div>
            ) : null}

            <Link
              href={`/demo/machines/${selected.id}`}
              className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              {t("common.open", currentLang)}
            </Link>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
