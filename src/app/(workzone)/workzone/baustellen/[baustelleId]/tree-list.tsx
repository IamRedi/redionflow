"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScanLine, TreePine } from "lucide-react";

import { ScanGatewayDialog } from "@/components/inventory/scan-gateway-dialog";
import { useLanguage } from "@/components/i18n/language-provider";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { createExtraTreeItemAction } from "../../actions";
import { checkTreeOffline, requestSafetyEquipmentOffline, setSafetyEquipmentQuantityOffline } from "@/lib/workzone/offline/offline-actions";

import {
  CurrentWorker,
  TreeListItem,
  BaustelleTask,
  ExtraTreeDraft,
  EquipmentCategory,
  parseEquipmentStatus,
  activeParkingSigns,
  equipmentQuantity,
  equipmentRequested,
  treeIdListLabel,
  normalizeTreeScanText,
  normalizeExtraTreeIdForUi,
  nextExtraTreeId,
  readScanPayload,
  findTreeByScan,
} from "./tree-list-model";
import { BauzaunIcon, HaltverbotIcon } from "./tree-list-icons";
import { SiteTasksPanel } from "./site-tasks-panel";
import { TreeListRow } from "./tree-list-row";
import { EditTreeDialog } from "./edit-tree-dialog";
import { ExtraTreeDialog } from "./extra-tree-dialog";
import { SafetyPickerDialog } from "./safety-picker-dialog";
import { ConePickerDialog, type ConeMachineOption, type ConeOnTreeMap } from "./cone-picker-dialog";

