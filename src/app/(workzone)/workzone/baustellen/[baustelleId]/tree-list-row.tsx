"use client";

import { Pencil } from "lucide-react";

import { t } from "@/lib/i18n";
import { BauzaunIcon, ConeIcon, EquipmentIndicator, HaltverbotIcon } from "./tree-list-icons";
import {
  activeParkingSigns,
  equipmentQuantity,
  equipmentRequested,
  readTreeMeta,
  treeIdListLabel,
  type EquipmentCategory,
  type TreeListItem,
} from "./tree-list-model";

/** One tree in the site list: compact summary, or action buttons when expanded. */
export function TreeListRow({
  item,
  expanded,
  finishedClean,
  canAct,
  busy,
  coneQty,
  lang,
  tx,
  onToggle,
  onEdit,
  onToggleDone,
  onSafety,
  onCones,
}: {
  item: TreeListItem;
  expanded: boolean;
  finishedClean: boolean;
  canAct: boolean;
  busy: boolean;
  coneQty: number;
  lang: string;
  tx: (path: string) => string;
  onToggle: () => void;
  onEdit: () => void;
  onToggleDone: () => void;
  onSafety: (category: EquipmentCategory) => void;
  onCones: () => void;
}) {
  const isFinishedClean = finishedClean;
  const treeMeta = readTreeMeta(item.notes);

  return (
    <li
                    id={`tree-${item.id}`}
      className={`cursor-pointer px-3 py-2 transition hover:bg-muted/35 ${
        isFinishedClean
          ? "border-l-4 border-l-emerald-400 bg-emerald-50/90 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/45"
          : ""
      }`}
      onClick={onToggle}
    >
    <div className="flex min-h-11 min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <div className="min-w-0 flex-1">
      {expanded ? (
        <div className="text-sm font-semibold" title={item.treeId}>
          {tx("workzone.treeShort")} {treeIdListLabel(item.treeId)}
          {treeMeta.extraTree ? (
            <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {tx("workzone.extraTree")}{treeMeta.addedByName ? ` · ${treeMeta.addedByName}` : ""}
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {item.isEdited ? (
              <span title={t("workzone.manuallyEdited", lang)} className="inline-flex size-2 shrink-0 rounded-full bg-sky-500" />
            ) : null}
            <span className="truncate" title={item.treeId}>
              {tx("workzone.treeSummaryCompact")
                .replace("{id}", treeIdListLabel(item.treeId))
                .replace("{species}", item.species)
                .replace("{diameter}", String(item.diameter))}
            </span>
            {treeMeta.extraTree ? (
              <span className="shrink-0 rounded-full border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                {tx("workzone.extraTree")}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
    {expanded ? (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-md border transition hover:bg-muted disabled:opacity-60"
        disabled={!canAct}
        title={tx("common.edit")}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        className={`h-9 min-w-0 rounded-md border px-3 text-sm transition ${
          item.status === "done"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
            : item.status === "blocked"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
              : "hover:bg-muted"
        }`}
        disabled={!canAct || busy || item.status === "blocked"}
        onClick={onToggleDone}
      >
        {item.status === "done" ? tx("workzone.undo") : item.status === "blocked" ? tx("workzone.blockedStatus") : tx("workzone.treeDoneAction")}
      </button>
      <button
        type="button"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm ${
          equipmentQuantity(item, "FENCE") > 0
            ? "border-emerald-600 bg-emerald-600 text-white"
            : equipmentRequested(item, "FENCE")
              ? "border-red-600 bg-red-600 text-white"
              : "hover:bg-muted"
        }`}
        disabled={!canAct || busy}
        title={t("workzone.barriers", lang)}
        onClick={() => onSafety("FENCE")}
      >
        <BauzaunIcon className="size-5" />
      </button>
      <button
        type="button"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm ${
          equipmentQuantity(item, "SIGN") > 0
            ? "border-emerald-600 bg-emerald-600 text-white"
            : equipmentRequested(item, "SIGN")
              ? "border-red-600 bg-red-600 text-white"
              : "hover:bg-muted"
        }`}
        disabled={!canAct || busy}
        title={t("workzone.haltingBan", lang)}
        onClick={() => onSafety("SIGN")}
      >
        <HaltverbotIcon className="size-5" />
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm hover:bg-muted disabled:opacity-60"
        disabled={!canAct || busy}
        title={t("workzone.cones", lang)}
        onClick={onCones}
      >
        <ConeIcon className="size-5" />
        {coneQty ? (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
            {coneQty}
          </span>
        ) : null}
      </button>
    </div>
    ) : (
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:shrink-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
          disabled={!canAct}
          title={tx("common.edit")}
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          {tx("common.edit")}
        </button>
        <EquipmentIndicator label={t("workzone.barriers", lang)} active={equipmentQuantity(item, "FENCE")} requested={equipmentRequested(item, "FENCE")} lang={lang}>
          <BauzaunIcon className="size-4" />
        </EquipmentIndicator>
        <EquipmentIndicator label={t("workzone.haltingBan", lang)} active={activeParkingSigns(item)} requested={equipmentRequested(item, "SIGN")} lang={lang}>
          <HaltverbotIcon className="size-4" />
        </EquipmentIndicator>
        <EquipmentIndicator label={t("workzone.cones", lang)} active={coneQty} lang={lang}>
          <ConeIcon className="size-4" />
        </EquipmentIndicator>
      </div>
    )}
    </div>
    </li>
  );
}
