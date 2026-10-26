"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import type { ActionResult } from "@/lib/validation/action-result";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { generateInventoryBarcode, normalizeBarcodeInput } from "@/lib/inventory/barcode";

type InventoryActor = {
  role: "ADMIN" | "WORKER";
  name: string;
  adminId: string | null;
  workerId: string | null;
};

function kindFromCategory(category: "WORK_TOOL" | "CLOTHING" | "SITE_EQUIPMENT") {
  return category === "CLOTHING" ? "CLOTHING" : "EQUIPMENT";
}

function inventoryCategoryFromKind(kind: string) {
  return kind === "CLOTHING" ? "CLOTHING" : kind === "SITE_EQUIPMENT" ? "SITE_EQUIPMENT" : "WORK_TOOL";
}

function revalidateInventoryPaths(workerId?: string | null) {
  revalidatePath("/workzone/profile");
  revalidatePath("/app/admin");
  revalidatePath("/app/admin/inventory");
  revalidatePath("/app/admin/inventory/print");
  if (workerId) {
    revalidatePath(`/app/admin/workers/${workerId}`);
    revalidatePath(`/workzone/admin-workers/${workerId}`);
  }
  notifyRealtimeUpdate("inventory.updated", ["worker-profile", "admin-inventory"]);
}

async function getInventoryActor() {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (admin) {
    return {
      role: "ADMIN",
      name: admin.name ?? admin.email,
      adminId: admin.id,
      workerId: null,
    } satisfies InventoryActor;
  }
  if (worker) {
    return {
      role: "WORKER",
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      adminId: null,
      workerId: worker.id,
    } satisfies InventoryActor;
  }
  return null;
}

async function resolveWorkerAccess(workerId: string) {
  const tr = await getActionTranslator();
  const actor = await getInventoryActor();
  if (!actor) return { error: tr("loginRequired") } as const;
  if (actor.role === "WORKER" && actor.workerId !== workerId) return { error: tr("profileAccessDenied") } as const;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { error: tr("loginRequired") } as const;

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, companyProfileId: true, firstName: true, lastName: true },
  });
  if (!worker || worker.companyProfileId !== currentCompanyId) {
    return { error: tr("workerNotFound") } as const;
  }

  return { actor, worker } as const;
}

