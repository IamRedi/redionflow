"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
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
  if (status === "done") return "bg-emerald-500/12 text-emerald-300 border-emerald-400/30";
  if (status === "blocked") return "bg-red-500/12 text-red-300 border-red-400/30";
  return "bg-amber-500/12 text-amber-300 border-amber-400/30";
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
      title={`${label} · demo`}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
        active
          ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-200"
          : "border-white/12 bg-white/5 text-white/78 hover:bg-white/8"
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

export function DemoTreeList({ items }: { items: DemoTreeItem[] }) {
  const [expandedTreeId, setExpandedTreeId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {items.map((tree) => {
        const expanded = expandedTreeId === tree.id;
        const note = treeNote(tree);
        const signQty = equipmentQuantity(tree, "SIGN");
        const plateQty = equipmentQuantity(tree, "PLATE");
        const fenceQty = equipmentQuantity(tree, "FENCE");

        return (
          <div key={tree.id} className="overflow-hidden rounded-xl border bg-card/80">
            <button
              type="button"
              onClick={() => setExpandedTreeId(expanded ? null : tree.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/5"
            >
              <div className="min-w-0">
                <div className="font-medium text-white">{tree.treeId}</div>
                <div className="mt-1 text-xs text-white/58">
                  {tree.species || "-"} {tree.diameter ? `· ${tree.diameter} cm` : ""}
                </div>
              </div>
              <div className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(tree.status)}`}>
                {tree.status}
              </div>
            </button>

            {expanded ? (
              <div className="border-t border-white/10 bg-[#10211a] px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <ToolButton label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </ToolButton>
                  <ToolButton label="Cones" active={signQty + plateQty + fenceQty > 0}>
                    <ConeIcon />
                    {signQty + plateQty + fenceQty > 0 ? <span>{signQty + plateQty + fenceQty}</span> : null}
                  </ToolButton>
                  <ToolButton label="Barriers" active={fenceQty > 0}>
                    <FenceIcon />
                    {fenceQty > 0 ? <span>{fenceQty}</span> : null}
                  </ToolButton>
                  <ToolButton label="Haltverbot" active={hasHalt(tree)}>
                    <HaltIcon />
                  </ToolButton>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-white/68 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Signs: <span className="font-semibold text-white">{signQty}</span></div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Plates: <span className="font-semibold text-white">{plateQty}</span></div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Fences: <span className="font-semibold text-white">{fenceQty}</span></div>
                </div>

                <div className="mt-3 rounded-lg border border-dashed border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/56">
                  {note || "Demo preview only. Tools are visible here, but actions stay disabled in public mode."}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
