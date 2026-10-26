"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import type { ActionResult } from "@/lib/validation/action-result";

async function currentActor() {
  const admin = await getCurrentAdmin();
  if (admin) {
    return {
      role: "ADMIN" as const,
      adminId: admin.id,
      workerId: null,
      name: (admin.name ?? admin.email ?? "Admin").trim(),
    };
  }

  const worker = await getCurrentWorker();
  if (worker) {
    return {
      role: "WORKER" as const,
      adminId: null,
      workerId: worker.id,
      name: `${worker.firstName} ${worker.lastName}`.trim() || "Worker",
    };
  }

  return { role: "SYSTEM" as const, adminId: null, workerId: null, name: "System" };
}

function asInt(value: FormDataEntryValue | null, fallback = 0) {
  const n = Math.floor(Number(value ?? fallback) || fallback);
  return Number.isFinite(n) ? n : fallback;
}

async function machineConeAvailable(machineId: string, tr: (key: string, replacements?: Record<string, string | number>) => string): Promise<{ ok: true; companyId: string; available: number } | { ok: false; message: string }> {
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, companyProfileId: true, coneTotal: true } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return { ok: false, message: tr("machineNotFound") };

  const moves = await prisma.machineConeMovement.findMany({
    where: {
      companyProfileId: machine.companyProfileId,
      OR: [{ fromMachineId: machineId }, { toMachineId: machineId }],
    },
    select: { type: true, quantity: true, fromMachineId: true, toMachineId: true },
    orderBy: { createdAt: "desc" },
    take: 6000,
  });

  let delta = 0;
  for (const m of moves) {
    const qty = Math.max(0, Number(m.quantity ?? 0) || 0);
    if (m.type === "DEPLOY" && m.fromMachineId === machineId) delta -= qty;
    else if (m.type === "COLLECT" && m.toMachineId === machineId) delta += qty;
    else if (m.type === "TRANSFER") {
      if (m.fromMachineId === machineId) delta -= qty;
      if (m.toMachineId === machineId) delta += qty;
    }
  }

  const base = Math.max(0, Number(machine.coneTotal ?? 0) || 0);
  return { ok: true, companyId: machine.companyProfileId, available: Math.max(0, base + delta) };
}

async function conesOnTree(companyId: string, treeItemId: string): Promise<number> {
  const moves = await prisma.machineConeMovement.findMany({
    where: { companyProfileId: companyId, treeItemId },
    select: { type: true, quantity: true },
    orderBy: { createdAt: "desc" },
    take: 6000,
  });
  let onSite = 0;
  for (const m of moves.reverse()) {
    const qty = Math.max(0, Number(m.quantity ?? 0) || 0);
    if (m.type === "DEPLOY") onSite += qty;
    else if (m.type === "COLLECT") onSite -= qty;
  }
  return Math.max(0, onSite);
}

export async function setMachineConeTotalAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: tr("coneStockAdminOnly") };

  const machineId = String(formData.get("machineId") ?? "");
  const total = Math.max(0, asInt(formData.get("coneTotal"), 0));
  if (!machineId) return { ok: false, message: tr("machineMissing") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const owned = await prisma.machine.findUnique({ where: { id: machineId }, select: { companyProfileId: true } });
  if (!owned || owned.companyProfileId !== currentCompanyId) return { ok: false, message: tr("machineMissing") };

  await prisma.machine.update({ where: { id: machineId }, data: { coneTotal: total } });

  revalidatePath("/workzone");
  revalidatePath("/app/admin");
  notifyRealtimeUpdate("cones.updated", ["machine-sidebar"]);
  return { ok: true, message: tr("coneStockSaved") };
}

export async function deployConesAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await currentActor();

  const baustelleId = String(formData.get("baustelleId") ?? "");
  const treeItemId = String(formData.get("treeItemId") ?? "");
  const fromMachineId = String(formData.get("machineId") ?? "");
  const quantity = Math.max(1, asInt(formData.get("quantity"), 1));
  if (!baustelleId || !treeItemId || !fromMachineId) return { ok: false, message: tr("missingInputs") };

  const baustelle = await prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true } });
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };

  const avail = await machineConeAvailable(fromMachineId, tr);
  if (!avail.ok) return { ok: false, message: avail.message };
  if (avail.companyId !== baustelle.companyProfileId) return { ok: false, message: tr("machineWrongCompany") };
  if (avail.available < quantity) return { ok: false, message: tr("notEnoughConesMachineWithCount", { count: avail.available }) };

  await prisma.machineConeMovement.create({
    data: {
      companyProfileId: baustelle.companyProfileId,
      type: "DEPLOY",
      quantity,
      fromMachineId,
      baustelleId,
      treeItemId,
      actorRole: actor.role,
      actorAdminId: actor.adminId,
      actorWorkerId: actor.workerId,
      actorName: actor.name,
    },
  });

  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  revalidatePath("/workzone");
  notifyRealtimeUpdate("cones.updated", ["machine-sidebar"]);
  return { ok: true, message: tr("conesDeployed") };
}

