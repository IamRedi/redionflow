"use client";

import type { ActionResult } from "@/lib/validation/action-result";
import {
  addManualTaskAction,
  checkTreeItemAction,
  clearManualTaskAction,
  startWorkingAction,
  stopWorkingAction,
} from "@/app/(workzone)/workzone/actions";
import {
  collectSafetyEquipmentAction,
  deploySafetyEquipmentAction,
  requestSafetyEquipmentAction,
  setSafetyEquipmentQuantityAction,
} from "@/app/(workzone)/workzone/safety-actions";
import { saveReportNoteAction } from "@/app/(workzone)/workzone/hr-actions";
import { uploadBaustelleDocumentAction } from "@/app/(workzone)/workzone/actions";
import { enqueueAction } from "./outbox";
import { dbPutUploadBlob } from "./idb";
import type { UploadDocumentPayload } from "./types";

export type StartWorkInput = {
  baustelleId: string;
  workerId: string;
  companyProfileId: string;
  startTime?: string;
};

export type StopWorkInput = {
  baustelleId: string;
  workerId: string;
  companyProfileId: string;
  endTime?: string;
  breakMinutes?: number;
};

/**
 * Offline-aware wrapper for startWorkingAction.
 * Online  → delegates directly to the Server Action.
 * Offline → queues to IndexedDB outbox and returns an optimistic response.
 *           The UI must treat this as "pending", not as a confirmed session start.
 */
export async function startWorkOffline(input: StartWorkInput): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "START_WORK",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "WORK_SESSION",
      entityId: `${input.workerId}:${input.baustelleId}`,
      payload: {
        baustelleId: input.baustelleId,
        workerId: input.workerId,
        startTime: input.startTime ?? new Date().toISOString(),
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }

  return startWorkingAction({
    baustelleId: input.baustelleId,
    workerId: input.workerId,
    startTime: input.startTime,
  });
}

/**
 * Offline-aware wrapper for stopWorkingAction.
 * Online  → delegates directly to the Server Action.
 * Offline → queues to IndexedDB outbox and returns an optimistic response.
 */
export async function stopWorkOffline(input: StopWorkInput): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "STOP_WORK",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "WORK_SESSION",
      entityId: `${input.workerId}:${input.baustelleId}`,
      payload: {
        baustelleId: input.baustelleId,
        workerId: input.workerId,
        endTime: input.endTime ?? new Date().toISOString(),
        breakMinutes: input.breakMinutes ?? 30,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }

  return stopWorkingAction({
    baustelleId: input.baustelleId,
    workerId: input.workerId,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
  });
}

// ---------------------------------------------------------------------------
// Tree actions
// ---------------------------------------------------------------------------

export type CheckTreeInput = {
  treeItemId: string;
  workerId: string;
  companyProfileId: string;
  baustelleId: string;
  done: boolean;
  /** updatedAt of the tree at the time the action was created — used for conflict detection */
  baseUpdatedAt?: string;
};

/**
 * Offline-aware wrapper for checkTreeItemAction (both CHECK_TREE and UNDO_TREE).
 * The `done` flag determines which action type is recorded in the outbox.
 */
export async function checkTreeOffline(
  input: CheckTreeInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: input.done ? "CHECK_TREE" : "UNDO_TREE",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "TREE",
      entityId: input.treeItemId,
      baseUpdatedAt: input.baseUpdatedAt,
      payload: {
        treeItemId: input.treeItemId,
        workerId: input.workerId,
        baustelleId: input.baustelleId,
        done: input.done,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }

  return checkTreeItemAction({
    treeItemId: input.treeItemId,
    workerId: input.workerId,
    done: input.done,
  });
}

// ---------------------------------------------------------------------------
// Manual task actions
// ---------------------------------------------------------------------------

export type AddManualTaskInput = {
  baustelleId: string;
  workerId: string;
  companyProfileId: string;
  description: string;
};

/**
 * Offline-aware wrapper for addManualTaskAction.
 * Additive by nature — low conflict risk.
 */
export async function addManualTaskOffline(
  input: AddManualTaskInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "ADD_MANUAL_TASK",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "BAUSTELLE",
      entityId: input.baustelleId,
      payload: {
        baustelleId: input.baustelleId,
        workerId: input.workerId,
        description: input.description,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }

  return addManualTaskAction({
    baustelleId: input.baustelleId,
    workerId: input.workerId,
    description: input.description,
  });
}

export type ClearManualTaskInput = {
  taskId: string;
  workerId: string;
  companyProfileId: string;
  baustelleId: string;
};

/**
 * Offline-aware wrapper for clearManualTaskAction.
 * If the task was already cleared by someone else the server returns noop.
 */
export async function clearManualTaskOffline(
  input: ClearManualTaskInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "CLEAR_MANUAL_TASK",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "MANUAL_TASK",
      entityId: input.taskId,
      payload: {
        taskId: input.taskId,
        workerId: input.workerId,
        baustelleId: input.baustelleId,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }

  return clearManualTaskAction({
    taskId: input.taskId,
    workerId: input.workerId,
  });
}

// ---------------------------------------------------------------------------
// Safety equipment actions
// ---------------------------------------------------------------------------

type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";

export type RequestSafetyEquipmentInput = {
  baustelleId: string;
  category: EquipmentCategory;
  workerId: string;
  companyProfileId: string;
  treeItemId?: string;
};

export async function requestSafetyEquipmentOffline(
  input: RequestSafetyEquipmentInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "SITE_EQUIPMENT_MOVEMENT",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "INVENTORY",
      entityId: `${input.baustelleId}:${input.treeItemId ?? "baustelle"}:${input.category}`,
      payload: {
        movementType: "REQUEST",
        baustelleId: input.baustelleId,
        category: input.category,
        workerId: input.workerId,
        treeItemId: input.treeItemId,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }
  return requestSafetyEquipmentAction({
    baustelleId: input.baustelleId,
    category: input.category,
    treeItemId: input.treeItemId,
  });
}

