"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ScanLine, TreePine } from "lucide-react";

import { ScanGatewayDialog } from "@/components/inventory/scan-gateway-dialog";
import { useLanguage } from "@/components/i18n/language-provider";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { t } from "@/lib/i18n";
import type { CompanyMode } from "@/lib/mode-config";
import { createExtraTreeItemAction, editTreeItemAction } from "../../actions";
import {
  addManualTaskOffline,
  checkTreeOffline,
  clearManualTaskOffline,
} from "@/lib/workzone/offline/offline-actions";
import {
  requestSafetyEquipmentOffline,
  setSafetyEquipmentQuantityOffline,
} from "@/lib/workzone/offline/offline-actions";
import { collectConesAction, deployConesAction } from "../../cone-actions";
import { isRecord } from "@/lib/workzone/site-json";

type CurrentWorker = {
  id: string;
  firstName: string;
  lastName: string;
  isTemporary: boolean;
  level: string;
  isAdmin?: boolean;
  companyProfileId: string;
} | null;

type TreeListItem = {
  id: string;
  treeId: string;
  species: string;
  diameter: number;
  status: "todo" | "done" | "blocked";
  isEdited: boolean;
  lastEditedBy: string | null;
  lastEditedAt: Date | string | null;
  notes: string | null;
  siteEquipmentStatus?: unknown;
};

type BaustelleTask = {
  id: string;
  description: string;
  isFlagged: boolean;
  createdAt: Date | string;
  user?: { name: string | null; email: string | null } | null;
  worker?: { firstName: string; lastName: string } | null;
};

type ExtraTreeDraft = {
  treeId: string;
  species: string;
  diameter: string;
  note: string;
  scanCode: string;
  scanIdentity: string;
};

function readTreeMeta(notes: string | null) {
  if (!notes) {
    return {
      note: "",
      haltverbot: false,
      branchCutsOver10: "",
      branchCutsOver20: "",
      branchCutsOver30: "",
      extraWork: "",
      extraTree: false,
      addedByName: "",
      scanCode: "",
      scanIdentity: "",
    };
  }
  try {
    const parsed = JSON.parse(notes) as {
      note?: unknown;
      haltverbot?: unknown;
      branchCutsOver10?: unknown;
      branchCutsOver20?: unknown;
      branchCutsOver30?: unknown;
      extraWork?: unknown;
      extraTree?: unknown;
      addedByName?: unknown;
      scanCode?: unknown;
      scanIdentity?: unknown;
      nfcCode?: unknown;
      qrCode?: unknown;
    };
    return {
      note: typeof parsed?.note === "string" ? parsed.note : "",
      haltverbot: Boolean(parsed?.haltverbot),
      branchCutsOver10:
        typeof parsed?.branchCutsOver10 === "number" || typeof parsed?.branchCutsOver10 === "string"
          ? String(parsed.branchCutsOver10)
          : "",
      branchCutsOver20:
        typeof parsed?.branchCutsOver20 === "number" || typeof parsed?.branchCutsOver20 === "string"
          ? String(parsed.branchCutsOver20)
          : "",
      branchCutsOver30:
        typeof parsed?.branchCutsOver30 === "number" || typeof parsed?.branchCutsOver30 === "string"
          ? String(parsed.branchCutsOver30)
          : "",
      extraWork:
        parsed?.extraWork === "25% +" ||
        parsed?.extraWork === "50% +" ||
        parsed?.extraWork === "75% +" ||
        parsed?.extraWork === "100% +"
          ? parsed.extraWork
          : "",
      extraTree: Boolean(parsed?.extraTree),
      addedByName: typeof parsed?.addedByName === "string" ? parsed.addedByName : "",
      scanCode: typeof parsed?.scanCode === "string" ? parsed.scanCode : "",
      scanIdentity: typeof parsed?.scanIdentity === "string" ? parsed.scanIdentity : "",
    };
  } catch {
    return {
      note: "",
      haltverbot: false,
      branchCutsOver10: "",
      branchCutsOver20: "",
      branchCutsOver30: "",
      extraWork: "",
      extraTree: false,
      addedByName: "",
      scanCode: "",
      scanIdentity: "",
    };
  }
}

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

function activeParkingSigns(tree: TreeListItem) {
  return Math.max(0, Number(parseEquipmentStatus(tree.siteEquipmentStatus).SIGN?.quantity ?? 0) || 0);
}

