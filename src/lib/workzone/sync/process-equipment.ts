

import { prisma } from "@/lib/db/prisma";

import type { SyncActionResult, WorkzoneActorKind } from "@/lib/workzone/offline/types";
import type { SyncMessages } from "./messages";
import { recordOutcome } from "./outcome";
import { siteEquipmentMovementPayloadSchema, type AuthContext, type PendingAction } from "./schemas";

export function parseSiteEquipmentStatus(value: unknown): Record<string, { requested: boolean; quantity: number; workerId: string; workerName: string; dateSet: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const map = value as Record<string, unknown>;
  const next: Record<string, { requested: boolean; quantity: number; workerId: string; workerName: string; dateSet: string }> = {};
  for (const cat of ["SIGN", "PLATE", "FENCE"]) {
    const row = map[cat];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    next[cat] = {
      requested: Boolean(r.requested),
      quantity: Math.max(0, Number(r.quantity ?? 0) || 0),
      workerId: String(r.workerId ?? ""),
      workerName: String(r.workerName ?? ""),
      dateSet: String(r.dateSet ?? ""),
    };
  }
  return next;
}

export async function processSiteEquipmentMovement(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = siteEquipmentMovementPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("SITE_EQUIPMENT_MOVEMENT");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { movementType, baustelleId, category, workerId, treeItemId, quantity, targetQuantity, note } = payload.data;

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

  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, isActive: true, activeEquipmentStatus: true },
  });

  if (!baustelle) {
    await recordOutcome(action.id, auth, action, "conflict", m.siteNotFound);
    return { id: action.id, outcome: "conflict", message: m.siteNotFound };
  }

  if (baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  const treeItem = treeItemId
    ? await prisma.treeItem.findUnique({
        where: { id: treeItemId },
        select: { id: true, baustelleId: true, siteEquipmentStatus: true },
      })
    : null;

  if (treeItemId && (!treeItem || treeItem.baustelleId !== baustelleId)) {
    await recordOutcome(action.id, auth, action, "conflict", m.treeItemNotFoundOnSite);
    return { id: action.id, outcome: "conflict", message: m.treeItemNotFoundOnSite };
  }

  const actorName = `${worker.firstName} ${worker.lastName}`.trim();
  const rawStatus = treeItem ? treeItem.siteEquipmentStatus : baustelle.activeEquipmentStatus;
  const current = parseSiteEquipmentStatus(rawStatus);

  // baustelle is guaranteed non-null here (early return above handles the null case)
  const nonNullBaustelle = baustelle!;
  async function updateStatus(next: typeof current) {
    if (treeItem) {
      await prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: next } });
    } else {
      await prisma.baustelle.update({ where: { id: nonNullBaustelle.id }, data: { activeEquipmentStatus: next } });
    }
  }

  if (movementType === "REQUEST") {
    const existing = current[category];
    current[category] = {
      requested: true,
      quantity: existing?.quantity ?? 0,
      workerId: existing?.workerId ?? "",
      workerName: existing?.workerName ?? "",
      dateSet: existing?.dateSet ?? "",
    };
    await updateStatus(current);
    await recordOutcome(action.id, auth, action, "synced");
    return { id: action.id, outcome: "synced" };
  }

  if (movementType === "SET_QUANTITY") {
    const target = Math.max(0, Math.floor(Number(targetQuantity ?? 0) || 0));
    const currentQty = current[category]?.quantity ?? 0;
    if (target === 0 && (current[category]?.requested ?? false)) {
      delete current[category];
      await updateStatus(current);
      await recordOutcome(action.id, auth, action, "synced");
      return { id: action.id, outcome: "synced" };
    }
    if (target === currentQty) {
      await recordOutcome(action.id, auth, action, "noop", m.noQuantityChange);
      return { id: action.id, outcome: "noop", message: m.noQuantityChange };
    }
    const delta = target > currentQty ? target - currentQty : currentQty - target;
    const type = target > currentQty ? "DEPLOY" : "COLLECT";
    const catalog = await prisma.companyInventoryCatalog.findFirst({
      where: { companyProfileId: auth.companyProfileId, category, isActive: true },
    });
    if (!catalog) {
      await recordOutcome(action.id, auth, action, "conflict", m.inventoryCatalogMissing);
      return { id: action.id, outcome: "conflict", message: m.inventoryCatalogMissing };
    }
    if (type === "DEPLOY" && catalog.totalQuantity < delta) {
      await recordOutcome(action.id, auth, action, "conflict", m.insufficientStock);
      return { id: action.id, outcome: "conflict", message: m.insufficientStock };
    }
    const nextQty = target;
    if (nextQty <= 0) {
      delete current[category];
    } else {
      current[category] = { requested: false, quantity: nextQty, workerId, workerName: actorName, dateSet: new Date().toISOString() };
    }
    await prisma.$transaction([
      prisma.companyInventoryCatalog.update({
        where: { id: catalog.id },
        data: { totalQuantity: type === "DEPLOY" ? { decrement: delta } : { increment: delta } },
      }),
      treeItem
        ? prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: current } })
        : prisma.baustelle.update({ where: { id: baustelle.id }, data: { activeEquipmentStatus: current } }),
      prisma.inventoryMovement.create({
        data: {
          companyProfileId: auth.companyProfileId,
          baustelleId,
          workerId,
          actorAdminId: null,
          actorRole: "WORKER",
          actorName,
          treeItemId: treeItem?.id ?? null,
          category,
          quantity: delta,
          type,
          note: note?.trim() || null,
        },
      }),
    ]);
    await recordOutcome(action.id, auth, action, "synced");
    return { id: action.id, outcome: "synced" };
  }

  // DEPLOY or COLLECT
  const qty = Math.floor(Number(quantity ?? 0) || 0);
  if (qty <= 0) {
    await recordOutcome(action.id, auth, action, "rejected", m.quantityPositive);
    return { id: action.id, outcome: "rejected", message: m.quantityPositive };
  }

  const catalog = await prisma.companyInventoryCatalog.findFirst({
    where: { companyProfileId: auth.companyProfileId, category, isActive: true },
  });

  if (!catalog) {
    await recordOutcome(action.id, auth, action, "conflict", m.inventoryCatalogMissing);
    return { id: action.id, outcome: "conflict", message: m.inventoryCatalogMissing };
  }

  if (movementType === "DEPLOY") {
    if (catalog.totalQuantity < qty) {
      await recordOutcome(action.id, auth, action, "conflict", m.insufficientStock);
      return { id: action.id, outcome: "conflict", message: m.insufficientStock };
    }
    const existing = current[category];
    current[category] = {
      requested: false,
      quantity: (existing?.quantity ?? 0) + qty,
      workerId,
      workerName: actorName,
      dateSet: new Date().toISOString(),
    };
    await prisma.$transaction([
      prisma.companyInventoryCatalog.update({ where: { id: catalog.id }, data: { totalQuantity: { decrement: qty } } }),
      treeItem
        ? prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: current } })
        : prisma.baustelle.update({ where: { id: baustelle.id }, data: { activeEquipmentStatus: current } }),
      prisma.inventoryMovement.create({
        data: {
          companyProfileId: auth.companyProfileId,
          baustelleId,
          workerId,
          actorAdminId: null,
          actorRole: "WORKER",
          actorName,
          treeItemId: treeItem?.id ?? null,
          category,
          quantity: qty,
          type: "DEPLOY",
          note: note?.trim() || null,
        },
      }),
    ]);
  } else {
    // COLLECT
    const onSite = current[category]?.quantity ?? 0;
    if (onSite < qty) {
      await recordOutcome(action.id, auth, action, "conflict", m.collectExceedsOnSite);
      return { id: action.id, outcome: "conflict", message: m.collectExceedsOnSite };
    }
    const remaining = onSite - qty;
    if (remaining <= 0) {
      delete current[category];
    } else {
      current[category] = {
        requested: false,
        quantity: remaining,
        workerId: current[category]?.workerId ?? "",
        workerName: current[category]?.workerName ?? "",
        dateSet: current[category]?.dateSet ?? new Date().toISOString(),
      };
    }
    await prisma.$transaction([
      prisma.companyInventoryCatalog.update({ where: { id: catalog.id }, data: { totalQuantity: { increment: qty } } }),
      treeItem
        ? prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: current } })
        : prisma.baustelle.update({ where: { id: baustelle.id }, data: { activeEquipmentStatus: current } }),
      prisma.inventoryMovement.create({
        data: {
          companyProfileId: auth.companyProfileId,
          baustelleId,
          workerId,
          actorAdminId: null,
          actorRole: "WORKER",
          actorName,
          treeItemId: treeItem?.id ?? null,
          category,
          quantity: qty,
          type: "COLLECT",
          note: note?.trim() || null,
        },
      }),
    ]);
  }

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}
