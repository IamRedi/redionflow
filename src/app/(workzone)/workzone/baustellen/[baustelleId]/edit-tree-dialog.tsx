"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { t } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { editTreeItemAction } from "../../actions";

import { TreeListItem, readTreeMeta } from "./tree-list-model";

export function EditTreeDialog({
  tree,
  workerId,
  onClose,
  lang,
  companyMode,
}: {
  tree: TreeListItem;
  workerId: string;
  onClose: () => void;
  lang: string;
  companyMode: CompanyMode;
}) {
  const router = useRouter();
  const tx = (path: string) => t(path, lang, companyMode);
  const [species, setSpecies] = useState(tree.species);
  const [diameter, setDiameter] = useState(String(tree.diameter));
  const initialMeta = readTreeMeta(tree.notes);
  const [note, setNote] = useState(initialMeta.note);
  const [branchCutsOver10, setBranchCutsOver10] = useState(initialMeta.branchCutsOver10);
  const [branchCutsOver20, setBranchCutsOver20] = useState(initialMeta.branchCutsOver20);
  const [branchCutsOver30, setBranchCutsOver30] = useState(initialMeta.branchCutsOver30);
  const [extraWork, setExtraWork] = useState(initialMeta.extraWork);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editedAt = tree.lastEditedAt ? new Date(tree.lastEditedAt).toLocaleString() : null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4 py-4">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-md border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{tx("workzone.editTree")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{tx("common.id")}: {tree.treeId}</p>
          </div>
          <button type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-muted" onClick={onClose}>
            {tx("common.close")}
          </button>
        </div>

        <form
          className="space-y-3 overflow-y-auto px-4 py-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage(null);
            setIsSaving(true);
            const result = await editTreeItemAction({
              treeItemId: tree.id,
              workerId,
              species,
              diameter,
              note,
              branchCutsOver10,
              branchCutsOver20,
              branchCutsOver30,
              extraWork,
            });
            setIsSaving(false);

            if (result.ok) {
              router.refresh();
              onClose();
            } else {
              setMessage(result.message);
            }
          }}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`species-${tree.id}`}>
              {tx("workzone.treeType")}
            </label>
            <input
              id={`species-${tree.id}`}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={species}
              onChange={(event) => setSpecies(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`diameter-${tree.id}`}>
              {tx("workzone.treeDiameter")}
            </label>
            <input
              id={`diameter-${tree.id}`}
              type="number"
              min="0"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={diameter}
              onChange={(event) => setDiameter(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`note-${tree.id}`}>
              {tx("workzone.treeNote")}
            </label>
            <textarea
              id={`note-${tree.id}`}
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={tx("workzone.additionalTreeNote")}
            />
          </div>

          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-medium">{tx("workzone.branchCutSection")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor={`branch-over-10-${tree.id}`}>
                  {tx("workzone.branchOver10")}
                </label>
                <input
                  id={`branch-over-10-${tree.id}`}
                  type="number"
                  min="0"
                  max="99"
                  inputMode="numeric"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={branchCutsOver10}
                  onChange={(event) => setBranchCutsOver10(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor={`branch-over-20-${tree.id}`}>
                  {tx("workzone.branchOver20")}
                </label>
                <input
                  id={`branch-over-20-${tree.id}`}
                  type="number"
                  min="0"
                  max="99"
                  inputMode="numeric"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={branchCutsOver20}
                  onChange={(event) => setBranchCutsOver20(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor={`branch-over-30-${tree.id}`}>
                  {tx("workzone.branchOver30")}
                </label>
                <input
                  id={`branch-over-30-${tree.id}`}
                  type="number"
                  min="0"
                  max="99"
                  inputMode="numeric"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={branchCutsOver30}
                  onChange={(event) => setBranchCutsOver30(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`extra-work-${tree.id}`}>
              {tx("workzone.extraWork")}
            </label>
            <select
              id={`extra-work-${tree.id}`}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={extraWork}
              onChange={(event) => setExtraWork(event.target.value)}
            >
              <option value="">{tx("workzone.extraWorkNone")}</option>
              <option value="25% +">{tx("workzone.extraWork25")}</option>
              <option value="50% +">{tx("workzone.extraWork50")}</option>
              <option value="75% +">{tx("workzone.extraWork75")}</option>
              <option value="100% +">{tx("workzone.extraWork100")}</option>
            </select>
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {tree.isEdited ? (
              <span>
                {tx("workzone.lastEditedBy")} {tree.lastEditedBy ?? tx("common.unknown")}
                {editedAt ? ` · ${editedAt}` : ""}
              </span>
            ) : (
              <span>{tx("workzone.notEditedYet")}</span>
            )}
          </div>

          {message ? <p className="text-xs text-destructive">{message}</p> : null}

          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background pt-3">
            <button type="button" className="h-9 rounded-md border px-3 text-sm hover:bg-muted" onClick={onClose}>
              {tx("common.cancel")}
            </button>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              disabled={isSaving || !workerId}
            >
              {isSaving ? tx("common.saving") : tx("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
