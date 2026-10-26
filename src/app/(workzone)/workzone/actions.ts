"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { checkLimit, overLimitMessage } from "@/lib/billing/limits";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId, isOwnedByCurrentCompany } from "@/lib/db/tenant";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { deleteManagedFileByUrl, uploadManagedFile } from "@/lib/storage/object-storage";
import type { ActionResult } from "@/lib/validation/action-result";
import { dateKey } from "@/lib/workzone/reporting";
import {
  addExternalWorkerSchema,
  workzoneCheckTreeSchema,
  workzoneEditTreeSchema,
  workzoneManualTaskSchema,
  workzoneStartWorkingSchema,
  workzoneStopWorkingSchema,
  workzoneToggleHaltSchema,
} from "@/lib/validation/schemas";

async function getSystemUserId() {
  const companyProfileId = await getCurrentCompanyId();
  if (!companyProfileId) throw new Error("Authenticated tenant required.");
  const user = await prisma.user.findFirst({ where: { companyProfileId }, orderBy: [{ role: "asc" }, { email: "asc" }], select: { id: true } });
  if (!user) throw new Error("No office user found for legacy ManualTask relation.");
  return user.id;
}

function workerName(worker: { firstName: string; lastName: string }) {
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function parseTreeMeta(notes: string | null | undefined) {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function normalizeExtraTreeId(value: string) {
  return value.trim().replace(/\s+/g, "-").slice(0, 80);
}

function normalizeScanIdentity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function uniqueDocuments(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function allowedBaustelleDocument(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  const ext = fromName ?? "";
  const isPdf = file.type === "application/pdf" || ext === "pdf";
  const isWord = ["doc", "docx"].includes(ext) || file.type.includes("word") || file.type.includes("officedocument");
  const isImage = file.type.startsWith("image/");
  return isPdf || isWord || isImage;
}

function isMissingManualTaskResolutionColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("ManualTask.resolvedByUserId") ||
    message.includes("ManualTask.resolvedByWorkerId") ||
    message.includes("ManualTask.resolvedAt")
  );
}

type LegacyManualTaskState = {
  id: string;
  baustelleId: string;
  isFlagged: boolean;
};

export async function checkTreeItemAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = workzoneCheckTreeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const { treeItemId, workerId, done } = parsed.data;
  const [tree, worker, adminUser] = await Promise.all([
    prisma.treeItem.findUnique({ where: { id: treeItemId }, include: { baustelle: true } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: workerId, role: "ADMIN", isActive: true }, select: { id: true } }),
  ]);
  if (!tree) return { ok: false, message: tr("treeNotFound") };
  if (!isOwnedByCurrentCompany(tree.baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!worker && !adminUser) return { ok: false, message: tr("actorNotFound") };
  if (worker && !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if ((done && tree.status === "done") || (!done && tree.status === "todo")) {
    return { ok: true, message: tr("treeStatusAlreadyCurrent") };
  }

  await prisma.treeItem.update({
    where: { id: treeItemId },
    data: done
      ? worker
        ? { status: "done", completedAt: new Date(), completedBy: null, completedByWorkerId: workerId }
        : { status: "done", completedAt: new Date(), completedBy: adminUser!.id, completedByWorkerId: null }
      : { status: "todo", completedAt: null, completedBy: null, completedByWorkerId: null },
  });

  revalidatePath(`/workzone/baustellen/${tree.baustelleId}`);
  notifyRealtimeUpdate("tree.updated", ["tree-list", "baustelle-progress"]);
  return { ok: true, message: "OK" };
}

export async function editTreeItemAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = workzoneEditTreeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: tr("checkInputs"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const {
    treeItemId,
    workerId,
    species,
    diameter,
    note,
    branchCutsOver10,
    branchCutsOver20,
    branchCutsOver30,
    extraWork,
  } = parsed.data;
  const [tree, worker, adminUser] = await Promise.all([
    prisma.treeItem.findUnique({ where: { id: treeItemId }, include: { baustelle: true } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { firstName: true, lastName: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: workerId, role: "ADMIN", isActive: true }, select: { name: true, email: true } }),
  ]);

  if (!tree) return { ok: false, message: tr("treeNotFound") };
  if (!isOwnedByCurrentCompany(tree.baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!worker && !adminUser) return { ok: false, message: tr("actorNotFound") };
  if (worker && !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  const editedBy = worker ? workerName(worker) : (adminUser?.name ?? adminUser?.email ?? "Admin");

  const existingMeta = parseTreeMeta(tree.notes);
  const nextMeta = {
    ...existingMeta,
    note: note?.trim() || null,
    branchCutsOver10: branchCutsOver10 ?? null,
    branchCutsOver20: branchCutsOver20 ?? null,
    branchCutsOver30: branchCutsOver30 ?? null,
    extraWork: extraWork || null,
  };
  if (
    tree.species === species.trim() &&
    tree.diameter === diameter &&
    JSON.stringify(existingMeta) === JSON.stringify(nextMeta)
  ) {
    return { ok: true, message: tr("treeDataAlreadyCurrent") };
  }

  await prisma.treeItem.update({
    where: { id: treeItemId },
    data: {
      species: species.trim(),
      diameter,
      notes: JSON.stringify(nextMeta),
      isEdited: true,
      lastEditedBy: editedBy,
      lastEditedAt: new Date(),
    },
  });

  revalidatePath(`/workzone/baustellen/${tree.baustelleId}`);
  notifyRealtimeUpdate("tree.updated", ["tree-list", "baustelle-progress"]);
  return { ok: true, message: tr("treeUpdated") };
}

export async function createExtraTreeItemAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const baustelleId = String(data.baustelleId ?? "").trim();
  const workerId = String(data.workerId ?? "").trim();
  const species = String(data.species ?? "").trim();
  const diameter = Math.max(0, Math.min(1000, Math.floor(Number(data.diameter ?? 0) || 0)));
  const note = String(data.note ?? "").trim();
  const scanCode = String(data.scanCode ?? "").trim();
  const scanIdentity = normalizeScanIdentity(String(data.scanIdentity ?? scanCode));
  const requestedTreeId = normalizeExtraTreeId(String(data.treeId ?? ""));

  if (!baustelleId || !workerId) return { ok: false, message: tr("checkInputs") };
  if (!species) return { ok: false, message: tr("treeSpeciesRequired") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const [baustelle, worker, adminUser] = await Promise.all([
    prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, firstName: true, lastName: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: workerId, role: "ADMIN", isActive: true }, select: { id: true, name: true, email: true } }),
  ]);
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };
  if (!isOwnedByCurrentCompany(baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!worker && !adminUser) return { ok: false, message: tr("actorNotFound") };
  if (worker && !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (scanIdentity) {
    const trees = await prisma.treeItem.findMany({
      where: { baustelleId },
      select: { id: true, notes: true },
      take: 2000,
    });
    const existingScanTree = trees.find((item) => {
      const meta = parseTreeMeta(item.notes);
      const stored = [meta.scanIdentity, meta.scanCode, meta.nfcCode, meta.qrCode]
        .map((value) => normalizeScanIdentity(String(value ?? "")))
        .filter(Boolean);
      return stored.includes(scanIdentity);
    });
    if (existingScanTree) return { ok: false, message: tr("scanAlreadyBelongsToTree") };
  }

  const actorName = worker ? workerName(worker) : (adminUser?.name ?? adminUser?.email ?? "Admin");
  let treeId = requestedTreeId || `EXTRA-${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}`;
  const existing = await prisma.treeItem.findUnique({ where: { baustelleId_treeId: { baustelleId, treeId } }, select: { id: true } });
  if (existing && requestedTreeId) return { ok: false, message: tr("treeIdAlreadyExists") };
  if (existing) treeId = `EXTRA-${randomUUID().slice(0, 8).toUpperCase()}`;

  await prisma.treeItem.create({
    data: {
      baustelleId,
      treeId,
      species,
      diameter,
      status: "todo",
      isEdited: true,
      lastEditedBy: actorName,
      lastEditedAt: new Date(),
      notes: JSON.stringify({
        note: note || null,
        action: "extra Baum aufgenommen",
        extraTree: true,
        extraTreeSource: worker ? "worker" : "admin",
        addedById: worker?.id ?? adminUser?.id ?? null,
        addedByName: actorName,
        addedAt: new Date().toISOString(),
        scanCode: scanCode || null,
        scanIdentity: scanIdentity || null,
      }),
    },
  });

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("tree.updated", ["tree-list", "baustelle-progress"]);
  return { ok: true, message: tr("extraTreeAdded") };
}

export async function toggleTreeHaltverbotAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = workzoneToggleHaltSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("checkInputs") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const { treeItemId, workerId, active } = parsed.data;
  const [tree, worker, adminUser] = await Promise.all([
    prisma.treeItem.findUnique({ where: { id: treeItemId }, include: { baustelle: true } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: workerId, role: "ADMIN", isActive: true }, select: { id: true } }),
  ]);
  if (!tree) return { ok: false, message: tr("treeNotFound") };
  if (!isOwnedByCurrentCompany(tree.baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!worker && !adminUser) return { ok: false, message: tr("actorNotFound") };
  if (worker && !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };

  const existingMeta = parseTreeMeta(tree.notes);
  const nextMeta = {
    ...existingMeta,
    haltverbot: active,
  };
  if (Boolean(existingMeta.haltverbot) === active) {
    return { ok: true, message: tr("haltAlreadyCurrent") };
  }

  await prisma.treeItem.update({
    where: { id: treeItemId },
    data: { notes: JSON.stringify(nextMeta) },
  });

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${tree.baustelleId}`);
  revalidatePath(`/workzone/profile/day/${dateKey(new Date())}`);
  notifyRealtimeUpdate("tree.updated", ["tree-list", "baustelle-progress"]);
  return { ok: true, message: active ? tr("haltActiveSaved") : tr("haltRemoved") };
}

export async function addManualTaskAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = workzoneManualTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: tr("checkInputs"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const { baustelleId, workerId, description } = parsed.data;
  const [baustelle, worker, adminUser] = await Promise.all([
    prisma.baustelle.findUnique({ where: { id: baustelleId } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: workerId, role: "ADMIN", isActive: true }, select: { id: true } }),
  ]);
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };
  if (!isOwnedByCurrentCompany(baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!worker && !adminUser) return { ok: false, message: tr("actorNotFound") };
  if (worker && !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  const systemUserId = adminUser?.id ?? (await getSystemUserId());

  try {
    await prisma.manualTask.create({
      data: {
        baustelleId,
        userId: systemUserId,
        workerId: worker?.id ?? null,
        description: description.trim(),
        isFlagged: true,
      },
    });
  } catch (error) {
    if (!isMissingManualTaskResolutionColumn(error)) throw error;
    const taskId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ManualTask" ("id", "baustelleId", "description", "userId", "workerId", "createdAt", "isFlagged")
      VALUES (${taskId}, ${baustelleId}, ${description.trim()}, ${systemUserId}, ${worker?.id ?? null}, NOW(), true)
    `;
  }

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("taskAdded") };
}

