"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { isRecord } from "@/lib/workzone/site-json";

type DemoTreeItem = {
  id: string;
  treeId: string;
  species?: string | null;
  diameter?: number | null;
  status: "todo" | "done" | "blocked" | string;
  notes: string | null;
  siteEquipmentStatus?: unknown;
};

type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";
type EquipmentStatusMap = Partial<Record<EquipmentCategory, { requested: boolean; quantity: number }>>;

function parseEquipmentStatus(value: unknown): EquipmentStatusMap {
  if (!isRecord(value)) return {};
  const map = value;
  const next: EquipmentStatusMap = {};
  for (const category of ["SIGN", "PLATE", "FENCE"] as const) {
    const row = map[category];
    if (!isRecord(row)) continue;
    next[category] = {
      requested: Boolean(row.requested),
      quantity: Math.max(0, Number(row.quantity ?? 0) || 0),
    };
  }
  return next;
}

function equipmentQuantity(tree: DemoTreeItem, category: EquipmentCategory) {
  return Math.max(0, Number(parseEquipmentStatus(tree.siteEquipmentStatus)[category]?.quantity ?? 0) || 0);
}

function treeNote(tree: DemoTreeItem) {
  if (!tree.notes) return "";
  try {
    const parsed = JSON.parse(tree.notes) as { note?: unknown };
    return typeof parsed?.note === "string" ? parsed.note : "";
  } catch {
    return "";
  }
}

function hasHalt(tree: DemoTreeItem) {
  if (!tree.notes) return false;
  try {
    const parsed = JSON.parse(tree.notes) as { haltverbot?: unknown };
    return Boolean(parsed?.haltverbot);
  } catch {
    return false;
  }
}

function statusTone(status: DemoTreeItem["status"]) {
  if (status === "done") return "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "blocked") return "border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function statusKey(status: DemoTreeItem["status"]) {
  if (status === "done") return "demo.statusDone";
  if (status === "blocked") return "demo.statusBlocked";
  return "demo.statusTodo";
}

function ToolButton({
  active = false,
  children,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-disabled="true"
      className={`inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${
        active
          ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-background text-foreground/80"
      }`}
    >
      {children}
    </button>
  );
}

function FenceIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
      <path d="M5 25V7M27 25V7M11 25V9M17 25V9M23 25V9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 10H28M4 16H28M4 22H28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function HaltIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="white" stroke="#ef4444" strokeWidth="4" />
      <path d="M10 10L22 22M22 10L10 22" stroke="#ef4444" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function ConeIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
      <path d="M16 4L7 26H25L16 4Z" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.2 13H19.8M10.2 18H21.8M8.6 23H23.4" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function DemoTreeList({ items, mode }: { items: DemoTreeItem[]; mode?: CompanyMode }) {
  const [expandedTreeId, setExpandedTreeId] = useState<string | null>(null);
  const { currentLang } = useLanguage();
  const label = (key: string) => t(key, currentLang, mode);

  return (
    <div className="space-y-2">
      {items.map((tree) => {
        const expanded = expandedTreeId === tree.id;
        const note = treeNote(tree);
        const signQty = equipmentQuantity(tree, "SIGN");
        const plateQty = equipmentQuantity(tree, "PLATE");
        const fenceQty = equipmentQuantity(tree, "FENCE");

        return (
          <div key={tree.id} className="overflow-hidden rounded-xl border bg-card">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedTreeId(expanded ? null : tree.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-muted/60"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground">{tree.treeId}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {tree.species || "-"} {tree.diameter ? `· ${tree.diameter} cm` : ""}
                </div>
                {note && !expanded ? <div className="mt-1 text-xs text-red-700 dark:text-red-300">{note}</div> : null}
              </div>
              <div className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(tree.status)}`}>
                {label(statusKey(tree.status))}
              </div>
            </button>

            {expanded ? (
              <div className="border-t bg-muted/40 px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <ToolButton label={label("common.edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </ToolButton>
                  <ToolButton label={label("workzone.cones")} active={signQty + plateQty + fenceQty > 0}>
                    <ConeIcon />
                    {signQty + plateQty + fenceQty > 0 ? <span>{signQty + plateQty + fenceQty}</span> : null}
                  </ToolButton>
                  <ToolButton label={label("workzone.barriers")} active={fenceQty > 0}>
                    <FenceIcon />
                    {fenceQty > 0 ? <span>{fenceQty}</span> : null}
                  </ToolButton>
                  <ToolButton label={label("workzone.haltingBan")} active={hasHalt(tree)}>
                    <HaltIcon />
                  </ToolButton>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  {[
                    ["workzone.haltingBan", signQty],
                    ["workzone.coverPlates", plateQty],
                    ["workzone.barriers", fenceQty],
                  ].map(([key, qty]) => (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                      <span>{label(String(key))}</span>
                      <span className="font-semibold text-foreground">{qty}</span>
                    </div>
                  ))}
                </div>

                {note ? <div className="mt-3 rounded-lg border bg-background px-3 py-2 text-xs text-foreground">{note}</div> : null}
                <div className="mt-3 text-xs text-muted-foreground">{label("demo.toolsDisabled")}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