export async function collectConesAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await currentActor();

  const baustelleId = String(formData.get("baustelleId") ?? "");
  const treeItemId = String(formData.get("treeItemId") ?? "");
  const toMachineId = String(formData.get("machineId") ?? "");
  const originMachineIdRaw = String(formData.get("originMachineId") ?? "").trim();
  const originMachineId = originMachineIdRaw || null;
  const quantity = Math.max(1, asInt(formData.get("quantity"), 1));
  if (!baustelleId || !treeItemId || !toMachineId) return { ok: false, message: tr("missingInputs") };

  const baustelle = await prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true } });
  if (!baustelle) return { ok: false, message: tr("siteNotFound") };

  const onTree = await conesOnTree(baustelle.companyProfileId, treeItemId);
  if (onTree < quantity) return { ok: false, message: tr("notEnoughConesSiteWithCount", { count: onTree }) };

  if (originMachineId) {
    const from = await prisma.machine.findUnique({ where: { id: originMachineId }, select: { id: true, companyProfileId: true } });
    if (!from || from.companyProfileId !== baustelle.companyProfileId) return { ok: false, message: tr("originMachineInvalid") };
  }
  const to = await prisma.machine.findUnique({ where: { id: toMachineId }, select: { id: true, companyProfileId: true } });
  if (!to || to.companyProfileId !== baustelle.companyProfileId) return { ok: false, message: tr("targetMachineInvalid") };

  await prisma.machineConeMovement.create({
    data: {
      companyProfileId: baustelle.companyProfileId,
      type: "COLLECT",
      quantity,
      fromMachineId: originMachineId,
      toMachineId,
      baustelleId,
      treeItemId,
      actorRole: actor.role,
      actorAdminId: actor.adminId,
      actorWorkerId: actor.workerId,
      actorName: actor.name,
    },
  });

  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  revalidatePath("/workzone");
  notifyRealtimeUpdate("cones.updated", ["machine-sidebar"]);
  return { ok: true, message: tr("conesCollected") };
}

export async function transferConesAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const actor = await currentActor();
  const fromMachineId = String(formData.get("fromMachineId") ?? "");
  const toMachineId = String(formData.get("toMachineId") ?? "");
  const quantity = Math.max(1, asInt(formData.get("quantity"), 1));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!fromMachineId || !toMachineId || fromMachineId === toMachineId) return { ok: false, message: tr("machineSelectionInvalid") };

  const avail = await machineConeAvailable(fromMachineId, tr);
  if (!avail.ok) return { ok: false, message: avail.message };
  if (avail.available < quantity) return { ok: false, message: tr("notEnoughConesMachineWithCount", { count: avail.available }) };
  const to = await prisma.machine.findUnique({ where: { id: toMachineId }, select: { id: true, companyProfileId: true } });
  if (!to) return { ok: false, message: tr("targetMachineNotFound") };
  if (to.companyProfileId !== avail.companyId) return { ok: false, message: tr("machinesMustShareCompany") };

  await prisma.machineConeMovement.create({
    data: {
      companyProfileId: avail.companyId,
      type: "TRANSFER",
      quantity,
      fromMachineId,
      toMachineId,
      actorRole: actor.role,
      actorAdminId: actor.adminId,
      actorWorkerId: actor.workerId,
      actorName: actor.name,
      note,
    },
  });

  revalidatePath("/workzone");
  revalidatePath("/app/admin");
  notifyRealtimeUpdate("cones.updated", ["machine-sidebar"]);
  return { ok: true, message: tr("conesTransferred") };
}

export async function getMachineConeHistoryAction(formData: FormData): Promise<
  | { ok: true; rows: Array<{ at: string; type: string; qty: number; from: string | null; to: string | null; where: string | null; actor: string }> }
  | { ok: false; message: string }
> {
  const tr = await getActionTranslator();
  const machineId = String(formData.get("machineId") ?? "");
  if (!machineId) return { ok: false, message: tr("machineMissing") };

  const companyProfileId = await getCurrentCompanyId();
  if (!companyProfileId) return { ok: false, message: tr("notSignedInNoAccess") };
  const machine = await prisma.machine.findFirst({ where: { id: machineId, companyProfileId }, select: { id: true, companyProfileId: true } });
  if (!machine) return { ok: false, message: tr("machineNotFound") };

  // Anyone logged in (worker/admin) can view movement history as operational data.
  const actor = await currentActor();
  if (actor.role === "SYSTEM") return { ok: false, message: tr("notSignedInNoAccess") };

  const rows = await prisma.machineConeMovement.findMany({
    where: {
      companyProfileId: machine.companyProfileId,
      OR: [{ fromMachineId: machineId }, { toMachineId: machineId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      fromMachine: { select: { nickname: true, name: true } },
      toMachine: { select: { nickname: true, name: true } },
      baustelle: { select: { name: true } },
      treeItem: { select: { treeId: true } },
    },
    take: 40,
  });

  return {
    ok: true,
    rows: rows.map((r) => ({
      at: r.createdAt.toISOString(),
      type: r.type,
      qty: r.quantity,
      from: r.fromMachine ? (r.fromMachine.nickname ?? r.fromMachine.name) : null,
      to: r.toMachine ? (r.toMachine.nickname ?? r.toMachine.name) : null,
      where: r.baustelle ? `${r.baustelle.name}${r.treeItem?.treeId ? ` · Baum ${r.treeItem.treeId}` : ""}` : null,
      actor: r.actorName || r.actorRole,
    })),
  };
}