async function ensureUniqueBarcode(barcode: string, excludeItemId?: string) {
  const existing = await prisma.companyInventoryItem.findFirst({
    where: {
      barcode,
      ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

async function generateUniqueInventoryItemCode(companyProfileId: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `INV-${Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}`;
    const existing = await prisma.companyInventoryItem.findFirst({
      where: { companyProfileId, itemCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return `INV-${Date.now().toString().slice(-6)}`;
}

async function createMovement(tx: Prisma.TransactionClient, input: {
  companyProfileId: string;
  itemId?: string | null;
  workerId?: string | null;
  actor: InventoryActor;
  action: "TAKE" | "RETURN" | "CREATE_PRIVATE";
  barcode?: string | null;
  isPrivate?: boolean;
  note?: string | null;
}) {
  await tx.inventoryAssetMovement.create({
    data: {
      companyProfileId: input.companyProfileId,
      itemId: input.itemId ?? null,
      workerId: input.workerId ?? null,
      actorAdminId: input.actor.adminId,
      action: input.action,
      actorRole: input.actor.role,
      actorName: input.actor.name,
      barcode: input.barcode ?? null,
      isPrivate: input.isPrivate ?? false,
      note: input.note ?? null,
    },
  });
}

async function findActiveAssignment(tx: Prisma.TransactionClient, companyInventoryItemId: string) {
  return tx.workerAssetItem.findFirst({
    where: {
      companyInventoryItemId,
      status: { not: "DELETED" },
    },
    select: {
      id: true,
      workerId: true,
      worker: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function submitWorkerInventoryAssignmentAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  const companyInventoryItemId = String(formData.get("companyInventoryItemId") ?? "").trim();
  const itemName = String(formData.get("itemName") ?? "").trim();
  const itemCode = String(formData.get("itemCode") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const sizeLabel = String(formData.get("sizeLabel") ?? "").trim();
  const rawBarcode = String(formData.get("barcode") ?? "").trim();
  const barcode = rawBarcode ? normalizeBarcodeInput(rawBarcode) : null;
  const privateKind = String(formData.get("kind") ?? "") === "CLOTHING" ? "CLOTHING" : "EQUIPMENT";

  if (!workerId) return { ok: false, message: tr("workerNotFound") };
  const access = await resolveWorkerAccess(workerId);
  if ("error" in access) return { ok: false, message: access.error || tr("accessDenied") };
  const { actor, worker } = access;

  const companyItem = companyInventoryItemId
    ? await prisma.companyInventoryItem.findFirst({
        where: { id: companyInventoryItemId, companyProfileId: worker.companyProfileId, isActive: true },
      })
    : barcode
      ? await prisma.companyInventoryItem.findFirst({
          where: { companyProfileId: worker.companyProfileId, barcode, isActive: true },
        })
      : null;

  if (!companyItem && !itemName) {
    return { ok: false, message: tr("inventoryNameOrCompanyItemRequired") };
  }

  if (companyItem) {
    const activeAssignment = await findActiveAssignment(prisma, companyItem.id);
    if (activeAssignment && activeAssignment.workerId !== workerId) {
      const assignedName = `${activeAssignment.worker.firstName} ${activeAssignment.worker.lastName}`.trim();
      return { ok: false, message: tr("inventoryAlreadyAssignedTo", { name: assignedName }) };
    }
    if (activeAssignment && activeAssignment.workerId === workerId) {
      return { ok: true, message: tr("inventoryAlreadyAssignedHere") };
    }

    await prisma.$transaction(async (tx) => {
      await tx.workerAssetItem.create({
        data: {
          workerId,
          companyInventoryItemId: companyItem.id,
          kind: kindFromCategory(companyItem.category),
          itemName: companyItem.name,
          itemCode: companyItem.itemCode,
          barcode: companyItem.barcode,
          sizeLabel: companyItem.sizeLabel,
          isPrivate: false,
          note: note || companyItem.note || null,
          status: "ACTIVE",
          createdByRole: actor.role,
          createdByName: actor.name,
          confirmedAt: new Date(),
          confirmedByRole: actor.role,
          confirmedByName: actor.name,
        },
      });

      await createMovement(tx, {
        companyProfileId: worker.companyProfileId,
        itemId: companyItem.id,
        workerId,
        actor,
        action: "TAKE",
        barcode: companyItem.barcode,
        isPrivate: false,
        note: note || null,
      });
    });

    revalidateInventoryPaths(workerId);
    return { ok: true, message: tr("inventoryAssignedAndLogged") };
  }

  await prisma.$transaction(async (tx) => {
    await tx.workerAssetItem.create({
      data: {
        workerId,
        kind: privateKind,
        itemName,
        itemCode: itemCode || null,
        barcode,
        sizeLabel: sizeLabel || null,
        isPrivate: true,
        note: note || null,
        status: "ACTIVE",
        createdByRole: actor.role,
        createdByName: actor.name,
        confirmedAt: new Date(),
        confirmedByRole: actor.role,
        confirmedByName: actor.name,
      },
    });

    await createMovement(tx, {
      companyProfileId: worker.companyProfileId,
      workerId,
      actor,
      action: "CREATE_PRIVATE",
      barcode,
      isPrivate: true,
      note: note || itemName,
    });
  });

  revalidateInventoryPaths(workerId);
  return { ok: true, message: tr("inventoryPrivateSavedAndLogged") };
}

export async function scanWorkerInventoryBarcodeAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  const barcode = normalizeBarcodeInput(String(formData.get("barcode") ?? ""));
  const note = String(formData.get("note") ?? "").trim();
  const itemName = String(formData.get("itemName") ?? "").trim();
  const kind = String(formData.get("kind") ?? "EQUIPMENT");

  if (!barcode) return { ok: false, message: tr("barcodeMissing") };

  const next = new FormData();
  next.set("workerId", workerId);
  next.set("barcode", barcode);
  next.set("note", note);
  next.set("itemName", itemName || `Privat ${barcode}`);
  next.set("kind", kind);
  return submitWorkerInventoryAssignmentAction(next);
}

export async function returnWorkerInventoryItemAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ok: false, message: tr("itemNotFound") };

  const actor = await getInventoryActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };

  const item = await prisma.workerAssetItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      workerId: true,
      companyInventoryItemId: true,
      itemName: true,
      barcode: true,
      isPrivate: true,
      status: true,
      worker: { select: { companyProfileId: true } },
    },
  });
  if (!item) return { ok: false, message: tr("itemNotFound") };
  if (actor.role === "WORKER" && actor.workerId !== item.workerId) return { ok: false, message: tr("profileAccessDenied") };
  if (item.status === "DELETED") return { ok: true, message: tr("inventoryAlreadyReturned") };

  await prisma.$transaction(async (tx) => {
    await tx.workerAssetItem.update({
      where: { id: item.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        deleteRequestedAt: new Date(),
        deleteRequestedByRole: actor.role,
        deleteRequestedByName: actor.name,
        confirmedAt: new Date(),
        confirmedByRole: actor.role,
        confirmedByName: actor.name,
      },
    });

    await createMovement(tx, {
      companyProfileId: item.worker.companyProfileId,
      itemId: item.companyInventoryItemId,
      workerId: item.workerId,
      actor,
      action: "RETURN",
      barcode: item.barcode,
      isPrivate: item.isPrivate,
      note: item.itemName,
    });
  });

  revalidateInventoryPaths(item.workerId);
  return { ok: true, message: tr("inventoryReturnLogged") };
}

export async function createAdminInventoryItemAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await getInventoryActor();
  if (!actor || actor.role !== "ADMIN") return { ok: false, message: tr("adminOnly") };

  const company = await getOrCreateDefaultCompany();
  const category = inventoryCategoryFromKind(String(formData.get("category") ?? "WORK_TOOL"));
  const itemCodeInput = String(formData.get("itemCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sizeLabel = String(formData.get("sizeLabel") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const rawBarcode = String(formData.get("barcode") ?? "").trim();
  const barcode = rawBarcode ? normalizeBarcodeInput(rawBarcode) : null;

  if (!name) return { ok: false, message: tr("nameRequired") };
  if (!barcode) return { ok: false, message: tr("barcodeRequiredFirst") };
  if (!(await ensureUniqueBarcode(barcode))) return { ok: false, message: tr("barcodeAlreadyExists") };
  const itemCode = itemCodeInput || (await generateUniqueInventoryItemCode(company.id));

  await prisma.companyInventoryItem.create({
    data: {
      companyProfileId: company.id,
      category,
      itemCode,
      name,
      sizeLabel: sizeLabel || null,
      note: note || null,
      barcode,
      isActive: true,
    },
  });

  revalidateInventoryPaths();
  return { ok: true, message: tr("inventoryItemCreated") };
}

export async function updateAdminInventoryItemAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await getInventoryActor();
  if (!actor || actor.role !== "ADMIN") return { ok: false, message: tr("adminOnly") };

  const id = String(formData.get("id") ?? "");
  const itemCode = String(formData.get("itemCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sizeLabel = String(formData.get("sizeLabel") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const rawBarcode = String(formData.get("barcode") ?? "").trim();
  const requestedBarcode = rawBarcode ? normalizeBarcodeInput(rawBarcode) : null;
  const isActive = String(formData.get("isActive") ?? "on") !== "off";

  if (!id || !itemCode || !name) return { ok: false, message: tr("nameAndIdRequired") };
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const existingItem = await prisma.companyInventoryItem.findUnique({
    where: { id },
    select: { id: true, barcode: true, companyProfileId: true },
  });
  if (!existingItem || existingItem.companyProfileId !== currentCompanyId) {
    return { ok: false, message: tr("itemNotFound") };
  }

  let barcode = existingItem.barcode;
  if (!existingItem.barcode && requestedBarcode) {
    if (!(await ensureUniqueBarcode(requestedBarcode, id))) return { ok: false, message: tr("barcodeAlreadyExists") };
    barcode = requestedBarcode;
  }

  await prisma.companyInventoryItem.update({
    where: { id },
    data: {
      itemCode,
      name,
      sizeLabel: sizeLabel || null,
      note: note || null,
      barcode,
      isActive,
    },
  });

  revalidateInventoryPaths();
  return { ok: true, message: tr("itemUpdated") };
}

export async function generateAdminInventoryBarcodeAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await getInventoryActor();
  if (!actor || actor.role !== "ADMIN") return { ok: false, message: tr("adminOnly") };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: tr("itemNotFound") };
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const existingItem = await prisma.companyInventoryItem.findUnique({
    where: { id },
    select: { barcode: true, companyProfileId: true },
  });
  if (!existingItem || existingItem.companyProfileId !== currentCompanyId) {
    return { ok: false, message: tr("itemNotFound") };
  }
  if (existingItem.barcode) return { ok: false, message: tr("barcodeAlreadyFixed") };

  let barcode = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = generateInventoryBarcode();
    if (await ensureUniqueBarcode(next, id)) {
      barcode = next;
      break;
    }
  }
  if (!barcode) return { ok: false, message: tr("barcodeGenerateFailed") };

  await prisma.companyInventoryItem.update({
    where: { id },
    data: { barcode },
  });

  revalidateInventoryPaths();
  return { ok: true, message: tr("barcodeGenerated") };
}
