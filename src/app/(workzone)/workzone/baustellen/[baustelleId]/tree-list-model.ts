/** Pure data helpers for the Workzone tree list: note metadata, equipment status and scan matching. */

import { isRecord } from "@/lib/workzone/site-json";

export type CurrentWorker = {
  id: string;
  firstName: string;
  lastName: string;
  isTemporary: boolean;
  level: string;
  isAdmin?: boolean;
  companyProfileId: string;
} | null;

export type TreeListItem = {
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

export type BaustelleTask = {
  id: string;
  description: string;
  isFlagged: boolean;
  createdAt: Date | string;
  user?: { name: string | null; email: string | null } | null;
  worker?: { firstName: string; lastName: string } | null;
};

export type ExtraTreeDraft = {
  treeId: string;
  species: string;
  diameter: string;
  note: string;
  scanCode: string;
  scanIdentity: string;
};

export function readTreeMeta(notes: string | null) {
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

export type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";
export type EquipmentStatusMap = Partial<Record<EquipmentCategory, { requested: boolean; quantity: number }>>;

export function parseEquipmentStatus(value: unknown): EquipmentStatusMap {
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

export function activeParkingSigns(tree: TreeListItem) {
  return Math.max(0, Number(parseEquipmentStatus(tree.siteEquipmentStatus).SIGN?.quantity ?? 0) || 0);
}

export function equipmentQuantity(tree: TreeListItem, category: EquipmentCategory) {
  return Math.max(0, Number(parseEquipmentStatus(tree.siteEquipmentStatus)[category]?.quantity ?? 0) || 0);
}

export function equipmentRequested(tree: TreeListItem, category: EquipmentCategory) {
  const row = parseEquipmentStatus(tree.siteEquipmentStatus)[category];
  return Boolean(row?.requested) && (row?.quantity ?? 0) <= 0;
}

export function treeIdListLabel(treeId: string) {
  const trimmed = String(treeId ?? "").trim();
  if (!trimmed.includes(":")) return trimmed;
  const visible = trimmed.split(":").at(-1)?.trim();
  return visible || trimmed;
}

export function normalizeTreeScanText(value: string) {
  return value.trim();
}

export function normalizeExtraTreeIdForUi(value: string) {
  return value.trim().replace(/\s+/g, "-").slice(0, 80);
}

export function nextExtraTreeId(items: TreeListItem[]) {
  const numericIds = items
    .map((item) => Number(treeIdListLabel(item.treeId)))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = numericIds.length > 0 ? Math.max(...numericIds) + 1 : items.length + 1;
  return String(next);
}

export function compareKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function scanIdentity(value: unknown) {
  return compareKey(value);
}

export function readScanPayload(raw: string) {
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

export function findTreeByScan(items: TreeListItem[], raw: string) {
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
