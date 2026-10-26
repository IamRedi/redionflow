"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { isRecord } from "@/lib/workzone/site-json";
import type { ActionResult } from "@/lib/validation/action-result";

type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";
type EquipmentStatusMap = Partial<
  Record<
    EquipmentCategory,
    {
      requested: boolean;
      quantity: number;
      workerId: string;
      workerName: string;
      dateSet: string;
    }
  >
>;

function parseEquipmentStatus(value: unknown): EquipmentStatusMap {
  if (!isRecord(value)) return {};
  const map = value;
  const next: EquipmentStatusMap = {};
  for (const category of ["SIGN", "PLATE", "FENCE"] as const) {
    const row = map[category];
    if (!isRecord(row)) continue;
    next[category] = {
      requested: Boolean(row.requested),
      quantity: Math.max(0, Number(row.quantity ?? 0) || 0),
      workerId: String(row.workerId ?? ""),
      workerName: String(row.workerName ?? ""),
      dateSet: String(row.dateSet ?? ""),
    };
  }
  return next;
}

async function resolveActorForTarget(input: { baustelleId: string; treeItemId?: string | null }) {
  const [worker, admin, currentCompanyId] = await Promise.all([
    getCurrentWorker(),
    getCurrentAdmin(),
    getCurrentCompanyId(),
  ]);
  if (!worker && !admin) return null;
  if (!currentCompanyId) return null;
  const baustelle = await prisma.baustelle.findUnique({
    where: { id: input.baustelleId },
    select: { id: true, companyProfileId: true, activeEquipmentStatus: true },
  });
  if (!baustelle) return null;
  if (baustelle.companyProfileId !== currentCompanyId) return null;
  const treeItemId = input.treeItemId ? String(input.treeItemId) : null;
  const treeItem = treeItemId
    ? await prisma.treeItem.findUnique({
        where: { id: treeItemId },
        select: { id: true, baustelleId: true, siteEquipmentStatus: true },
      })
    : null;
  if (treeItem && treeItem.baustelleId !== baustelle.id) return null;
  return {
    baustelle,
    treeItem,
    actorWorkerId: worker?.id ?? null,
    actorAdminId: worker ? null : (admin?.id ?? null),
    actorRole: worker ? "WORKER" : "ADMIN",
    actorName: worker ? `${worker.firstName} ${worker.lastName}`.trim() : (admin?.name ?? admin?.email ?? "Admin"),
  };
}

export async function requestSafetyEquipmentAction(input: {
  baustelleId: string;
  category: EquipmentCategory;
  treeItemId?: string;
}): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await resolveActorForTarget({ baustelleId: input.baustelleId, treeItemId: input.treeItemId });
  if (!actor) return { ok: false, message: tr("siteAccessDenied") };

  const current = parseEquipmentStatus(actor.treeItem ? actor.treeItem.siteEquipmentStatus : actor.baustelle.activeEquipmentStatus);
  const row = current[input.category];
  const quantity = row?.quantity ?? 0;
  current[input.category] = {
    requested: true,
    quantity,
    workerId: row?.workerId ?? "",
    workerName: row?.workerName ?? "",
    dateSet: row?.dateSet ?? "",
  };

  if (actor.treeItem) {
    await prisma.treeItem.update({
      where: { id: actor.treeItem.id },
      data: { siteEquipmentStatus: current },
    });
  } else {
    await prisma.baustelle.update({
      where: { id: actor.baustelle.id },
      data: { activeEquipmentStatus: current },
    });
  }

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${actor.baustelle.id}`);
  revalidatePath("/app/admin");
  notifyRealtimeUpdate("safety.updated", ["safety-panel"]);
  return { ok: true, message: actor.treeItem ? tr("treeSafetyRequested") : tr("siteSafetyRequested") };
}

export async function deploySafetyEquipmentAction(input: {
  baustelleId: string;
  category: EquipmentCategory;
  quantity: number;
  note?: string;
  treeItemId?: string;
}): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, message: tr("invalidQuantity") };
  const actor = await resolveActorForTarget({ baustelleId: input.baustelleId, treeItemId: input.treeItemId });
  if (!actor) return { ok: false, message: tr("siteAccessDenied") };

  const catalog = await prisma.companyInventoryCatalog.findFirst({
    where: { companyProfileId: actor.baustelle.companyProfileId, category: input.category, isActive: true },
  });
  if (!catalog) return { ok: false, message: tr("inventoryCatalogMissing") };
  if (catalog.totalQuantity < qty) return { ok: false, message: tr("inventoryStockInsufficient") };

  const current = parseEquipmentStatus(actor.treeItem ? actor.treeItem.siteEquipmentStatus : actor.baustelle.activeEquipmentStatus);
  const existing = current[input.category];
  const nextQuantity = (existing?.quantity ?? 0) + qty;
  current[input.category] = {
    requested: false,
    quantity: nextQuantity,
    workerId: actor.actorWorkerId ?? "",
    workerName: actor.actorName,
    dateSet: new Date().toISOString(),
  };

  await prisma.$transaction([
    prisma.companyInventoryCatalog.update({
      where: { id: catalog.id },
      data: { totalQuantity: { decrement: qty } },
    }),
    actor.treeItem
      ? prisma.treeItem.update({
          where: { id: actor.treeItem.id },
          data: { siteEquipmentStatus: current },
        })
      : prisma.baustelle.update({
          where: { id: actor.baustelle.id },
          data: { activeEquipmentStatus: current },
        }),
    prisma.inventoryMovement.create({
      data: {
        companyProfileId: actor.baustelle.companyProfileId,
        baustelleId: actor.baustelle.id,
        workerId: actor.actorWorkerId,
        actorAdminId: actor.actorAdminId,
        actorRole: actor.actorRole,
        actorName: actor.actorName,
        treeItemId: actor.treeItem?.id ?? null,
        category: input.category,
        quantity: qty,
        type: "DEPLOY",
        note: input.note?.trim() || null,
      },
    }),
  ]);

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${actor.baustelle.id}`);
  revalidatePath("/app/admin");
  notifyRealtimeUpdate("safety.updated", ["safety-panel"]);
  return { ok: true, message: actor.treeItem ? tr("treeMaterialDeployed") : tr("siteMaterialDeployed") };
}

