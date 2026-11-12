export type AssetRef = { kind: 'machine' | 'inventory'; id: string };
export type AssetCategory = 'vehicle' | 'tool' | 'clothing' | 'equipment';
export type AssetAvailability = 'available' | 'issued' | 'handover' | 'reported' | 'workshop' | 'loss_pending' | 'retirement_pending' | 'lost' | 'retired' | 'inactive';
export type RepairPhase = 'reported' | 'received' | 'repairing' | 'ready' | 'cancelled';
export type RepairLocation = 'internal' | 'external';
export type ActiveRepairPhase = Exclude<RepairPhase, 'ready' | 'cancelled'>;
export type AssetOperationalStatus = {
  availability: AssetAvailability | null; activeRepairPhase: ActiveRepairPhase | null; activeRepairLocation: RepairLocation | null;
  usable: boolean | null; known: boolean; readAt: string;
};
export type AssetPerson = { id: string; name: string };
export type AssetPermissions = { canRegister: boolean; canManage: boolean; canRepair: boolean; workerId: string | null };
export type AssetSummary = AssetRef & {
  key: string; name: string; category: AssetCategory; code: string | null; plate: string | null; size: string | null;
  photoUrl: string | null; availability: AssetAvailability; revision: number;
  holder: AssetPerson | null; site: AssetPerson | null; activeRepairId: string | null;
  activeRepairPhase: ActiveRepairPhase | null; activeRepairLocation: RepairLocation | null;
};
export type AssetHandoverView = {
  id: string; asset: AssetRef; name: string; kind: 'issue' | 'return' | 'transfer';
  status: 'pending' | 'completed' | 'declined' | 'cancelled'; revision: number;
  from: AssetPerson | null; to: AssetPerson | null; site: AssetPerson | null;
  confirmations: { name: string; confirmed: boolean }[]; canConfirm: boolean; canCancel: boolean;
  createdAt: string; note: string;
};
export type AssetIncidentView = {
  id: string; asset: AssetRef; name: string; kind: 'defect' | 'lost' | 'retire';
  status: 'pending' | 'confirmed' | 'rejected'; revision: number; note: string; reportedBy: string; createdAt: string;
};
export type AssetRepairView = {
  id: string; asset: AssetRef; name: string; code: string | null; plate: string | null; photoUrl: string | null;
  category: AssetCategory;
  phase: RepairPhase; location: RepairLocation; provider: string; problem: string; repairNote: string; tested: boolean;
  revision: number; reportedBy: string; createdAt: string; updatedAt: string;
};
export type AssetFileView = { id: string; name: string; kind: 'photo' | 'invoice' | 'document' | 'cover'; mime: string; bytes: number; url: string; uploadedBy: string; uploadedAt: string; repairId: string | null };
export type AssetHistoryView = { id: string; type: string; actor: string; at: string; note: string; repairId: string | null };
export type AssetCodeView = { id: string; kind: 'factory' | 'label'; value: string };
export type AssetDetail = { asset: AssetSummary; codes: AssetCodeView[]; repairs: AssetRepairView[]; incidents: AssetIncidentView[]; handovers: AssetHandoverView[]; history: AssetHistoryView[]; files: AssetFileView[]; permissions: AssetPermissions };
export type ClothingGroupFilter = { name: string; size: string | null };
export type ClothingGroup = ClothingGroupFilter & { key: string; total: number; reserve: number; assigned: number; other: number };
export type ClothingHandoverBatchView = ClothingGroupFilter & { id: string; total: number; items: AssetHandoverView[]; createdAt: string };
export type AssetSnapshot = {
  assets: AssetSummary[]; total: number; page: number; hasMore: boolean;
  counts: { total: number; available: number; issued: number; workshop: number; pending: number; lost: number; retired: number };
  workers: AssetPerson[]; sites: AssetPerson[]; handovers: AssetHandoverView[]; incidents: AssetIncidentView[]; repairs: AssetRepairView[];
  permissions: AssetPermissions; serverNow: string;
  queueHasMore?: { handovers: boolean; incidents: boolean; repairs: boolean };
  clothingGroups?: { groups: ClothingGroup[]; total: number };
  handoverBatches?: ClothingHandoverBatchView[];
};
export type AssetQuery = { query?: string; scan?: string; page?: number; category?: AssetCategory; includeInactive?: boolean; workerId?: string; groupClothing?: boolean; groupHandovers?: boolean; clothingGroup?: ClothingGroupFilter };
export type AssetCommand =
  | { type: 'report'; asset: AssetRef; kind: 'defect' | 'lost' | 'retire'; note: string }
  | { type: 'decide-incident'; incidentId: string; revision: number; approve: boolean; note: string }
  | { type: 'handover'; asset: AssetRef; kind: 'issue' | 'return' | 'transfer'; toWorkerId?: string; siteId?: string; note?: string }
  | { type: 'issue-clothing-group'; group: ClothingGroupFilter; toWorkerId: string; quantity: number; note?: string }
  | { type: 'confirm-clothing-batch'; batchId: string; members: { id: string; revision: number }[]; note?: string }
  | { type: 'confirm-handover' | 'decline-handover' | 'cancel-handover'; handoverId: string; revision: number; note?: string }
  | { type: 'repair-phase'; repairId: string; revision: number; phase: 'received' | 'repairing' | 'ready'; repairNote?: string; tested?: boolean }
  | { type: 'repair-location'; repairId: string; revision: number; location: RepairLocation; provider?: string; note: string }
  | { type: 'repair-note'; repairId: string; revision: number; note: string }
  | { type: 'restore'; asset: AssetRef; revision: number; note: string }
  | { type: 'make-available'; asset: AssetRef; revision: number; note?: string }
  | { type: 'register'; name: string; category: Exclude<AssetCategory, 'vehicle'>; code?: string; barcode?: string; factoryCode?: string; size?: string; note?: string; quantity?: number }
  | { type: 'code-add'; asset: AssetRef; value: string }
  | { type: 'code-generate'; asset: AssetRef }
  | { type: 'code-remove'; asset: AssetRef; codeId: string }
  | { type: 'edit'; asset: AssetRef; revision: number; name: string; size?: string; note?: string };
export type AssetMutation = { requestId: string; command: AssetCommand };
export type AssetResult<T> = { ok: true; data: T; message?: string } | { ok: false; message: string; code?: string };
