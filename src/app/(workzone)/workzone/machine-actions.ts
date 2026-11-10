"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from 'node:crypto';

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { parseMachineNotes, serializeMachineNotes, type MachineDefect } from "@/lib/workzone/machine-notes";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import type { ActionResult } from "@/lib/validation/action-result";
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { runAssetMutation } from '@/lib/company-assets/service';
import { assetActionError, assetWorkflowMessage } from '@/lib/company-assets/action-errors';
import { updateMachineWithAssetGuard } from '@/lib/company-assets/legacy-machine';

async function actorName() {
  const admin = await getCurrentAdmin();
  if (admin) return admin.name ?? admin.email;

  const worker = await getCurrentWorker();
  if (worker) return `${worker.firstName} ${worker.lastName}`.trim();

  return "System";
}

function defectId() {
  return `defect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function revalidateMachine(machineId: string) {
  revalidatePath("/workzone");
  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/machines/${machineId}`);
  notifyRealtimeUpdate("machine.updated", ["machine-sidebar"]);
}

function appendMachineNote(existing: string | null, author: string, text: string) {
  const stamp = new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  const entry = `[${stamp}] ${author}: ${text}`;
  return existing ? `${entry}\n${existing}` : entry;
}

export async function addMachineNoteAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const machineId = String(formData.get("machineId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!machineId || !note) return { ok: false, message: tr("noteRequired") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, notes: true, companyProfileId: true } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return { ok: false, message: tr("machineNotFound") };

  const notes = parseMachineNotes(machine.notes);
  const nextBody = appendMachineNote(notes.body, await actorName(), note);
  await prisma.machine.update({ where: { id: machineId }, data: { notes: serializeMachineNotes({ ...notes, body: nextBody }) } });

  revalidateMachine(machineId);
  return { ok: true, message: tr("noteSaved") };
}

export async function addMachineDefectAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const machineId = String(formData.get("machineId") ?? "");
  const text = String(formData.get("defect") ?? "").trim();
  if (!machineId || !text) return { ok: false, message: tr("defectRequired") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, notes: true, companyProfileId: true } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return { ok: false, message: tr("machineNotFound") };

  if (await isSteelCompany(currentCompanyId)) {
    try {
      await runAssetMutation({ requestId: randomUUID(), command: { type: 'report', asset: { kind: 'machine', id: machineId }, kind: 'defect', note: text } });
      revalidateMachine(machineId);
      revalidatePath('/workzone', 'layout');
      revalidatePath('/app/workshop');
      return { ok: true, message: tr('defectSaved') };
    } catch (error) { return assetActionError(error); }
  }

  const notes = parseMachineNotes(machine.notes);
  const defect: MachineDefect = {
    id: defectId(),
    text,
    reportedBy: await actorName(),
    reportedAt: new Date().toISOString(),
  };
  await prisma.machine.update({ where: { id: machineId }, data: { notes: serializeMachineNotes({ ...notes, defects: [defect, ...notes.defects].slice(0, 5) }) } });

  revalidateMachine(machineId);
  return { ok: true, message: tr("defectSaved") };
}

export async function resolveMachineDefectAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const machineId = String(formData.get("machineId") ?? "");
  const defectIdValue = String(formData.get("defectId") ?? "");
  if (!machineId || !defectIdValue) return { ok: false, message: tr("defectNotFound") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, notes: true, companyProfileId: true } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return { ok: false, message: tr("machineNotFound") };
  if (await isSteelCompany(currentCompanyId)) return { ok: false, message: await assetWorkflowMessage() };

  const actor = await actorName();
  const notes = parseMachineNotes(machine.notes);
  const defects = notes.defects.map((defect) =>
    defect.id === defectIdValue && !defect.resolvedAt
      ? {
          ...defect,
          resolvedBy: actor,
          resolvedAt: new Date().toISOString(),
        }
      : defect,
  );

  await prisma.machine.update({ where: { id: machineId }, data: { notes: serializeMachineNotes({ ...notes, defects }) } });

  revalidateMachine(machineId);
  return { ok: true, message: tr("defectResolvedSaved") };
}

export async function blockMachineAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: tr("machineBlockAdminOnly") };

  const machineId = String(formData.get("machineId") ?? "");
  if (!machineId) return { ok: false, message: tr("machineNotFound") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { companyProfileId: true } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return { ok: false, message: tr("machineNotFound") };

  try { await updateMachineWithAssetGuard(currentCompanyId, machineId, { isActive: false }); }
  catch (error) { return assetActionError(error); }

  revalidateMachine(machineId);
  return { ok: true, message: tr("machineBlockedSaved") };
}

/** Mark a vehicle private (only PRIVATE_VEHICLES_ONLY people see it in Flota and GPS) or public again. */
export async function setMachinePrivateAction(machineId: string, isPrivate: boolean): Promise<{ ok: boolean }> {
  const { currentMaySeePrivateVehicles } = await import("@/lib/fleet/private-vehicles");
  const companyId = await getCurrentCompanyId();
  if (!companyId || typeof machineId !== "string" || !(await currentMaySeePrivateVehicles())) return { ok: false };
  const { withTenantContext } = await import("@/lib/db/tenant-context");
  const changed = await withTenantContext(companyId, tx => tx.machine.updateMany({ where: { id: machineId, companyProfileId: companyId }, data: { isPrivate: Boolean(isPrivate) } }));
  if (!changed.count) return { ok: false };
  revalidateMachine(machineId);
  revalidatePath("/app/fleet-gps");
  revalidatePath("/app/machines");
  return { ok: true };
}