export async function collectSafetyEquipmentAction(input: {
  baustelleId: string;
  category: EquipmentCategory;
  quantity: number;
  note?: string;
  treeItemId?: string;
}): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, message: tr("invalidQuantity") };
  const actor = await resolveActorForTarget({ baustelleId: input.baustelleId, treeItemId: input.treeItemId });
  if (!actor) return { ok: false, message: tr("siteAccessDenied") };

  const catalog = await prisma.companyInventoryCatalog.findFirst({
    where: { companyProfileId: actor.baustelle.companyProfileId, category: input.category, isActive: true },
  });
  if (!catalog) return { ok: false, message: tr("inventoryCatalogMissing") };

  const current = parseEquipmentStatus(actor.treeItem ? actor.treeItem.siteEquipmentStatus : actor.baustelle.activeEquipmentStatus);
  const existing = current[input.category];
  const onSite = existing?.quantity ?? 0;
  if (onSite < qty) return { ok: false, message: tr("siteReturnQuantityTooHigh") };

  const remaining = onSite - qty;
  if (remaining <= 0) {
    delete current[input.category];
  } else {
    current[input.category] = {
      requested: false,
      quantity: remaining,
      workerId: actor.actorWorkerId ?? "",
      workerName: actor.actorName,
      dateSet: existing?.dateSet ?? new Date().toISOString(),
    };
  }

  await prisma.$transaction([
    prisma.companyInventoryCatalog.update({
      where: { id: catalog.id },
      data: { totalQuantity: { increment: qty } },
    }),
    actor.treeItem
      ? prisma.treeItem.update({
          where: { id: actor.treeItem.id },
          data: { siteEquipmentStatus: current },
        })
      : prisma.baustelle.update({
          where: { id: actor.baustelle.id },
          data: { activeEquipmentStatus: current },
        }),
    prisma.inventoryMovement.create({
      data: {
        companyProfileId: actor.baustelle.companyProfileId,
        baustelleId: actor.baustelle.id,
        workerId: actor.actorWorkerId,
        actorAdminId: actor.actorAdminId,
        actorRole: actor.actorRole,
        actorName: actor.actorName,
        treeItemId: actor.treeItem?.id ?? null,
        category: input.category,
        quantity: qty,
        type: "COLLECT",
        note: input.note?.trim() || null,
      },
    }),
  ]);

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${actor.baustelle.id}`);
  revalidatePath("/app/admin");
  notifyRealtimeUpdate("safety.updated", ["safety-panel"]);
  return { ok: true, message: actor.treeItem ? tr("treeMaterialCollected") : tr("siteMaterialCollected") };
}

export async function setSafetyEquipmentQuantityAction(input: {
  baustelleId: string;
  category: EquipmentCategory;
  targetQuantity: number;
  note?: string;
  treeItemId?: string;
}): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const target = Math.max(0, Math.floor(Number(input.targetQuantity) || 0));
  const actor = await resolveActorForTarget({ baustelleId: input.baustelleId, treeItemId: input.treeItemId });
  if (!actor) return { ok: false, message: tr("siteAccessDenied") };

  const current = parseEquipmentStatus(actor.treeItem ? actor.treeItem.siteEquipmentStatus : actor.baustelle.activeEquipmentStatus);
  const existing = current[input.category];
  const currentQty = Math.max(0, Number(existing?.quantity ?? 0) || 0);

  if (target === currentQty) {
    if (target === 0 && existing?.requested) {
      delete current[input.category];
      if (actor.treeItem) {
        await prisma.treeItem.update({
          where: { id: actor.treeItem.id },
          data: { siteEquipmentStatus: current },
        });
      } else {
        await prisma.baustelle.update({
          where: { id: actor.baustelle.id },
          data: { activeEquipmentStatus: current },
        });
      }
      revalidatePath("/workzone");
      revalidatePath(`/workzone/baustellen/${actor.baustelle.id}`);
      revalidatePath("/app/admin");
      notifyRealtimeUpdate("safety.updated", ["safety-panel"]);
      return { ok: true, message: tr("requestRemoved") };
    }
    return { ok: true, message: tr("quantityUnchanged") };
  }

  if (target > currentQty) {
    const result = await deploySafetyEquipmentAction({
      baustelleId: input.baustelleId,
      category: input.category,
      quantity: target - currentQty,
      note: input.note,
      treeItemId: input.treeItemId,
    });
    return result;
  }

  const result = await collectSafetyEquipmentAction({
    baustelleId: input.baustelleId,
    category: input.category,
    quantity: currentQty - target,
    note: input.note,
    treeItemId: input.treeItemId,
  });
  return result;
}
