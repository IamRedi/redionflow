"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { countVacationWorkdays, parseVacationDate } from "@/lib/workzone/vacation";
import type { ActionResult } from "@/lib/validation/action-result";

function intValue(value: FormDataEntryValue | null, fallback = 0) {
  const next = Math.floor(Number(value ?? fallback));
  return Number.isFinite(next) ? next : fallback;
}

async function workerRequestOwner(workerId: string) {
  const currentWorker = await getCurrentWorker();
  if (!currentWorker || currentWorker.id !== workerId || currentWorker.status !== "active") return null;
  return currentWorker;
}

export async function requestVacationAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  const worker = await workerRequestOwner(workerId);
  if (!worker) return { ok: false, message: tr("accessDenied") };

  const startDate = parseVacationDate(formData.get("startDate"));
  const endDate = parseVacationDate(formData.get("endDate"));
  if (!startDate || !endDate) return { ok: false, message: tr("invalidDate") };
  if (endDate.getTime() < startDate.getTime()) return { ok: false, message: tr("vacationEndBeforeStart") };

  const maxWorkdays = countVacationWorkdays(startDate, endDate);
  if (maxWorkdays <= 0) return { ok: false, message: tr("vacationNoWorkdays") };

  const requestedDaysRaw = intValue(formData.get("requestedDays"), maxWorkdays);
  const requestedDays = Math.max(1, Math.min(maxWorkdays, requestedDaysRaw));
  const workerNote = String(formData.get("workerNote") ?? "").trim() || null;

  await prisma.vacationRequest.create({
    data: {
      companyProfileId: worker.companyProfileId,
      workerId: worker.id,
      startDate,
      endDate,
      requestedDays,
      workerNote,
    },
  });

  revalidatePath("/workzone/profile");
  revalidatePath("/workzone");
  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/workers/${worker.id}`);
  notifyRealtimeUpdate("vacation.updated", ["worker-strip"]);
  return { ok: true, message: tr("vacationRequestSent") };
}

export async function approveVacationRequestAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: tr("adminOnly") };
  const requestId = String(formData.get("requestId") ?? "");
  const adminMessage = String(formData.get("adminMessage") ?? "").trim() || null;

  const request = await prisma.vacationRequest.findUnique({
    where: { id: requestId },
    include: { worker: true },
  });
  const currentCompanyId = await getCurrentCompanyId();
  if (!request || !currentCompanyId || request.companyProfileId !== currentCompanyId) return { ok: false, message: tr("requestNotFound") };
  if (request.status !== "PENDING") return { ok: false, message: tr("requestAlreadyReviewed") };

  const approvedAlready = await prisma.vacationRequest.aggregate({
    where: { workerId: request.workerId, status: "APPROVED" },
    _sum: { requestedDays: true },
  });
  const used = approvedAlready._sum.requestedDays ?? 0;
  const remaining = Math.max(0, request.worker.vacationAllowanceDays - used);
  if (request.requestedDays > remaining) return { ok: false, message: tr("vacationNotEnoughDays", { remaining }) };

  await prisma.vacationRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByAdminId: admin.id,
      adminMessage,
    },
  });

  revalidatePath("/workzone");
  revalidatePath("/workzone/profile");
  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/workers/${request.workerId}`);
  notifyRealtimeUpdate("vacation.updated", ["worker-strip"]);
  return { ok: true, message: tr("vacationApproved") };
}

export async function rejectVacationRequestAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: tr("adminOnly") };
  const requestId = String(formData.get("requestId") ?? "");
  const adminMessage = String(formData.get("adminMessage") ?? "").trim() || null;

  const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  const currentCompanyId = await getCurrentCompanyId();
  if (!request || !currentCompanyId || request.companyProfileId !== currentCompanyId) return { ok: false, message: tr("requestNotFound") };
  if (request.status !== "PENDING") return { ok: false, message: tr("requestAlreadyReviewed") };

  await prisma.vacationRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByAdminId: admin.id,
      adminMessage,
    },
  });

  revalidatePath("/workzone");
  revalidatePath("/workzone/profile");
  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/workers/${request.workerId}`);
  notifyRealtimeUpdate("vacation.updated", ["worker-strip"]);
  return { ok: true, message: tr("vacationRejected") };
}