export async function clearManualTaskAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const taskId = typeof input === "object" && input && "taskId" in input ? String((input as { taskId?: unknown }).taskId ?? "") : "";
  const workerId =
    typeof input === "object" && input && "workerId" in input ? String((input as { workerId?: unknown }).workerId ?? "") : "";
  if (!taskId || !workerId) return { ok: false, message: tr("checkInputs") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  let task:
    | {
        id: string;
        isFlagged: boolean;
        baustelle: { id: string; companyProfileId: string };
      }
    | null = null;

  const [worker, adminUser] = await Promise.all([
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: workerId, role: "ADMIN", isActive: true }, select: { id: true } }),
  ]);

  try {
    task = await prisma.manualTask.findUnique({
      where: { id: taskId },
      include: { baustelle: { select: { id: true, companyProfileId: true } } },
    });
  } catch (error) {
    if (!isMissingManualTaskResolutionColumn(error)) throw error;
    const rows = await prisma.$queryRaw<LegacyManualTaskState[]>`
      SELECT mt."id", mt."baustelleId", mt."isFlagged", b."companyProfileId"
      FROM "ManualTask" mt
      JOIN "Baustelle" b ON b."id" = mt."baustelleId"
      WHERE mt."id" = ${taskId}
      LIMIT 1
    `;
    const legacy = rows[0];
    task = legacy
      ? {
          id: legacy.id,
          isFlagged: legacy.isFlagged,
          baustelle: { id: legacy.baustelleId, companyProfileId: (legacy as unknown as { companyProfileId: string }).companyProfileId },
        }
      : null;
  }

  if (!task?.baustelle) return { ok: false, message: tr("taskNotFound") };
  if (!isOwnedByCurrentCompany(task.baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!worker && !adminUser) return { ok: false, message: tr("actorNotFound") };
  if (worker && !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!task.isFlagged) return { ok: true, message: tr("taskAlreadyDone") };

  try {
    await prisma.manualTask.update({
      where: { id: taskId },
      data: {
        isFlagged: false,
        resolvedAt: new Date(),
        resolvedByWorkerId: worker?.id ?? null,
        resolvedByUserId: adminUser?.id ?? null,
      },
    });
  } catch (error) {
    if (!isMissingManualTaskResolutionColumn(error)) throw error;
    await prisma.$executeRaw`
      UPDATE "ManualTask"
      SET "isFlagged" = false
      WHERE "id" = ${taskId}
    `;
  }

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${task.baustelle.id}`);
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("taskMarkedDone") };
}

export async function startWorkingAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = workzoneStartWorkingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const { baustelleId, workerId, startTime } = parsed.data;
  const [worker, baustelle] = await Promise.all([
    prisma.worker.findUnique({ where: { id: workerId } }),
    prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true } }),
  ]);
  if (!worker || worker.status !== "active") return { ok: false, message: tr("workerNotActive") };
  if (!isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!baustelle || !isOwnedByCurrentCompany(baustelle, currentCompanyId)) return { ok: false, message: tr("siteNotFound") };
  if (worker.availability !== "AVAILABLE") return { ok: false, message: tr("workerUnavailable") };
  const selectedStartTime = startTime ? new Date(startTime) : new Date();
  if (Number.isNaN(selectedStartTime.getTime())) return { ok: false, message: tr("invalidStartTime") };

  const existing = await prisma.workSession.findFirst({
    where: { workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (existing) {
    if (existing.baustelleId === baustelleId && existing.isLive && !existing.endTime) {
      return { ok: true, message: tr("workingAlreadyActiveHere") };
    }
    await prisma.workSession.update({
      where: { id: existing.id },
      data: {
        baustelleId,
        startTime: existing.startTime ?? selectedStartTime,
        endTime: null,
        isLive: true,
        closedBySystem: false,
        systemNote: null,
      },
    });
  } else {
    await prisma.workSession.create({
      data: { workerId, baustelleId, startTime: selectedStartTime, endTime: null, breakMinutes: 30, isLive: true },
    });
  }

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("workingStarted") };
}

export async function stopWorkingAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = workzoneStopWorkingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const { baustelleId, workerId } = parsed.data;
  const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, companyProfileId: true } });
  if (!worker || !isOwnedByCurrentCompany(worker, currentCompanyId)) return { ok: false, message: tr("accessDenied") };

  const existing = await prisma.workSession.findFirst({
    where: { baustelleId, workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (!existing) return { ok: false, message: tr("noLiveSessionForSite") };

  // "Stop work on this Baustelle" should only detach the active daily session
  // from the Baustelle, not close the worker's daily session.
  await prisma.workSession.update({
    where: { id: existing.id },
    data: {
      baustelleId: null,
    },
  });

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("siteWorkDetached") };
}

export async function addExternalWorkerToBaustelleAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = addExternalWorkerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("checkWorkerName") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const { baustelleId, addedByWorkerId, firstName, lastName, phone } = parsed.data;
  const [baustelle, addedBy, addedByAdmin] = await Promise.all([
    prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { companyProfileId: true } }),
    prisma.worker.findUnique({ where: { id: addedByWorkerId }, select: { id: true, companyProfileId: true } }),
    prisma.user.findFirst({ where: { id: addedByWorkerId, role: "ADMIN", isActive: true }, select: { id: true } }),
  ]);
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };
  if (!isOwnedByCurrentCompany(baustelle, currentCompanyId)) return { ok: false, message: tr("accessDenied") };
  if (!addedBy && !addedByAdmin) return { ok: false, message: tr("mainActorNotFound") };
  if (addedBy && !isOwnedByCurrentCompany(addedBy, currentCompanyId)) return { ok: false, message: tr("accessDenied") };

  const limit = await checkLimit(currentCompanyId, "workers");
  if (!limit.ok) return { ok: false, message: overLimitMessage(limit, await resolveRequestLanguage()) };

  const worker = await prisma.worker.create({
    data: {
      companyProfileId: baustelle.companyProfileId,
      firstName: firstName.trim(),
      lastName: (lastName ?? "").trim(),
      phone: phone?.trim() || null,
      status: "active",
      isTemporary: true,
      level: "JUNIOR",
      addedByWorkerId: addedBy?.id ?? null,
      startedAtCompany: new Date(),
    },
  });

  await prisma.workSession.create({
    data: { workerId: worker.id, baustelleId, startTime: new Date(), breakMinutes: 30, isLive: true },
  });

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("externalWorkerAddedStarted") };
}

export async function uploadBaustelleDocumentAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const baustelleId = String(formData.get("baustelleId") ?? "");
  const file = formData.get("file");
  if (!baustelleId || !(file instanceof File) || file.size === 0) {
    return { ok: false, message: tr("selectFile") };
  }

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("workerOrAdminLoginRequired") };
  if (file.size > 15_000_000) return { ok: false, message: tr("documentMax15Mb") };
  if (!allowedBaustelleDocument(file)) {
    return { ok: false, message: tr("documentTypeAllowed") };
  }

  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, documents: true },
  });
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };
  if (!isOwnedByCurrentCompany(baustelle, currentCompanyId)) {
    return { ok: false, message: tr("siteAccessDenied") };
  }

  const fileName = `${Date.now()}-${sanitizeFileName(file.name || "dokument")}`;
  const publicUrl = await uploadManagedFile({
    scope: "baustelle-documents",
    entityId: baustelleId,
    file,
    fileName,
  });

  await prisma.baustelle.update({
    where: { id: baustelleId },
    data: { documents: uniqueDocuments([...(baustelle.documents ?? []), publicUrl]) },
  });

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  revalidatePath("/app/baustellen");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("documentUploaded") };
}

export async function deleteBaustelleDocumentAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const baustelleId = String(formData.get("baustelleId") ?? "");
  const documentRef = String(formData.get("documentRef") ?? "");
  if (!baustelleId || !documentRef) return { ok: false, message: tr("documentNotFound") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("workerOrAdminLoginRequired") };

  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, documents: true },
  });
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };
  if (!isOwnedByCurrentCompany(baustelle, currentCompanyId)) {
    return { ok: false, message: tr("siteAccessDenied") };
  }

  if (!(baustelle.documents ?? []).includes(documentRef)) {
    return { ok: false, message: tr("documentNotFound") };
  }

  await prisma.baustelle.update({
    where: { id: baustelleId },
    data: { documents: (baustelle.documents ?? []).filter((item) => item !== documentRef) },
  });
  await deleteManagedFileByUrl(documentRef, { scope: "baustelle-documents", entityId: baustelleId }).catch(() => undefined);

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  revalidatePath("/app/baustellen");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("documentRemoved") };
}
