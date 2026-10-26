export type WorkzoneActionType =
  | "START_WORK"
  | "STOP_WORK"
  | "CHECK_TREE"
  | "UNDO_TREE"
  | "ADD_MANUAL_TASK"
  | "CLEAR_MANUAL_TASK"
  | "ADD_REPORT_NOTE"
  | "SITE_EQUIPMENT_MOVEMENT"
  | "UPLOAD_DOCUMENT";

export type WorkzoneEntityType =
  | "WORKER"
  | "BAUSTELLE"
  | "TREE"
  | "MANUAL_TASK"
  | "WORK_SESSION"
  | "INVENTORY";

export type WorkzoneActorKind = "WORKER" | "ADMIN";

export type PendingActionStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export type SyncOutcome =
  | "synced"
  | "noop"
  | "conflict"
  | "rejected"
  | "retryable_error";

export interface WorkzonePendingAction {
  /** Client-generated UUID. Used as idempotency key on the server. */
  id: string;
  type: WorkzoneActionType;
  actorKind: WorkzoneActorKind;
  actorId: string;
  companyProfileId: string;
  entityType: WorkzoneEntityType;
  entityId: string;
  payload: unknown;
  /**
   * The `updatedAt` timestamp of the entity at the time the action was
   * created. The server uses this to detect concurrent modifications.
   */
  baseUpdatedAt?: string;
  /** ISO timestamp assigned by the server clock when the record was last known. */
  baseVersion?: string;
  /** ISO timestamp — when the action was created on the server (set after first sync). */
  createdAt: string;
  /** ISO timestamp — when the action was captured on the client device. */
  clientCreatedAt: string;
  status: PendingActionStatus;
  attempts: number;
  lastError?: string;
}

export interface SyncActionResult {
  id: string;
  outcome: SyncOutcome;
  message?: string;
}

export interface SyncResponse {
  results: SyncActionResult[];
}

export interface EntityCacheEntry {
  /** Composite key: `${entityType}:${entityId}` */
  cacheKey: string;
  entityType: WorkzoneEntityType;
  entityId: string;
  snapshot: unknown;
  cachedAt: string;
}

export interface SyncLogEntry {
  id: string;
  occurredAt: string;
  actionCount: number;
  successCount: number;
  failureCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// UPLOAD_DOCUMENT (Phase 5)
// ---------------------------------------------------------------------------

export type UploadScope = "baustelle-documents" | "worker-assets";

export type UploadDocumentKind = "baustelle-document" | "worker-document" | "worker-photo";

export interface UploadDocumentPayload {
  scope: UploadScope;
  entityId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: UploadDocumentKind;
  /** Optional label persisted on the server side for worker documents. */
  label?: string;
}

export interface UploadBlobEntry {
  /** Same value as the referencing WorkzonePendingAction.id */
  id: string;
  actionId: string;
  blob: Blob;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