function equipmentQuantity(tree: TreeListItem, category: EquipmentCategory) {
  return Math.max(0, Number(parseEquipmentStatus(tree.siteEquipmentStatus)[category]?.quantity ?? 0) || 0);
}

function equipmentRequested(tree: TreeListItem, category: EquipmentCategory) {
  const row = parseEquipmentStatus(tree.siteEquipmentStatus)[category];
  return Boolean(row?.requested) && (row?.quantity ?? 0) <= 0;
}

function treeIdListLabel(treeId: string) {
  const trimmed = String(treeId ?? "").trim();
  if (!trimmed.includes(":")) return trimmed;
  const visible = trimmed.split(":").at(-1)?.trim();
  return visible || trimmed;
}

function normalizeTreeScanText(value: string) {
  return value.trim();
}

function normalizeExtraTreeIdForUi(value: string) {
  return value.trim().replace(/\s+/g, "-").slice(0, 80);
}

function nextExtraTreeId(items: TreeListItem[]) {
  const numericIds = items
    .map((item) => Number(treeIdListLabel(item.treeId)))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = numericIds.length > 0 ? Math.max(...numericIds) + 1 : items.length + 1;
  return String(next);
}

function compareKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function scanIdentity(value: unknown) {
  return compareKey(value);
}

function readScanPayload(raw: string) {
  const text = raw.trim();
  const payload: Record<string, string> = {};

  function remember(key: string, value: unknown) {
    const normalizedKey = compareKey(key);
    const stringValue = String(value ?? "").trim();
    if (normalizedKey && stringValue) payload[normalizedKey] = stringValue;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) remember(key, value);
    }
  } catch {
    try {
      const url = new URL(text);
      url.searchParams.forEach((value, key) => remember(key, value));
      remember("id", url.hash.replace(/^#/, ""));
    } catch {
      const query = text.includes("=") ? text : "";
      if (query) new URLSearchParams(query.replace(/^[?#]/, "")).forEach((value, key) => remember(key, value));
    }
  }

  const hasStructuredPayload = Object.keys(payload).length > 0;
  const treeId =
    payload.treeid ||
    payload.baumid ||
    payload.baumnummer ||
    payload.baumnr ||
    payload.standortnr ||
    payload.id ||
    (hasStructuredPayload ? "" : text);
  const species = payload.species || payload.baumart || payload.art || payload.gattung || payload.name || "";
  const diameter = payload.diameter || payload.durchmesser || payload.stammdurchmesser || payload.dbh || "";
  const note = payload.note || payload.notiz || payload.action || payload.massnahme || "";
  const explicitScanCode =
    payload.scancode ||
    payload.code ||
    payload.qr ||
    payload.qrcode ||
    payload.nfc ||
    payload.nfcid ||
    payload.uid ||
    payload.uuid ||
    payload.tag ||
    payload.tagid ||
    payload.serial ||
    payload.token ||
    payload.ref ||
    payload.reference ||
    "";
  const identifiers = Array.from(new Set([treeId, explicitScanCode, ...Object.values(payload), text].map(String).map((item) => item.trim()).filter(Boolean)));

  return {
    treeId: String(treeId ?? "").trim(),
    species: String(species ?? "").trim(),
    diameter: String(diameter ?? "").trim(),
    note: String(note ?? "").trim(),
    scanCode: explicitScanCode || text,
    scanIdentity: scanIdentity(explicitScanCode || treeId || text),
    identifiers,
  };
}

function findTreeByScan(items: TreeListItem[], raw: string) {
  const scan = readScanPayload(raw);
  const candidates = Array.from(new Set([scan.treeId, scan.scanCode, scan.scanIdentity, raw, ...scan.identifiers].map(scanIdentity).filter(Boolean)));
  const scanMatch = items.find((item) => {
    const meta = readTreeMeta(item.notes);
    const storedKeys = [meta.scanIdentity, meta.scanCode].map(scanIdentity).filter(Boolean);
    return candidates.some((candidate) => storedKeys.includes(candidate));
  });
  if (scanMatch) return scanMatch;

  const idMatch = items.find((item) => {
    const keys = [item.treeId, treeIdListLabel(item.treeId)].map(compareKey);
    return candidates.some((candidate) => keys.includes(candidate));
  });
  if (idMatch) return idMatch;

  const speciesKey = compareKey(scan.species || scan.treeId);
  if (!speciesKey) return null;
  const speciesMatches = items.filter((item) => compareKey(item.species) === speciesKey);
  return speciesMatches.length === 1 ? speciesMatches[0] : null;
}

function BauzaunIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M5 25V7M27 25V7M11 25V9M17 25V9M23 25V9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 10H28M4 16H28M4 22H28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 22L12 16L6 10M12 22L18 16L12 10M18 22L24 16L18 10M24 22L28 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function HaltverbotIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="white" stroke="#dc2626" strokeWidth="4" />
      <path d="M10 10L22 22M22 10L10 22" stroke="#dc2626" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function ConeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 4L7 26H25L16 4Z" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.2 13H19.8M10.2 18H21.8M8.6 23H23.4" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 26H27" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function EquipmentIndicator({
  label,
  active,
  requested,
  children,
  lang,
}: {
  label: string;
  active: number;
  requested?: boolean;
  children: ReactNode;
  lang: string;
}) {
  if (active <= 0 && !requested) return null;
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border px-1.5 text-[11px] font-semibold ${
        active > 0
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-200"
      }`}
      title={active > 0 ? `${label}: ${active} ${t("workzone.onSite", lang)}` : `${label}: ${t("workzone.requested", lang)}`}
    >
      {children}
      {active > 0 ? <span>{active}</span> : <span>?</span>}
    </span>
  );
}

function EditTreeDialog({
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
  coneMachines: Array<{ id: string; label: string; available: number }>;
  coneOnTree: Record<string, { qty: number; machines?: Record<string, number> }>;
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
  const [conePickerOpen, setConePickerOpen] = useState(false);
  const [coneTargetTree, setConeTargetTree] = useState<TreeListItem | null>(null);
  const [coneMachineId, setConeMachineId] = useState<string>("");
  const [coneOriginMachineId, setConeOriginMachineId] = useState<string>("");
  const [coneQty, setConeQty] = useState<string>("0");
  const [coneMessage, setConeMessage] = useState<string>();
  const [siteNote, setSiteNote] = useState("");
  const [siteNoteMessage, setSiteNoteMessage] = useState<string | null>(null);
  const [siteNoteBusy, setSiteNoteBusy] = useState(false);
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
    setConeMessage(undefined);
    setConeTargetTree(tree);
    setConePickerOpen(true);
    setConeQty("0");
    const first = coneMachines.find((m) => m.available > 0)?.id ?? "";
    setConeMachineId(first);
    const machineCounts = coneOnTree[tree.id]?.machines ?? {};
    const suggestedOrigin = Object.entries(machineCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? "";
    setConeOriginMachineId(suggestedOrigin);
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

  const coneQuantity = Math.floor(Number(coneQty) || 0);
  const hasConeQuantity = Number.isFinite(coneQuantity) && coneQuantity > 0;
  const selectedConeAvailable = coneMachines.find((m) => m.id === coneMachineId)?.available ?? 0;
  const selectedConeOnTree = coneTargetTree ? (coneOnTree[coneTargetTree.id]?.qty ?? 0) : 0;
  const canDeployCones = Boolean(currentWorker && coneTargetTree && coneMachineId && hasConeQuantity && selectedConeAvailable >= coneQuantity);
  const canCollectCones = Boolean(currentWorker && coneTargetTree && coneMachineId && hasConeQuantity && selectedConeOnTree >= coneQuantity);

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
        <form
          className="flex w-full min-w-0 flex-col gap-2 rounded-md border bg-muted/20 p-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!currentWorker) return;
            setSiteNoteMessage(null);
            setSiteNoteBusy(true);
            const result = await addManualTaskOffline({
              baustelleId: _baustelleId,
              workerId: currentWorker.id,
              companyProfileId: currentWorker.companyProfileId,
              description: siteNote,
            });
            setSiteNoteBusy(false);
            setSiteNoteMessage(
              result.message === "offline_queued"
                ? t("workzone.offlineActionQueued", currentLang)
                : (result.message ?? null),
            );
            if (result.ok && !("queued" in result)) {
              setSiteNote("");
              router.refresh();
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium">{t("workzone.siteNeedsAttentionTitle", currentLang)}</div>
            {openBaustelleTasks.length > 0 ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                {t("workzone.siteNeedsAttentionBadge", currentLang).replace("{count}", String(openBaustelleTasks.length))}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              placeholder={t("workzone.siteNeedsAttentionPlaceholder", currentLang)}
              value={siteNote}
              onChange={(event) => setSiteNote(event.target.value)}
              disabled={!currentWorker || siteNoteBusy}
            />
            <button
              type="submit"
              className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
              disabled={!currentWorker || siteNoteBusy || siteNote.trim().length === 0}
            >
              {t("workzone.markSiteTask", currentLang)}
            </button>
          </div>
          {!currentWorker ? (
            <div className="text-xs text-muted-foreground">{t("workzone.manualTaskPermission", currentLang)}</div>
          ) : null}
          {siteNoteMessage ? <span className="text-xs text-muted-foreground">{siteNoteMessage}</span> : null}
          {safetyMessage ? <span className="text-xs text-muted-foreground">{safetyMessage}</span> : null}
          {openBaustelleTasks.length > 0 ? (
            <ul className="space-y-1">
              {openBaustelleTasks.slice(0, 3).map((task) => {
                const author =
                  task.worker
                    ? `${task.worker.firstName} ${task.worker.lastName}`.trim()
                    : task.user?.name ?? task.user?.email ?? t("common.unknown", currentLang);
                return (
                  <li key={task.id} className="flex items-start justify-between gap-2 rounded-md border bg-background px-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{task.description}</div>
                      <div className="mt-0.5 text-muted-foreground">
                        {author} · {new Date(task.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-60"
                      disabled={!currentWorker || siteNoteBusy}
                      onClick={async () => {
                        if (!currentWorker) return;
                        setSiteNoteBusy(true);
                        setSiteNoteMessage(null);
                        const result = await clearManualTaskOffline({
                          taskId: task.id,
                          workerId: currentWorker.id,
                          companyProfileId: currentWorker.companyProfileId,
                          baustelleId: _baustelleId,
                        });
                        setSiteNoteBusy(false);
                        setSiteNoteMessage(
                          result.message === "offline_queued"
                            ? t("workzone.offlineActionQueued", currentLang)
                            : (result.message ?? null),
                        );
                        if (result.ok && !("queued" in result)) router.refresh();
                      }}
                    >
                      {t("workzone.clearSiteTask", currentLang)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </form>
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
          const isFinishedClean = item.status === "done" && openMaterialScore(item) <= 0;
          const treeMeta = readTreeMeta(item.notes);

          return (
            <li
              key={item.id}
              id={`tree-${item.id}`}
              className={`cursor-pointer px-3 py-2 transition hover:bg-muted/35 ${
                isFinishedClean
                  ? "border-l-4 border-l-emerald-400 bg-emerald-50/90 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/45"
                  : ""
              }`}
              onClick={() => setExpandedTreeId((current) => (current === item.id ? null : item.id))}
            >
            <div className="flex min-h-11 min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              {expandedTreeId === item.id ? (
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
                      <span title={t("workzone.manuallyEdited", currentLang)} className="inline-flex size-2 shrink-0 rounded-full bg-sky-500" />
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
            {expandedTreeId === item.id ? (
            <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-md border transition hover:bg-muted disabled:opacity-60"
                disabled={!currentWorker}
                title={tx("common.edit")}
                onClick={() => setEditingTree(item)}
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
                disabled={!currentWorker || busyId === item.id || item.status === "blocked"}
                onClick={async () => {
                  if (!currentWorker) return;
                  setTreeConfirmTarget(item);
                  setTreeConfirmDone(item.status !== "done");
                }}
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
                disabled={!currentWorker || busyId === item.id}
                title={t("workzone.barriers", currentLang)}
                onClick={() => openSafetyPicker(item, "FENCE")}
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
                disabled={!currentWorker || busyId === item.id}
                title={t("workzone.haltingBan", currentLang)}
                onClick={() => openSafetyPicker(item, "SIGN")}
              >
                <HaltverbotIcon className="size-5" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm hover:bg-muted disabled:opacity-60"
                disabled={!currentWorker || busyId === item.id}
                title={t("workzone.cones", currentLang)}
                onClick={() => openConePicker(item)}
              >
                <ConeIcon className="size-5" />
                {coneOnTree[item.id]?.qty ? (
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                    {coneOnTree[item.id]?.qty}
                  </span>
                ) : null}
              </button>
            </div>
            ) : (
              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:shrink-0" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
                  disabled={!currentWorker}
                  title={tx("common.edit")}
                  onClick={() => {
                    setExpandedTreeId(item.id);
                    setEditingTree(item);
                  }}
                >
                  <Pencil className="size-3.5" />
                  {tx("common.edit")}
                </button>
                <EquipmentIndicator label={t("workzone.barriers", currentLang)} active={equipmentQuantity(item, "FENCE")} requested={equipmentRequested(item, "FENCE")} lang={currentLang}>
                  <BauzaunIcon className="size-4" />
                </EquipmentIndicator>
                <EquipmentIndicator label={t("workzone.haltingBan", currentLang)} active={activeParkingSigns(item)} requested={equipmentRequested(item, "SIGN")} lang={currentLang}>
                  <HaltverbotIcon className="size-4" />
                </EquipmentIndicator>
                <EquipmentIndicator label={t("workzone.cones", currentLang)} active={coneOnTree[item.id]?.qty ?? 0} lang={currentLang}>
                  <ConeIcon className="size-4" />
                </EquipmentIndicator>
              </div>
            )}
            </div>
            </li>
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

      <SimpleDialog
        open={extraTreeOpen}
        title={tx("workzone.extraTreeTitle")}
        description={tx("workzone.extraTreeDescription")}
        confirmLabel={tx("common.save")}
        cancelLabel={tx("common.cancel")}
        confirmDisabled={!currentWorker || !extraTreeDraft.species.trim()}
        onCancel={() => {
          setExtraTreeOpen(false);
          setExtraTreeMessage(null);
        }}
        onConfirm={saveExtraTree}
      >
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{tx("workzone.treeIdOptional")}</span>
            <input
              name="extraTreeId"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={extraTreeDraft.treeId}
              onChange={(event) => setExtraTreeDraft((current) => ({ ...current, treeId: normalizeExtraTreeIdForUi(event.target.value) }))}
              placeholder={tx("workzone.extraTreeIdPlaceholder")}
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{tx("workzone.treeTypeWork")}</span>
            <input
              name="extraTreeSpecies"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={extraTreeDraft.species}
              onChange={(event) => setExtraTreeDraft((current) => ({ ...current, species: event.target.value }))}
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
              onChange={(event) => setExtraTreeDraft((current) => ({ ...current, diameter: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t("common.note", currentLang)}</span>
            <textarea
              name="extraTreeNote"
              className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
              value={extraTreeDraft.note}
              onChange={(event) => setExtraTreeDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder={tx("workzone.extraTreeNotePlaceholder")}
            />
          </label>
          {extraTreeDraft.scanCode ? <div className="text-xs text-muted-foreground">{tx("workzone.extraTreeScanSaved")}</div> : null}
          {extraTreeMessage ? <p className="text-xs text-muted-foreground">{extraTreeMessage}</p> : null}
        </div>
      </SimpleDialog>

      {safetyPickerOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-3">
          <div className="w-full max-w-sm rounded-md border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{t("workzone.safetyTreeTitle", currentLang)}</h3>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {safetyTargetTree ? `${t("workzone.treeShort", currentLang)} ${safetyTargetTree.treeId}` : "-"}
                </div>
              </div>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setSafetyPickerOpen(false)}>
                {t("common.close", currentLang)}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {visiblePickerRows.map((item) => {
                const row = selectedTreeStatus[item.category];
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
                      onClick={async () => {
                        setBusyId("__safety__");
                        await handleSafetyCategory(item.category);
                        setBusyId(null);
                      }}
                      disabled={busyId === "__safety__"}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <span className="inline-flex size-6 items-center justify-center">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {qty > 0
                          ? t("workzone.activeGreenOnSite", currentLang).replace("{qty}", String(qty))
                          : requested
                            ? t("workzone.requestedRedPending", currentLang)
                            : t("workzone.notPlaced", currentLang)}
                      </div>
                    </button>
                    {requested ? (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                          disabled={busyId === "__safety__"}
                          onClick={async () => {
                            if (!safetyTargetTree) return;
                            setBusyId("__safety__");
                            if (!currentWorker) return;
                            const result = await setSafetyEquipmentQuantityOffline({
                              baustelleId: _baustelleId,
                              treeItemId: safetyTargetTree.id,
                              category: item.category,
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
                        >
                          {t("workzone.removeRequest", currentLang)}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {safetyMessage ? <p className="mt-2 text-xs text-muted-foreground">{safetyMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {conePickerOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-3">
          <div className="w-full max-w-sm rounded-md border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{t("workzone.conesTreeTitle", currentLang)}</h3>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {coneTargetTree ? `${t("workzone.treeShort", currentLang)} ${coneTargetTree.treeId}` : "-"}
                </div>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => {
                  setConePickerOpen(false);
                  setConeTargetTree(null);
                }}
              >
                {t("common.close", currentLang)}
              </button>
            </div>

            <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              {t("workzone.currentOnSite", currentLang)}: <span className="font-semibold text-foreground">{selectedConeOnTree}</span>
            </div>

            <div className="mt-3 space-y-2">
              <div className="space-y-1">
                <div className="text-xs font-medium">{t("workzone.machine", currentLang)}</div>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={coneMachineId}
                  onChange={(e) => setConeMachineId(e.target.value)}
                >
                  <option value="">{t("workzone.machinePlaceholder", currentLang)}</option>
                  {coneMachines
                    .slice()
                    .sort((a, b) => b.available - a.available)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} · {t("workzone.available", currentLang)} {m.available}
                      </option>
                    ))}
                </select>
              </div>

              {(coneTargetTree ? (coneOnTree[coneTargetTree.id]?.qty ?? 0) : 0) > 0 ? (
                <div className="space-y-1">
                  <div className="text-xs font-medium">{t("workzone.coneOriginSuggestion", currentLang)}</div>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={coneOriginMachineId}
                    onChange={(e) => setConeOriginMachineId(e.target.value)}
                  >
                    <option value="">{t("workzone.unknownUnassigned", currentLang)}</option>
                    {Object.entries(coneTargetTree ? (coneOnTree[coneTargetTree.id]?.machines ?? {}) : {})
                      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                      .map(([machineId, count]) => {
                        const label = coneMachines.find((m) => m.id === machineId)?.label ?? machineId;
                        return (
                          <option key={machineId} value={machineId}>
                            {label} · {t("workzone.onTree", currentLang)} {count}
                          </option>
                        );
                      })}
                  </select>
                  <div className="text-[11px] text-muted-foreground">
                    {t("workzone.coneOriginHint", currentLang)}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1">
                <div className="text-xs font-medium">{t("common.quantity", currentLang)}</div>
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
                    if (!currentWorker || !coneTargetTree) return;
                    const qty = coneQuantity;
                    const available = selectedConeAvailable;
                    if (available < qty) {
                      setConeMessage(`${t("workzone.notEnoughConesMachine", currentLang)} ${available}`);
                      return;
                    }
                    const fd = new FormData();
                    fd.set("baustelleId", _baustelleId);
                    fd.set("treeItemId", coneTargetTree.id);
                    fd.set("machineId", coneMachineId);
                    fd.set("quantity", String(qty));
                    const res = await deployConesAction(fd);
                    setConeMessage(res.message);
                    if (res.ok) {
                      setConePickerOpen(false);
                      setConeTargetTree(null);
                      setExpandedTreeId(null);
                    }
                  }}
                >
                  {t("workzone.deploy", currentLang)}
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-60"
                  disabled={!canCollectCones}
                  onClick={async () => {
                    if (!currentWorker || !coneTargetTree) return;
                    const qty = coneQuantity;
                    if (selectedConeOnTree < qty) {
                      setConeMessage(`${t("workzone.notEnoughConesSite", currentLang)} ${selectedConeOnTree}`);
                      return;
                    }
                    const fd = new FormData();
                    fd.set("baustelleId", _baustelleId);
                    fd.set("treeItemId", coneTargetTree.id);
                    fd.set("machineId", coneMachineId);
                    if (coneOriginMachineId) fd.set("originMachineId", coneOriginMachineId);
                    fd.set("quantity", String(qty));
                    const res = await collectConesAction(fd);
                    setConeMessage(res.message);
                    if (res.ok) {
                      setConePickerOpen(false);
                      setConeTargetTree(null);
                      setExpandedTreeId(null);
                    }
                  }}
                >
                  {t("workzone.collect", currentLang)}
                </button>
              </div>
            </div>
          </div>
        </div>
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
