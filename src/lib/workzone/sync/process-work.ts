

import { prisma } from "@/lib/db/prisma";

import type { SyncActionResult, WorkzoneActorKind } from "@/lib/workzone/offline/types";
import type { SyncMessages } from "./messages";
import { recordOutcome } from "./outcome";
import {
  startWorkPayloadSchema,
  stopWorkPayloadSchema,
  checkTreePayloadSchema,
  addManualTaskPayloadSchema,
  clearManualTaskPayloadSchema,
  addReportNotePayloadSchema,
  type AuthContext,
  type PendingAction,
} from "./schemas";

export async function processStartWork(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = startWorkPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("START_WORK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { baustelleId, workerId } = payload.data;
  const startTime = payload.data.startTime ? new Date(payload.data.startTime) : new Date();

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const [worker, baustelle] = await Promise.all([
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, status: true, availability: true, companyProfileId: true } }),
    prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true, isActive: true } }),
  ]);

  if (!worker || worker.status !== "active") {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotActive);
    return { id: action.id, outcome: "rejected", message: m.workerNotActive };
  }

  if (worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  if (!baustelle || !baustelle.isActive) {
    const msg = !baustelle ? m.siteNotFound : m.siteNoLongerActive;
    await recordOutcome(action.id, auth, action, "conflict", msg);
    return { id: action.id, outcome: "conflict", message: msg };
  }

  const existing = await prisma.workSession.findFirst({
    where: { workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (existing) {
    if (existing.baustelleId === baustelleId) {
      await recordOutcome(action.id, auth, action, "noop", m.sessionAlreadyActiveOnSite);
      return { id: action.id, outcome: "noop", message: m.sessionAlreadyActiveOnSite };
    }
    await prisma.workSession.update({
      where: { id: existing.id },
      data: { baustelleId, startTime: existing.startTime, endTime: null, isLive: true, closedBySystem: false, systemNote: null },
    });
  } else {
    await prisma.workSession.create({
      data: { workerId, baustelleId, startTime, endTime: null, breakMinutes: 30, isLive: true },
    });
  }

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

export async function processStopWork(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = stopWorkPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("STOP_WORK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { baustelleId, workerId } = payload.data;
  const endTime = payload.data.endTime ? new Date(payload.data.endTime) : new Date();
  const breakMinutes = payload.data.breakMinutes ?? 30;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, companyProfileId: true },
  });

  if (!worker || worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotFoundOrCompanyMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerNotFoundOrCompanyMismatch };
  }

  const existing = await prisma.workSession.findFirst({
    where: { baustelleId, workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (!existing) {
    // Session was already closed (e.g. auto-closed by the system) — treat as noop
    await recordOutcome(action.id, auth, action, "noop", m.sessionAlreadyClosed);
    return { id: action.id, outcome: "noop", message: m.sessionAlreadyClosed };
  }

  if (endTime <= existing.startTime) {
    const msg = m.endBeforeStart;
    await recordOutcome(action.id, auth, action, "conflict", msg);
    return { id: action.id, outcome: "conflict", message: msg };
  }

  await prisma.workSession.update({
    where: { id: existing.id },
    data: { baustelleId: null },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

export async function processCheckTree(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = checkTreePayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("CHECK_TREE");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { treeItemId, workerId, done } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const tree = await prisma.treeItem.findUnique({
    where: { id: treeItemId },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      baustelle: { select: { id: true, companyProfileId: true, isActive: true } },
    },
  });

  if (!tree) {
    await recordOutcome(action.id, auth, action, "conflict", m.treeNotFoundDeleted);
    return { id: action.id, outcome: "conflict", message: m.treeNotFoundDeleted };
  }

  if (tree.baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  if (!tree.baustelle.isActive) {
    await recordOutcome(action.id, auth, action, "conflict", m.siteNoLongerActive);
    return { id: action.id, outcome: "conflict", message: m.siteNoLongerActive };
  }

  // Idempotent: desired state already matches server state
  if ((done && tree.status === "done") || (!done && tree.status === "todo")) {
    await recordOutcome(action.id, auth, action, "noop", m.treeStatusAlreadyMatches);
    return { id: action.id, outcome: "noop", message: m.treeStatusAlreadyMatches };
  }

  await prisma.treeItem.update({
    where: { id: treeItemId },
    data: done
      ? { status: "done", completedAt: new Date(), completedBy: null, completedByWorkerId: workerId }
      : { status: "todo", completedAt: null, completedBy: null, completedByWorkerId: null },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

export async function processAddManualTask(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = addManualTaskPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("ADD_MANUAL_TASK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { baustelleId, workerId, description } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, isActive: true },
  });

  if (!baustelle) {
    await recordOutcome(action.id, auth, action, "conflict", m.siteNotFound);
    return { id: action.id, outcome: "conflict", message: m.siteNotFound };
  }

  if (baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  const systemUser = await prisma.user.findFirst({
    where: { companyProfileId: auth.companyProfileId },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true },
  });
  if (!systemUser) {
    return { id: action.id, outcome: "retryable_error", message: m.noOfficeUser };
  }

  await prisma.manualTask.create({
    data: {
      baustelleId,
      userId: systemUser.id,
      workerId,
      description: description.trim(),
      isFlagged: true,
    },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

export async function processClearManualTask(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = clearManualTaskPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("CLEAR_MANUAL_TASK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { taskId, workerId } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const task = await prisma.manualTask.findUnique({
    where: { id: taskId },
    select: { id: true, isFlagged: true, baustelle: { select: { companyProfileId: true } } },
  });

  if (!task) {
    // Task was deleted — treat as noop, the end state is the same
    await recordOutcome(action.id, auth, action, "noop", m.taskNotFoundRemoved);
    return { id: action.id, outcome: "noop", message: m.taskNotFoundRemoved };
  }

  if (task.baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  if (!task.isFlagged) {
    // Already cleared — idempotent noop
    await recordOutcome(action.id, auth, action, "noop", m.taskAlreadyCleared);
    return { id: action.id, outcome: "noop", message: m.taskAlreadyCleared };
  }

  await prisma.manualTask.update({
    where: { id: taskId },
    data: {
      isFlagged: false,
      resolvedAt: new Date(),
      resolvedByWorkerId: workerId,
      resolvedByUserId: null,
    },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

export async function processAddReportNote(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = addReportNotePayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("ADD_REPORT_NOTE");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { workerId, type, periodKey, note } = payload.data;
  const text = note.trim();

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, lastName: true, companyProfileId: true },
  });

  if (!worker || worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotFoundOrCompanyMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerNotFoundOrCompanyMismatch };
  }

  const existing = await prisma.workReportNote.findUnique({
    where: { workerId_type_periodKey: { workerId, type, periodKey } },
  });

  function parseMessages(raw: string | null | undefined): unknown[] {
    if (!raw) return [];
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : Array.isArray((p as Record<string, unknown>)?.messages) ? (p as Record<string, unknown[]>).messages : [];
    } catch {
      return raw.trim() ? [{ id: "legacy", authorName: m.legacyNoteAuthor, authorRole: "System", text: raw, createdAt: "" }] : [];
    }
  }

  const messages = [
    ...parseMessages(existing?.note),
    {
      id: crypto.randomUUID(),
      authorName: `${worker.firstName} ${worker.lastName}`.trim(),
      authorRole: "Worker",
      text,
      createdAt: action.clientCreatedAt,
    },
  ];

  await prisma.workReportNote.upsert({
    where: { workerId_type_periodKey: { workerId, type, periodKey } },
    create: { workerId, type, periodKey, note: JSON.stringify(messages) },
    update: { note: JSON.stringify(messages) },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}
