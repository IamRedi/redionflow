import {
  dbDeleteOutbox,
  dbGetAllOutbox,
  dbGetOutbox,
  dbGetOutboxByStatus,
  dbPutOutbox,
  dbPutSyncLog,
} from "./idb";
import type { SyncActionResult, SyncLogEntry, WorkzonePendingAction } from "./types";

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

type EnqueueInput = Omit<
  WorkzonePendingAction,
  "id" | "createdAt" | "clientCreatedAt" | "status" | "attempts" | "lastError"
>;

export async function enqueueAction(input: EnqueueInput): Promise<WorkzonePendingAction> {
  const now = new Date().toISOString();
  const action: WorkzonePendingAction = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    clientCreatedAt: now,
    status: "pending",
    attempts: 0,
  };
  await dbPutOutbox(action);
  return action;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getPendingActions(): Promise<WorkzonePendingAction[]> {
  const all = await dbGetOutboxByStatus("pending");
  return all.sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
}

export async function getAllOutboxActions(): Promise<WorkzonePendingAction[]> {
  const all = await dbGetAllOutbox();
  return all.sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
}

export async function getPendingCount(): Promise<number> {
  const pending = await dbGetOutboxByStatus("pending");
  const syncing = await dbGetOutboxByStatus("syncing");
  return pending.length + syncing.length;
}

export async function getUnresolvedCount(): Promise<number> {
  const [pending, syncing, failed, conflict] = await Promise.all([
    dbGetOutboxByStatus("pending"),
    dbGetOutboxByStatus("syncing"),
    dbGetOutboxByStatus("failed"),
    dbGetOutboxByStatus("conflict"),
  ]);
  return pending.length + syncing.length + failed.length + conflict.length;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

async function patchAction(
  id: string,
  patch: Partial<WorkzonePendingAction>,
): Promise<void> {
  const existing = await dbGetOutbox(id);
  if (!existing) return;
  await dbPutOutbox({ ...existing, ...patch });
}

export async function markActionSyncing(id: string): Promise<void> {
  await patchAction(id, { status: "syncing" });
}

export async function markActionSynced(id: string): Promise<void> {
  await patchAction(id, { status: "synced" });
}

export async function markActionFailed(id: string, error: string): Promise<void> {
  const existing = await dbGetOutbox(id);
  if (!existing) return;
  await dbPutOutbox({
    ...existing,
    status: "failed",
    attempts: existing.attempts + 1,
    lastError: error,
  });
}

export async function markActionConflict(id: string, message?: string): Promise<void> {
  const existing = await dbGetOutbox(id);
  if (!existing) return;
  await dbPutOutbox({
    ...existing,
    status: "conflict",
    attempts: existing.attempts + 1,
    lastError: message,
  });
}

export async function retryAction(id: string): Promise<void> {
  await patchAction(id, { status: "pending", lastError: undefined });
}

export async function deleteAction(id: string): Promise<void> {
  await dbDeleteOutbox(id);
}

// ---------------------------------------------------------------------------
// Apply server results to outbox
// ---------------------------------------------------------------------------

export async function applyServerResults(results: SyncActionResult[]): Promise<void> {
  await Promise.all(
    results.map(async (result) => {
      switch (result.outcome) {
        case "synced":
        case "noop":
          await markActionSynced(result.id);
          break;
        case "conflict":
          await markActionConflict(result.id, result.message);
          break;
        case "rejected":
          await markActionFailed(result.id, result.message ?? "Rejected by server.");
          break;
        case "retryable_error":
          await markActionFailed(result.id, result.message ?? "Server error. Will retry.");
          break;
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

export async function writeSyncLog(
  entry: Omit<SyncLogEntry, "id" | "occurredAt">,
): Promise<void> {
  const log: SyncLogEntry = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    ...entry,
  };
  await dbPutSyncLog(log);
}
