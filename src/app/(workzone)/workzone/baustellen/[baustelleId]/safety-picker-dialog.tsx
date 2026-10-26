"use client";

import type { ReactNode } from "react";

import { t } from "@/lib/i18n";
import type { EquipmentCategory, EquipmentStatusMap, TreeListItem } from "./tree-list-model";

export type SafetyPickerRow = { category: EquipmentCategory; label: string; icon: ReactNode };

/** Per-tree picker for barriers / no-parking signs: shows placed, requested or missing state. */
export function SafetyPickerDialog({
  tree,
  rows,
  status,
  busy,
  message,
  lang,
  onClose,
  onPick,
  onRemoveRequest,
}: {
  tree: TreeListItem;
  rows: SafetyPickerRow[];
  status: EquipmentStatusMap;
  busy: boolean;
  message?: string;
  lang: string;
  onClose: () => void;
  onPick: (category: EquipmentCategory) => void;
  onRemoveRequest: (category: EquipmentCategory) => void;
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-3">
      <div className="w-full max-w-sm rounded-md border bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{t("workzone.safetyTreeTitle", lang)}</h3>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {`${t("workzone.treeShort", lang)} ${tree.treeId}`}
            </div>
          </div>
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onClose}>
            {t("common.close", lang)}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {rows.map((item) => {
            const row = status[item.category];
            const qty = Math.max(0, Number(row?.quantity ?? 0) || 0);
            const requested = Boolean(row?.requested) && qty <= 0;
            return (
              <div
                key={item.category}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  qty > 0 ? "border-emerald-500/60 bg-emerald-500/15" : requested ? "border-red-500/60 bg-red-500/15" : ""
                }`}
              >
                <button
                  type="button"
                  className={`w-full text-left ${!qty && !requested ? "hover:bg-muted" : ""}`}
                  onClick={() => onPick(item.category)}
                  disabled={busy}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span className="inline-flex size-6 items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {qty > 0
                      ? t("workzone.activeGreenOnSite", lang).replace("{qty}", String(qty))
                      : requested
                        ? t("workzone.requestedRedPending", lang)
                        : t("workzone.notPlaced", lang)}
                  </div>
                </button>
                {requested ? (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                      disabled={busy}
                      onClick={() => onRemoveRequest(item.category)}
                    >
                      {t("workzone.removeRequest", lang)}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
