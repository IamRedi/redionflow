"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { machineOptionLabel } from "@/lib/machines/display";
import { positionMetaFormSchema } from "@/lib/validation/schemas";

function path(projectId: string, positionId: string) {
  return `/app/projects/${projectId}/positions/${positionId}`;
}

/**
 * Verify the current tenant owns a position (via its project). Used at the top
 * of every position-scoped action to prevent cross-tenant writes.
 * Returns null on mismatch/unauthenticated so callers can `return` silently.
 */
async function ownedPosition(positionId: string) {
  if (!positionId) return null;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return null;
  const position = await prisma.projectPosition.findUnique({
    where: { id: positionId },
    select: { id: true, project: { select: { companyProfileId: true } } },
  });
  if (!position || position.project.companyProfileId !== currentCompanyId) return null;
  return position;
}

function decimalText(value: FormDataEntryValue | null, fallback: string) {
  const text = String(value ?? "").trim().replace(",", ".");
  return text || fallback;
}

function euroCents(value: FormDataEntryValue | null) {
  const amount = Number(decimalText(value, "0"));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export async function updatePositionMeta(formData: FormData) {
  const parsed = positionMetaFormSchema.safeParse({
    positionId: formData.get("positionId"),
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    unit: formData.get("unit"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes") ?? undefined,
    manualAdjustmentEur: formData.get("manualAdjustmentEur"),
  });
  if (!parsed.success) return;

  const v = parsed.data;
  if (!(await ownedPosition(v.positionId))) return;

  const description = v.description?.trim() ? v.description.trim() : null;
  const notes = v.notes?.trim() ? v.notes.trim() : null;
  const manualAdjustmentCents = Math.round(v.manualAdjustmentEur * 100);

  await prisma.projectPosition.update({
    where: { id: v.positionId },
    data: {
      title: v.title.trim(),
      description,
      unit: v.unit.trim(),
      quantity: v.quantity,
      notes,
      manualAdjustmentCents,
    },
  });
  revalidatePath(path(v.projectId, v.positionId));
  revalidatePath(`/app/projects/${v.projectId}`);
}

export async function addLaborRow(formData: FormData) {
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const laborRoleId = String(formData.get("laborRoleId") ?? "");
  const workers = Math.max(1, Math.round(Number(formData.get("workers") ?? 1)));
  const hours = String(formData.get("hours") ?? "0");
  const overrideEur = Number(formData.get("overrideEur") ?? 0);
  const hourlyRateOverrideCents = overrideEur > 0 ? Math.round(overrideEur * 100) : null;

  if (!(await ownedPosition(positionId))) return;
  const currentCompanyId = await getCurrentCompanyId();
  const role = await prisma.laborRole.findUnique({ where: { id: laborRoleId }, select: { id: true, name: true, companyProfileId: true } });
  if (!role || role.companyProfileId !== currentCompanyId) return;

  await prisma.positionLaborItem.create({
    data: {
      positionId,
      laborRoleId,
      laborRoleNameSnapshot: role.name,
      workers,
      hours,
      hourlyRateOverrideCents,
    },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateLaborRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const laborRoleId = String(formData.get("laborRoleId") ?? "");
  const workers = Math.max(1, Math.round(Number(formData.get("workers") ?? 1)));
  const hours = String(formData.get("hours") ?? "0");
  const overrideEur = Number(formData.get("overrideEur") ?? 0);
  const hourlyRateOverrideCents = overrideEur > 0 ? Math.round(overrideEur * 100) : null;

  const position = await ownedPosition(positionId);
  if (!position) return;
  const currentCompanyId = await getCurrentCompanyId();
  const role = await prisma.laborRole.findUnique({ where: { id: laborRoleId }, select: { id: true, name: true, companyProfileId: true } });
  if (!role || role.companyProfileId !== currentCompanyId) return;

  await prisma.positionLaborItem.updateMany({
    where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } },
    data: {
      laborRoleId,
      laborRoleNameSnapshot: role.name,
      workers,
      hours,
      hourlyRateOverrideCents,
    },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function deleteLaborRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const position = await ownedPosition(positionId);
  if (!position) return;
  await prisma.positionLaborItem.deleteMany({ where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } } });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function addMachineRow(formData: FormData) {
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const machineId = String(formData.get("machineId") ?? "");
  const timeUnit = String(formData.get("timeUnit") ?? "HOURS") as "HOURS" | "DAYS";
  const quantity = String(formData.get("quantity") ?? "0");
  const overrideEur = Number(formData.get("overrideEur") ?? 0);
  const rateOverrideCents = overrideEur > 0 ? Math.round(overrideEur * 100) : null;

  if (!(await ownedPosition(positionId))) return;
  const currentCompanyId = await getCurrentCompanyId();
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return;

  await prisma.positionMachineItem.create({
    data: {
      positionId,
      machineId,
      machineNameSnapshot: machineOptionLabel(machine),
      timeUnit,
      quantity,
      rateOverrideCents,
    },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateMachineRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const machineId = String(formData.get("machineId") ?? "");
  const timeUnit = String(formData.get("timeUnit") ?? "HOURS") as "HOURS" | "DAYS";
  const quantity = String(formData.get("quantity") ?? "0");
  const overrideEur = Number(formData.get("overrideEur") ?? 0);
  const rateOverrideCents = overrideEur > 0 ? Math.round(overrideEur * 100) : null;

  const position = await ownedPosition(positionId);
  if (!position) return;
  const currentCompanyId = await getCurrentCompanyId();
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine || machine.companyProfileId !== currentCompanyId) return;

  await prisma.positionMachineItem.updateMany({
    where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } },
    data: {
      machineId,
      machineNameSnapshot: machineOptionLabel(machine),
      timeUnit,
      quantity,
      rateOverrideCents,
    },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function deleteMachineRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const position = await ownedPosition(positionId);
  if (!position) return;
  await prisma.positionMachineItem.deleteMany({ where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } } });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function addMaterialRow(formData: FormData) {
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Material";
  const quantity = decimalText(formData.get("quantity"), "1");
  const unit = String(formData.get("unit") ?? "Stk.");
  const unitPriceCents = euroCents(formData.get("unitPriceEur"));

  if (!(await ownedPosition(positionId))) return;
  await prisma.positionMaterialItem.create({
    data: {
      positionId,
      title,
      quantity,
      unit,
      unitPriceCents,
    },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateMaterialRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const quantity = decimalText(formData.get("quantity"), "1");
  const unit = String(formData.get("unit") ?? "Stk.");
  const unitPriceCents = euroCents(formData.get("unitPriceEur"));

  const position = await ownedPosition(positionId);
  if (!position) return;
  await prisma.positionMaterialItem.updateMany({
    where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } },
    data: { title, quantity, unit, unitPriceCents },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function deleteMaterialRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const position = await ownedPosition(positionId);
  if (!position) return;
  await prisma.positionMaterialItem.deleteMany({ where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } } });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function addExternalRow(formData: FormData) {
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Fremdleistung";
  const amountCents = euroCents(formData.get("amountEur"));

  if (!(await ownedPosition(positionId))) return;
  await prisma.positionExternalServiceItem.create({
    data: {
      positionId,
      title,
      amountCents,
    },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function updateExternalRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const amountCents = euroCents(formData.get("amountEur"));

  const position = await ownedPosition(positionId);
  if (!position) return;
  await prisma.positionExternalServiceItem.updateMany({
    where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } },
    data: { title, amountCents },
  });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

export async function deleteExternalRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const positionId = String(formData.get("positionId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const position = await ownedPosition(positionId);
  if (!position) return;
  await prisma.positionExternalServiceItem.deleteMany({ where: { id, positionId, position: { project: { companyProfileId: position.project.companyProfileId } } } });
  revalidatePath(path(projectId, positionId));
  revalidatePath(`/app/projects/${projectId}`);
}