export function WorkzoneTreeList({
  baustelleId: _baustelleId,
  items,
  currentWorker,
  baustelleTasks,
  coneMachines,
  coneOnTree,
  companyMode = "baumdienst",
}: {
  baustelleId: string;
  items: TreeListItem[];
  currentWorker: CurrentWorker;
  baustelleTasks: BaustelleTask[];
  coneMachines: ConeMachineOption[];
  coneOnTree: ConeOnTreeMap;
  companyMode?: CompanyMode;
}) {
  const { currentLang } = useLanguage();
  const tx = (path: string) => t(path, currentLang, companyMode);
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedTreeId, setExpandedTreeId] = useState<string | null>(null);
  const [editingTree, setEditingTree] = useState<TreeListItem | null>(null);
  const [safetyMessage, setSafetyMessage] = useState<string>();
  const [safetyPickerOpen, setSafetyPickerOpen] = useState(false);
  const [safetyTargetTree, setSafetyTargetTree] = useState<TreeListItem | null>(null);
  const [preferredSafetyCategory, setPreferredSafetyCategory] = useState<EquipmentCategory | null>(null);
  const [coneTargetTree, setConeTargetTree] = useState<TreeListItem | null>(null);
  const [treeConfirmTarget, setTreeConfirmTarget] = useState<TreeListItem | null>(null);
  const [treeConfirmDone, setTreeConfirmDone] = useState(true);
  const [treeScanOpen, setTreeScanOpen] = useState(false);
  const [treeScanValue, setTreeScanValue] = useState("");
  const [treeScanTarget, setTreeScanTarget] = useState<TreeListItem | null>(null);
  const [treeScanMessage, setTreeScanMessage] = useState<string | null>(null);
  const [extraTreeOpen, setExtraTreeOpen] = useState(false);
  const [extraTreeDraft, setExtraTreeDraft] = useState<ExtraTreeDraft>({
    treeId: "",
    species: "",
    diameter: "0",
    note: "",
    scanCode: "",
    scanIdentity: "",
  });
  const [extraTreeMessage, setExtraTreeMessage] = useState<string | null>(null);
  const [safetyQuantityDialog, setSafetyQuantityDialog] = useState<{
    category: EquipmentCategory;
    title: string;
    description: string;
    targetQuantity: number;
  } | null>(null);

  const openBaustelleTasks = baustelleTasks.filter((task) => task.isFlagged);

  const pickerRows = [
    { category: "FENCE" as const, label: t("workzone.barriers", currentLang), icon: <BauzaunIcon className="size-5" /> },
    { category: "SIGN" as const, label: t("workzone.haltingBan", currentLang), icon: <HaltverbotIcon className="size-5" /> },
  ];
  const visiblePickerRows = [...pickerRows].sort((a, b) => {
    if (!preferredSafetyCategory) return 0;
    if (a.category === preferredSafetyCategory) return -1;
    if (b.category === preferredSafetyCategory) return 1;
    return 0;
  });
  const selectedTreeStatus = parseEquipmentStatus(safetyTargetTree?.siteEquipmentStatus);

  async function handleSafetyCategory(category: EquipmentCategory) {
    if (!currentWorker) return;
    if (!safetyTargetTree) return;
    const row = selectedTreeStatus[category];
    const currentQty = Math.max(0, Number(row?.quantity ?? 0) || 0);
    if (currentQty <= 0 && !row?.requested) {
      const result = await requestSafetyEquipmentOffline({ baustelleId: _baustelleId, treeItemId: safetyTargetTree.id, category, workerId: currentWorker.id, companyProfileId: currentWorker.companyProfileId });
      setSafetyMessage(result.message);
      if (result.ok) {
        setSafetyPickerOpen(false);
        setSafetyTargetTree(null);
        setExpandedTreeId(null);
      }
      return;
    }
    setSafetyQuantityDialog({
      category,
      title: currentQty > 0 ? t("workzone.collect", currentLang) : t("workzone.deploy", currentLang),
      description:
        currentQty > 0
          ? t("workzone.collectSafetyPrompt", currentLang).replace("{treeId}", safetyTargetTree.treeId).replace("{qty}", String(currentQty))
          : t("workzone.targetSafetyPrompt", currentLang).replace("{treeId}", safetyTargetTree.treeId),
      targetQuantity: currentQty > 0 ? currentQty : 0,
    });
  }

  function openSafetyPicker(tree: TreeListItem, category: EquipmentCategory) {
    setSafetyMessage(undefined);
    setSafetyTargetTree(tree);
    setPreferredSafetyCategory(category);
    setSafetyPickerOpen(true);
  }

  function openConePicker(tree: TreeListItem) {
    setConeTargetTree(tree);
  }

  function openMaterialScore(tree: TreeListItem) {
    const cones = coneOnTree[tree.id]?.qty ?? 0;
    const parkingSigns = activeParkingSigns(tree);
    const fence = equipmentQuantity(tree, "FENCE");
    const requested = equipmentRequested(tree, "FENCE") || equipmentRequested(tree, "SIGN") ? 1 : 0;
    return cones + parkingSigns + fence + requested;
  }

  const sortedItems = [...items].sort((a, b) => {
    const aMaterialScore = openMaterialScore(a);
    const bMaterialScore = openMaterialScore(b);
    const aHasOpenMaterial = aMaterialScore > 0 ? 1 : 0;
    const bHasOpenMaterial = bMaterialScore > 0 ? 1 : 0;
    if (bHasOpenMaterial !== aHasOpenMaterial) return bHasOpenMaterial - aHasOpenMaterial;
    const materialRank = bMaterialScore - aMaterialScore;
    if (materialRank !== 0) return materialRank;

    const statusRank = (s: TreeListItem["status"]) => (s === "todo" ? 0 : s === "blocked" ? 1 : 2);
    const sr = statusRank(a.status) - statusRank(b.status);
    if (sr !== 0) return sr;
    return String(a.treeId).localeCompare(String(b.treeId), "de");
  });

  function openExtraTreeDialog() {
    setExtraTreeDraft({
      treeId: nextExtraTreeId(items),
      species: "",
      diameter: "0",
      note: "",
      scanCode: "",
      scanIdentity: "",
    });
    setExtraTreeMessage(null);
    setExtraTreeOpen(true);
  }

  function focusTree(tree: TreeListItem) {
    setExpandedTreeId(tree.id);
    setTreeScanOpen(false);
    window.setTimeout(() => {
      document.getElementById(`tree-${tree.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  function prepareExtraTree(raw: string) {
    const payload = readScanPayload(raw);
    setExtraTreeDraft({
      treeId: payload.treeId ? normalizeExtraTreeIdForUi(payload.treeId) : "",
      species: payload.species || "",
      diameter: payload.diameter || "0",
      note: payload.note || "",
      scanCode: payload.scanCode || raw,
      scanIdentity: payload.scanIdentity,
    });
    setExtraTreeMessage(null);
    setTreeScanOpen(false);
    setExtraTreeOpen(true);
  }

  function handleTreeScanDetected(value: string) {
    setTreeScanValue(value);
    const match = findTreeByScan(items, value);
    setTreeScanTarget(match);
    setTreeScanMessage(match ? null : t("workzone.noMatchingTreeExtra", currentLang));
  }

  async function saveExtraTree() {
    if (!currentWorker) return;
    const result = await createExtraTreeItemAction({
      baustelleId: _baustelleId,
      workerId: currentWorker.id,
      treeId: extraTreeDraft.treeId,
      species: extraTreeDraft.species,
      diameter: extraTreeDraft.diameter,
      note: extraTreeDraft.note,
      scanCode: extraTreeDraft.scanCode,
      scanIdentity: extraTreeDraft.scanIdentity,
    });
    setExtraTreeMessage(result.message ?? null);
    if (result.ok) {
      setExtraTreeOpen(false);
      setExtraTreeDraft({ treeId: "", species: "", diameter: "0", note: "", scanCode: "", scanIdentity: "" });
      router.refresh();
    }
  }

  return (
    <div className="min-w-0 space-y-3 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {currentWorker
            ? `${t("workzone.loggedInAs", currentLang)}: ${currentWorker.firstName} ${currentWorker.lastName}${currentWorker.isAdmin ? ` ${t("workzone.adminBadge", currentLang)}` : ""}`
            : t("workzone.readOnlyLoginHint", currentLang)}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {items.filter((i) => i.status === "done").length}/{items.length} {t("workzone.checkedSuffix", currentLang)}
          </div>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-60"
            title={t("workzone.scanTree", currentLang)}
            disabled={!currentWorker}
            onClick={() => {
              setTreeScanOpen(true);
              setTreeScanValue("");
              setTreeScanTarget(null);
              setTreeScanMessage(null);
            }}
          >
            <ScanLine className="size-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
            title={tx("workzone.extraTreeTitle")}
            disabled={!currentWorker}
            onClick={openExtraTreeDialog}
          >
            <span className="relative inline-flex">
              <TreePine className="size-4" />
              <Plus className="absolute -right-2 -top-2 size-3" />
            </span>
            <span>{tx("workzone.extraTreeTitle")}</span>
          </button>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <SiteTasksPanel
          baustelleId={_baustelleId}
          currentWorker={currentWorker}
          openTasks={openBaustelleTasks}
          statusMessage={safetyMessage}
          lang={currentLang}
        />
      </div>

      {sortedItems.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="text-sm font-medium">{tx("workzone.noTasksYet")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{tx("workzone.extraTreeDescription")}</div>
          <button
            type="button"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
            disabled={!currentWorker}
            onClick={openExtraTreeDialog}
          >
            <Plus className="size-4" />
            {tx("workzone.extraTreeTitle")}
          </button>
        </div>
      ) : null}

      {sortedItems.length > 0 ? (
      <ul className="min-w-0 divide-y overflow-hidden rounded-md border">
        {sortedItems.map((item) => {
          return (
            <TreeListRow
              key={item.id}
              item={item}
              expanded={expandedTreeId === item.id}
              finishedClean={item.status === "done" && openMaterialScore(item) <= 0}
              canAct={Boolean(currentWorker)}
              busy={busyId === item.id}
              coneQty={coneOnTree[item.id]?.qty ?? 0}
              lang={currentLang}
              tx={tx}
              onToggle={() => setExpandedTreeId((current) => (current === item.id ? null : item.id))}
              onEdit={() => {
                setExpandedTreeId(item.id);
                setEditingTree(item);
              }}
              onToggleDone={() => {
                if (!currentWorker) return;
                setTreeConfirmTarget(item);
                setTreeConfirmDone(item.status !== "done");
              }}
              onSafety={(category) => openSafetyPicker(item, category)}
              onCones={() => openConePicker(item)}
            />
          );
        })}
      </ul>
      ) : null}
      <ScanGatewayDialog
        open={treeScanOpen}
        title={tx("workzone.scanTree")}
        description={tx("workzone.scanTreeDescription")}
        value={treeScanValue}
        normalizeValue={normalizeTreeScanText}
        onDetected={handleTreeScanDetected}
        confirmLabel={treeScanTarget ? tx("workzone.goToTree") : tx("workzone.extraTree")}
        confirmDisabled={!treeScanValue || !currentWorker}
        onCancel={() => {
          setTreeScanOpen(false);
          setTreeScanValue("");
          setTreeScanTarget(null);
          setTreeScanMessage(null);
        }}
        onConfirm={() => {
          if (treeScanTarget) {
            focusTree(treeScanTarget);
            return;
          }
          prepareExtraTree(treeScanValue);
        }}
      >
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{tx("workzone.scanLabel")}</div>
          <div className="break-all font-mono text-sm">{treeScanValue}</div>
          {treeScanTarget ? (
            <p className="text-sm">
              {tx("workzone.scanFound")}: {tx("workzone.treeShort")} {treeIdListLabel(treeScanTarget.treeId)} · {treeScanTarget.species}
            </p>
          ) : (
            <p className="text-sm text-amber-700">{treeScanMessage ?? tx("workzone.noMatchingTreeExtra")}</p>
          )}
        </div>
      </ScanGatewayDialog>

      <ExtraTreeDialog
        open={extraTreeOpen}
        draft={extraTreeDraft}
        onDraftChange={setExtraTreeDraft}
        message={extraTreeMessage}
        canSave={Boolean(currentWorker) && Boolean(extraTreeDraft.species.trim())}
        tx={tx}
        onCancel={() => {
          setExtraTreeOpen(false);
          setExtraTreeMessage(null);
        }}
        onConfirm={saveExtraTree}
      />

      {safetyPickerOpen && safetyTargetTree ? (
        <SafetyPickerDialog
          tree={safetyTargetTree}
          rows={visiblePickerRows}
          status={selectedTreeStatus}
          busy={busyId === "__safety__"}
          message={safetyMessage}
          lang={currentLang}
          onClose={() => setSafetyPickerOpen(false)}
          onPick={async (category) => {
            setBusyId("__safety__");
            await handleSafetyCategory(category);
            setBusyId(null);
          }}
          onRemoveRequest={async (category) => {
            if (!currentWorker) return;
            setBusyId("__safety__");
            const result = await setSafetyEquipmentQuantityOffline({
              baustelleId: _baustelleId,
              treeItemId: safetyTargetTree.id,
              category,
              targetQuantity: 0,
              workerId: currentWorker.id,
              companyProfileId: currentWorker.companyProfileId,
            });
            setSafetyMessage(result.message);
            if (result.ok) {
              setSafetyPickerOpen(false);
              setSafetyTargetTree(null);
              setExpandedTreeId(null);
            }
            setBusyId(null);
          }}
        />
      ) : null}

      {coneTargetTree ? (
        <ConePickerDialog
          key={coneTargetTree.id}
          tree={coneTargetTree}
          baustelleId={_baustelleId}
          canAct={Boolean(currentWorker)}
          coneMachines={coneMachines}
          coneOnTree={coneOnTree}
          lang={currentLang}
          onClose={() => setConeTargetTree(null)}
          onDone={() => {
            setConeTargetTree(null);
            setExpandedTreeId(null);
          }}
        />
      ) : null}

      {editingTree && currentWorker ? (
        <EditTreeDialog
          tree={editingTree}
          workerId={currentWorker.id}
          lang={currentLang}
          companyMode={companyMode}
          onClose={() => {
            setEditingTree(null);
            setExpandedTreeId(null);
          }}
        />
      ) : null}

      <SimpleDialog
        open={Boolean(treeConfirmTarget && currentWorker)}
        title={t("common.confirm", currentLang)}
        description={
          treeConfirmTarget
            ? (
                treeConfirmDone
                  ? t("workzone.confirmTreeDone", currentLang)
                  : t("workzone.confirmTreeUndo", currentLang)
              ).replace("{treeId}", treeConfirmTarget.treeId)
            : null
        }
        confirmLabel={treeConfirmDone ? t("workzone.treeDoneAction", currentLang) : t("workzone.undo", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        onCancel={() => setTreeConfirmTarget(null)}
        onConfirm={async () => {
          if (!currentWorker || !treeConfirmTarget) return;
          setBusyId(treeConfirmTarget.id);
          const result = await checkTreeOffline({
            treeItemId: treeConfirmTarget.id,
            workerId: currentWorker.id,
            companyProfileId: currentWorker.companyProfileId,
            baustelleId: _baustelleId,
            done: treeConfirmDone,
            baseUpdatedAt: treeConfirmTarget.lastEditedAt
              ? new Date(treeConfirmTarget.lastEditedAt).toISOString()
              : undefined,
          });
          setBusyId(null);
          setExpandedTreeId(null);
          setTreeConfirmTarget(null);
          if (result.ok && !("queued" in result)) router.refresh();
        }}
      />

      <SimpleDialog
        open={Boolean(safetyQuantityDialog)}
        title={safetyQuantityDialog?.title ?? t("common.confirm", currentLang)}
        description={safetyQuantityDialog?.description ?? null}
        confirmLabel={t("common.save", currentLang)}
        cancelLabel={t("common.cancel", currentLang)}
        onCancel={() => setSafetyQuantityDialog(null)}
        onConfirm={async () => {
          if (!safetyTargetTree || !safetyQuantityDialog) return;
          const row = selectedTreeStatus[safetyQuantityDialog.category];
          const currentQty = Math.max(0, Number(row?.quantity ?? 0) || 0);
          const enteredQuantity = Math.max(0, Math.floor(Number(safetyQuantityDialog.targetQuantity) || 0));
          const targetQuantity = currentQty > 0 ? Math.max(0, currentQty - Math.min(currentQty, enteredQuantity)) : enteredQuantity;
          if (!currentWorker) return;
          const result = await setSafetyEquipmentQuantityOffline({
            baustelleId: _baustelleId,
            treeItemId: safetyTargetTree.id,
            category: safetyQuantityDialog.category,
            targetQuantity,
            workerId: currentWorker.id,
            companyProfileId: currentWorker.companyProfileId,
          });
          setSafetyMessage(result.message);
          if (result.ok) {
            setSafetyPickerOpen(false);
            setSafetyTargetTree(null);
            setExpandedTreeId(null);
            setSafetyQuantityDialog(null);
          }
        }}
      >
        <input
          type="number"
          min={0}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={String(safetyQuantityDialog?.targetQuantity ?? 0)}
          onChange={(event) =>
            setSafetyQuantityDialog((current) =>
              current
                ? {
                    ...current,
                    targetQuantity: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                  }
                : current,
            )
          }
        />
      </SimpleDialog>
    </div>
  );
}
