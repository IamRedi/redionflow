"use client";

import { useState } from "react";

import { t } from "@/lib/i18n";
import { collectConesAction, deployConesAction } from "../../cone-actions";
import type { TreeListItem } from "./tree-list-model";

export type ConeMachineOption = { id: string; label: string; available: number };
export type ConeOnTreeMap = Record<string, { qty: number; machines?: Record<string, number> }>;

/** Deploy or collect traffic cones for one tree, choosing the source/target machine. */
export function ConePickerDialog({
  tree,
  baustelleId,
  canAct,
  coneMachines,
  coneOnTree,
  lang,
  onClose,
  onDone,
}: {
  tree: TreeListItem;
  baustelleId: string;
  canAct: boolean;
  coneMachines: ConeMachineOption[];
  coneOnTree: ConeOnTreeMap;
  lang: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const machineCounts = coneOnTree[tree.id]?.machines ?? {};
  const [coneMachineId, setConeMachineId] = useState(() => coneMachines.find((m) => m.available > 0)?.id ?? "");
  const [coneOriginMachineId, setConeOriginMachineId] = useState(
    () => Object.entries(machineCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? "",
  );
  const [coneQty, setConeQty] = useState("0");
  const [coneMessage, setConeMessage] = useState<string>();

  const coneQuantity = Math.floor(Number(coneQty) || 0);
  const hasConeQuantity = Number.isFinite(coneQuantity) && coneQuantity > 0;
  const selectedConeAvailable = coneMachines.find((m) => m.id === coneMachineId)?.available ?? 0;
  const selectedConeOnTree = coneOnTree[tree.id]?.qty ?? 0;
  const canDeployCones = Boolean(canAct && coneMachineId && hasConeQuantity && selectedConeAvailable >= coneQuantity);
  const canCollectCones = Boolean(canAct && coneMachineId && hasConeQuantity && selectedConeOnTree >= coneQuantity);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-3">
      <div className="w-full max-w-sm rounded-md border bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{t("workzone.conesTreeTitle", lang)}</h3>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {`${t("workzone.treeShort", lang)} ${tree.treeId}`}
            </div>
          </div>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={onClose}
          >
            {t("common.close", lang)}
          </button>
        </div>

        <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
          {t("workzone.currentOnSite", lang)}: <span className="font-semibold text-foreground">{selectedConeOnTree}</span>
        </div>

        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            <div className="text-xs font-medium">{t("workzone.machine", lang)}</div>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={coneMachineId}
              onChange={(e) => setConeMachineId(e.target.value)}
            >
              <option value="">{t("workzone.machinePlaceholder", lang)}</option>
              {coneMachines
                .slice()
                .sort((a, b) => b.available - a.available)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {t("workzone.available", lang)} {m.available}
                  </option>
                ))}
            </select>
          </div>

          {selectedConeOnTree > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium">{t("workzone.coneOriginSuggestion", lang)}</div>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={coneOriginMachineId}
                onChange={(e) => setConeOriginMachineId(e.target.value)}
              >
                <option value="">{t("workzone.unknownUnassigned", lang)}</option>
                {Object.entries(machineCounts)
                  .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                  .map(([machineId, count]) => {
                    const label = coneMachines.find((m) => m.id === machineId)?.label ?? machineId;
                    return (
                      <option key={machineId} value={machineId}>
                        {label} · {t("workzone.onTree", lang)} {count}
                      </option>
                    );
                  })}
              </select>
              <div className="text-[11px] text-muted-foreground">
                {t("workzone.coneOriginHint", lang)}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="text-xs font-medium">{t("common.quantity", lang)}</div>
            <input
              type="number"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={coneQty}
              onChange={(e) => setConeQty(e.target.value)}
              inputMode="numeric"
              min={0}
            />
          </div>

          {coneMessage ? <div className="text-xs text-muted-foreground">{coneMessage}</div> : null}

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
              disabled={!canDeployCones}
              onClick={async () => {
                if (!canAct) return;
                const qty = coneQuantity;
                const available = selectedConeAvailable;
                if (available < qty) {
                  setConeMessage(`${t("workzone.notEnoughConesMachine", lang)} ${available}`);
                  return;
                }
                const fd = new FormData();
                fd.set("baustelleId", baustelleId);
                fd.set("treeItemId", tree.id);
                fd.set("machineId", coneMachineId);
                fd.set("quantity", String(qty));
                const res = await deployConesAction(fd);
                setConeMessage(res.message);
                if (res.ok) onDone();
              }}
            >
              {t("workzone.deploy", lang)}
            </button>
            <button
              type="button"
              className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
              disabled={!canCollectCones}
              onClick={async () => {
                if (!canAct) return;
                const qty = coneQuantity;
                if (selectedConeOnTree < qty) {
                  setConeMessage(`${t("workzone.notEnoughConesSite", lang)} ${selectedConeOnTree}`);
                  return;
                }
                const fd = new FormData();
                fd.set("baustelleId", baustelleId);
                fd.set("treeItemId", tree.id);
                fd.set("machineId", coneMachineId);
                if (coneOriginMachineId) fd.set("originMachineId", coneOriginMachineId);
                fd.set("quantity", String(qty));
                const res = await collectConesAction(fd);
                setConeMessage(res.message);
                if (res.ok) onDone();
              }}
            >
              {t("workzone.collect", lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
