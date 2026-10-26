"use client";

import { useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";
import {
  collectSafetyEquipmentOffline,
  deploySafetyEquipmentOffline,
  requestSafetyEquipmentOffline,
  setSafetyEquipmentQuantityOffline,
} from "@/lib/workzone/offline/offline-actions";
import {
  collectSafetyEquipmentAction,
  deploySafetyEquipmentAction,
  requestSafetyEquipmentAction,
  setSafetyEquipmentQuantityAction,
} from "../../safety-actions";


type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";

type EquipmentRow = {
  category: EquipmentCategory;
  label: string;
  requested: boolean;
  quantity: number;
  workerName: string;
  dateSet: string;
};

type CurrentWorker = { id: string; companyProfileId: string } | null;

export function SafetyEquipmentPanel({
  baustelleId,
  rows,
  currentWorker,
}: {
  baustelleId: string;
  rows: EquipmentRow[];
  currentWorker?: CurrentWorker;
}) {
  const { currentLang } = useLanguage();
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [quantityDialog, setQuantityDialog] = useState<{
    category: EquipmentCategory;
    mode: "deploy" | "collect";
    quantity: number;
  } | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message === "offline_queued" ? t("workzone.offlineActionQueued", currentLang) : result.message);
    });
  }

  function requestEquipment(category: EquipmentCategory) {
    if (currentWorker) {
      return requestSafetyEquipmentOffline({ baustelleId, category, workerId: currentWorker.id, companyProfileId: currentWorker.companyProfileId });
    }
    return requestSafetyEquipmentAction({ baustelleId, category });
  }

  function removeRequest(category: EquipmentCategory) {
    if (currentWorker) {
      return setSafetyEquipmentQuantityOffline({ baustelleId, category, targetQuantity: 0, workerId: currentWorker.id, companyProfileId: currentWorker.companyProfileId });
    }
    return setSafetyEquipmentQuantityAction({ baustelleId, category, targetQuantity: 0 });
  }

  function deployEquipment(category: EquipmentCategory, quantity: number) {
    if (currentWorker) {
      return deploySafetyEquipmentOffline({ baustelleId, category, quantity, workerId: currentWorker.id, companyProfileId: currentWorker.companyProfileId });
    }
    return deploySafetyEquipmentAction({ baustelleId, category, quantity });
  }

  function collectEquipment(category: EquipmentCategory, quantity: number) {
    if (currentWorker) {
      return collectSafetyEquipmentOffline({ baustelleId, category, quantity, workerId: currentWorker.id, companyProfileId: currentWorker.companyProfileId });
    }
    return collectSafetyEquipmentAction({ baustelleId, category, quantity });
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <h3 className="text-sm font-semibold">{t("workzone.safetyPanelTitle", currentLang)}</h3>
      <div className="mt-2 space-y-2">
        {rows.map((row) => {
          const icon = row.quantity > 0 ? "🟢" : row.requested ? "🔴" : "⚪";
          const dateLabel = row.dateSet ? new Date(row.dateSet).toLocaleString("de-DE") : "-";
          return (
            <div key={row.category} className="rounded-md border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {icon} {row.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("workzone.currentOnSite", currentLang)}: {row.quantity}
                </span>
              </div>
              {row.quantity > 0 ? (
                <div className="mt-1 rounded-md bg-green-500/10 px-2 py-1 text-xs">
                  {t("common.active", currentLang)} · {t("common.quantity", currentLang)}: {row.quantity} · {t("workzone.fromLabel", currentLang)}:{" "}
                  {row.workerName || "-"} · {t("workzone.since", currentLang)}: {dateLabel}
                </div>
              ) : row.requested ? (
                <div className="mt-1 rounded-md bg-red-500/10 px-2 py-1 text-xs">{t("workzone.requestedRedPending", currentLang)}</div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => requestEquipment(row.category))}
                >
                  {t("workzone.request", currentLang)}
                </Button>
                {row.requested && row.quantity <= 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => run(() => removeRequest(row.category))}
                  >
                    {t("workzone.removeRequest", currentLang)}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setQuantityDialog({ category: row.category, mode: "deploy", quantity: 1 })}
                >
                  {t("workzone.deploy", currentLang)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isPending || row.quantity <= 0}
                  onClick={() => setQuantityDialog({ category: row.category, mode: "collect", quantity: 1 })}
                >
                  {t("workzone.collect", currentLang)}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}

      <SimpleDialog
        open={Boolean(quantityDialog)}
        title={
          quantityDialog?.mode === "collect"
            ? t("workzone.collect", currentLang)
            : t("workzone.deploy", currentLang)
        }
        description={
          quantityDialog?.mode === "collect"
            ? t("workzone.collectQuantityPrompt", currentLang)
            : t("workzone.deployQuantityPrompt", currentLang)
        }
        confirmLabel={t("common.save", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        onCancel={() => setQuantityDialog(null)}
        onConfirm={() => {
          if (!quantityDialog || quantityDialog.quantity <= 0) return;
          run(() =>
            quantityDialog.mode === "collect"
              ? collectEquipment(quantityDialog.category, quantityDialog.quantity)
              : deployEquipment(quantityDialog.category, quantityDialog.quantity),
          );
          setQuantityDialog(null);
        }}
      >
        <input
          type="number"
          min={1}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={String(quantityDialog?.quantity ?? 1)}
          onChange={(event) =>
            setQuantityDialog((current) =>
              current
                ? {
                    ...current,
                    quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                  }
                : current,
            )
          }
        />
      </SimpleDialog>
    </div>
  );
}