export type DeploySafetyEquipmentInput = {
  baustelleId: string;
  category: EquipmentCategory;
  quantity: number;
  note?: string;
  workerId: string;
  companyProfileId: string;
  treeItemId?: string;
};

export async function deploySafetyEquipmentOffline(
  input: DeploySafetyEquipmentInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "SITE_EQUIPMENT_MOVEMENT",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "INVENTORY",
      entityId: `${input.baustelleId}:${input.treeItemId ?? "baustelle"}:${input.category}`,
      payload: {
        movementType: "DEPLOY",
        baustelleId: input.baustelleId,
        category: input.category,
        quantity: input.quantity,
        note: input.note,
        workerId: input.workerId,
        treeItemId: input.treeItemId,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }
  return deploySafetyEquipmentAction({
    baustelleId: input.baustelleId,
    category: input.category,
    quantity: input.quantity,
    note: input.note,
    treeItemId: input.treeItemId,
  });
}

export type CollectSafetyEquipmentInput = {
  baustelleId: string;
  category: EquipmentCategory;
  quantity: number;
  note?: string;
  workerId: string;
  companyProfileId: string;
  treeItemId?: string;
};

export async function collectSafetyEquipmentOffline(
  input: CollectSafetyEquipmentInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "SITE_EQUIPMENT_MOVEMENT",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "INVENTORY",
      entityId: `${input.baustelleId}:${input.treeItemId ?? "baustelle"}:${input.category}`,
      payload: {
        movementType: "COLLECT",
        baustelleId: input.baustelleId,
        category: input.category,
        quantity: input.quantity,
        note: input.note,
        workerId: input.workerId,
        treeItemId: input.treeItemId,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }
  return collectSafetyEquipmentAction({
    baustelleId: input.baustelleId,
    category: input.category,
    quantity: input.quantity,
    note: input.note,
    treeItemId: input.treeItemId,
  });
}

export type SetSafetyEquipmentQuantityInput = {
  baustelleId: string;
  category: EquipmentCategory;
  targetQuantity: number;
  note?: string;
  workerId: string;
  companyProfileId: string;
  treeItemId?: string;
};

export async function setSafetyEquipmentQuantityOffline(
  input: SetSafetyEquipmentQuantityInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "SITE_EQUIPMENT_MOVEMENT",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "INVENTORY",
      entityId: `${input.baustelleId}:${input.treeItemId ?? "baustelle"}:${input.category}`,
      payload: {
        movementType: "SET_QUANTITY",
        baustelleId: input.baustelleId,
        category: input.category,
        targetQuantity: input.targetQuantity,
        note: input.note,
        workerId: input.workerId,
        treeItemId: input.treeItemId,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }
  return setSafetyEquipmentQuantityAction({
    baustelleId: input.baustelleId,
    category: input.category,
    targetQuantity: input.targetQuantity,
    note: input.note,
    treeItemId: input.treeItemId,
  });
}

// ---------------------------------------------------------------------------
// Report note action
// ---------------------------------------------------------------------------

export type SaveReportNoteInput = {
  workerId: string;
  companyProfileId: string;
  type: "DAILY" | "MONTHLY";
  periodKey: string;
  note: string;
};

export async function saveReportNoteOffline(
  input: SaveReportNoteInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueAction({
      type: "ADD_REPORT_NOTE",
      actorKind: "WORKER",
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "WORKER",
      entityId: input.workerId,
      payload: {
        workerId: input.workerId,
        type: input.type,
        periodKey: input.periodKey,
        note: input.note,
      },
    });
    return { ok: true, queued: true, message: "offline_queued" };
  }
  return saveReportNoteAction({ workerId: input.workerId, type: input.type, periodKey: input.periodKey, note: input.note });
}

// ---------------------------------------------------------------------------
// Document upload actions (Phase 5)
// ---------------------------------------------------------------------------

export type UploadBaustelleDocumentInput = {
  baustelleId: string;
  workerId: string;
  actorKind: "WORKER" | "ADMIN";
  companyProfileId: string;
  file: File;
};

/**
 * Offline-aware wrapper for uploadBaustelleDocumentAction.
 * Online  → delegates directly to the Server Action.
 * Offline → stores the file blob in IndexedDB and enqueues an UPLOAD_DOCUMENT
 *           action referencing the blob by id. The sync runner will push it
 *           via the multipart endpoint once connectivity is restored.
 */
export async function uploadBaustelleDocumentOffline(
  input: UploadBaustelleDocumentInput,
): Promise<ActionResult & { queued?: true }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const payload: UploadDocumentPayload = {
      scope: "baustelle-documents",
      entityId: input.baustelleId,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      kind: "baustelle-document",
    };

    const action = await enqueueAction({
      type: "UPLOAD_DOCUMENT",
      actorKind: input.actorKind,
      actorId: input.workerId,
      companyProfileId: input.companyProfileId,
      entityType: "BAUSTELLE",
      entityId: input.baustelleId,
      payload,
    });

    await dbPutUploadBlob({
      id: action.id,
      actionId: action.id,
      blob: input.file,
      fileName: input.file.name,
      contentType: payload.contentType,
      sizeBytes: input.file.size,
      createdAt: new Date().toISOString(),
    });

    return { ok: true, queued: true, message: "offline_queued" };
  }

  const formData = new FormData();
  formData.set("baustelleId", input.baustelleId);
  formData.set("file", input.file);
  return uploadBaustelleDocumentAction(formData);
}
