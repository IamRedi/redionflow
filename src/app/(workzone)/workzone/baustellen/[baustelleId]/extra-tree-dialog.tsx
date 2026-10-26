"use client";

import type { Dispatch, SetStateAction } from "react";

import { SimpleDialog } from "@/components/ui/simple-dialog";
import { normalizeExtraTreeIdForUi, type ExtraTreeDraft } from "./tree-list-model";

/** Form for a tree found on site that is not in the imported tree list. */
export function ExtraTreeDialog({
  open,
  draft,
  onDraftChange,
  message,
  canSave,
  tx,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  draft: ExtraTreeDraft;
  onDraftChange: Dispatch<SetStateAction<ExtraTreeDraft>>;
  message: string | null;
  canSave: boolean;
  tx: (path: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const extraTreeDraft = draft;
  const extraTreeMessage = message;
  return (
    <SimpleDialog
      open={open}
      title={tx("workzone.extraTreeTitle")}
      description={tx("workzone.extraTreeDescription")}
      confirmLabel={tx("common.save")}
      cancelLabel={tx("common.cancel")}
      confirmDisabled={!canSave}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{tx("workzone.treeIdOptional")}</span>
          <input
            name="extraTreeId"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={extraTreeDraft.treeId}
            onChange={(event) => onDraftChange((current) => ({ ...current, treeId: normalizeExtraTreeIdForUi(event.target.value) }))}
            placeholder={tx("workzone.extraTreeIdPlaceholder")}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{tx("workzone.treeTypeWork")}</span>
          <input
            name="extraTreeSpecies"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={extraTreeDraft.species}
            onChange={(event) => onDraftChange((current) => ({ ...current, species: event.target.value }))}
            placeholder={tx("workzone.extraTreeSpeciesPlaceholder")}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{tx("workzone.treeDiameter")}</span>
          <input
            name="extraTreeDiameter"
            type="number"
            min="0"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={extraTreeDraft.diameter}
            onChange={(event) => onDraftChange((current) => ({ ...current, diameter: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{tx("common.note")}</span>
          <textarea
            name="extraTreeNote"
            className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
            value={extraTreeDraft.note}
            onChange={(event) => onDraftChange((current) => ({ ...current, note: event.target.value }))}
            placeholder={tx("workzone.extraTreeNotePlaceholder")}
          />
        </label>
        {extraTreeDraft.scanCode ? <div className="text-xs text-muted-foreground">{tx("workzone.extraTreeScanSaved")}</div> : null}
        {extraTreeMessage ? <p className="text-xs text-muted-foreground">{extraTreeMessage}</p> : null}
      </div>
    </SimpleDialog>
  );
}
