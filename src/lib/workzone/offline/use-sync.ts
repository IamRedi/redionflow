"use client";

import { useCallback, useEffect, useRef } from "react";

import { applyServerResults, getPendingActions, markActionFailed, markActionSyncing, writeSyncLog } from "./outbox";
import { dbDeleteUploadBlob, dbGetUploadBlob } from "./idb";
import { useOnlineStatus } from "./use-online-status";
import type { SyncActionResult, SyncResponse, WorkzonePendingAction } from "./types";

const SYNC_DEBOUNCE_MS = 1_500;
const MAX_BATCH_SIZE = 20;

async function flushUploads(): Promise<void> {
  const pending = await getPendingActions();
  const uploads = pending.filter((a) => a.type === "UPLOAD_DOCUMENT");
  if (uploads.length === 0) return;

  for (const action of uploads) {
    const blob = await dbGetUploadBlob(action.id);
    if (!blob) {
      // Blob is missing — cannot recover. Mark failed so the UI can surface it.
      await markActionFailed(action.id, "Local file blob missing. Cannot upload.");
      continue;
    }

    await markActionSyncing(action.id);

    const form = new FormData();
    const meta: Pick<WorkzonePendingAction, "id" | "actorKind" | "actorId" | "companyProfileId" | "entityType" | "entityId" | "payload" | "clientCreatedAt"> = {
      id: action.id,
      actorKind: action.actorKind,
      actorId: action.actorId,
      companyProfileId: action.companyProfileId,
      entityType: action.entityType,
      entityId: action.entityId,
      payload: action.payload,
      clientCreatedAt: action.clientCreatedAt,
    };
    form.set("meta", JSON.stringify(meta));
    form.set("file", new File([blob.blob], blob.fileName, { type: blob.contentType }));

    let response: Response;
    try {
      response = await fetch("/api/workzone/sync/upload", { method: "POST", body: form });
    } catch (networkError) {
      const msg = networkError instanceof Error ? networkError.message : "Network error.";
      await markActionFailed(action.id, msg);
      continue;
    }

    if (!response.ok) {
      await markActionFailed(action.id, `Server responded ${response.status}.`);
      continue;
    }

    let data: { result: SyncActionResult };
    try {
      data = (await response.json()) as { result: SyncActionResult };
    } catch {
      await markActionFailed(action.id, "Invalid JSON response from upload endpoint.");
      continue;
    }

    await applyServerResults([data.result]);

    // Clean up local blob for terminal outcomes so we do not retry the upload.
    if (data.result.outcome === "synced" || data.result.outcome === "noop" || data.result.outcome === "rejected") {
      await dbDeleteUploadBlob(action.id);
    }
  }
}

async function flushOutbox(): Promise<void> {
  // Uploads take a separate multipart endpoint. Handle them first so downstream
  // JSON actions do not queue behind large binaries.
  await flushUploads();

  const pending = (await getPendingActions()).filter((a) => a.type !== "UPLOAD_DOCUMENT");
  if (pending.length === 0) return;

  const batch = pending.slice(0, MAX_BATCH_SIZE);
  await Promise.all(batch.map((action) => markActionSyncing(action.id)));

  let response: Response;
  try {
    response = await fetch("/api/workzone/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: batch }),
    });
  } catch (networkError) {
    const msg = networkError instanceof Error ? networkError.message : "Network error.";
    await Promise.all(batch.map((action) => markActionFailed(action.id, msg)));
    await writeSyncLog({ actionCount: batch.length, successCount: 0, failureCount: batch.length, error: msg });
    return;
  }

  if (!response.ok) {
    const msg = `Server responded ${response.status}.`;
    await Promise.all(batch.map((action) => markActionFailed(action.id, msg)));
    await writeSyncLog({ actionCount: batch.length, successCount: 0, failureCount: batch.length, error: msg });
    return;
  }

  let data: SyncResponse;
  try {
    data = (await response.json()) as SyncResponse;
  } catch {
    const msg = "Invalid JSON response from sync endpoint.";
    await Promise.all(batch.map((action) => markActionFailed(action.id, msg)));
    await writeSyncLog({ actionCount: batch.length, successCount: 0, failureCount: batch.length, error: msg });
    return;
  }

  await applyServerResults(data.results);

  const successCount = data.results.filter((r) => r.outcome === "synced" || r.outcome === "noop").length;
  const failureCount = data.results.length - successCount;
  await writeSyncLog({ actionCount: batch.length, successCount, failureCount });

  // If there are more pending actions, continue flushing
  const remaining = await getPendingActions();
  if (remaining.length > 0) await flushOutbox();
}

/**
 * Mounts a sync runner in the workzone. When the device comes back online,
 * all queued outbox actions are flushed to the server in batches.
 *
 * Returns a `triggerSync` function for manual re-tries.
 */
export function useWorkzoneSync(): { triggerSync: () => void } {
  const isOnline = useOnlineStatus();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      flushOutbox().finally(() => {
        isSyncingRef.current = false;
      });
    }, SYNC_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (isOnline) scheduleSync();
  }, [isOnline, scheduleSync]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { triggerSync: scheduleSync };
}
