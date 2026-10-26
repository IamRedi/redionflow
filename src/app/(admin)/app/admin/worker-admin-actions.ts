"use server";

import { revalidatePath } from "next/cache";

import { normalizeAssistantLanguage } from "@/lib/assistant/language";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeLoginCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? new Date(`${text}T00:00:00`) : null;
}

function cleanInt(value: FormDataEntryValue | null, fallback: number) {
  const next = Math.floor(Number(value ?? fallback));
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

export async function updateWorkerAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const loginCode = normalizeLoginCode(formData.get("loginCode"));
  if (!id || !firstName || !lastName) return;
  if (loginCode && !/^\d{6}$/.test(loginCode)) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const owned = await prisma.worker.findUnique({ where: { id }, select: { companyProfileId: true } });
  if (!owned || owned.companyProfileId !== currentCompanyId) return;

  await prisma.worker.update({
    where: { id },
    data: {
      firstName,
      lastName,
      phone: cleanText(formData.get("phone")),
      emailAccount: cleanText(formData.get("emailAccount")),
      position: cleanText(formData.get("position")),
      licenses: cleanText(formData.get("licenses")),
      status: formData.get("status") === "inactive" ? "inactive" : "active",
      availability: String(formData.get("availability") ?? "AVAILABLE") as any,
      vacationAllowanceDays: cleanInt(formData.get("vacationAllowanceDays"), 26),
      // Blank profile fields preserve both hashed and legacy credentials.
      ...(loginCode ? { loginCode: null, loginCodeHash: hashPassword(loginCode) } : {}),
      isTemporary: formData.get("isTemporary") === "on",
      birthDate: cleanDate(formData.get("birthDate")),
      startedAtCompany: cleanDate(formData.get("startedAtCompany")),
      level: String(formData.get("level") ?? "JUNIOR") as any,
      preferredLanguage: normalizeAssistantLanguage(formData.get("preferredLanguage")),
      motherTongue: normalizeAssistantLanguage(formData.get("motherTongue")),
    },
  });

  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/workers/${id}`);
  revalidatePath("/workzone");
  revalidatePath(`/workzone/admin-workers/${id}`);
}

export async function deleteWorkerAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const owned = await prisma.worker.findUnique({ where: { id }, select: { companyProfileId: true } });
  if (!owned || owned.companyProfileId !== currentCompanyId) return;

  await prisma.worker.delete({ where: { id } });
  revalidatePath("/app/admin");
  revalidatePath("/workzone");
}

/** Explicit credential revocation, separately authorized from profile edits. */
export async function revokeWorkerLoginCredentialAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const companyProfileId = await getCurrentCompanyId();
  if (!id || !companyProfileId) return;
  await prisma.worker.updateMany({
    where: { id, companyProfileId },
    data: { loginCode: null, loginCodeHash: null, sessionEpoch: { increment: 1 } },
  });
  revalidatePath("/app/admin");
  revalidatePath(`/app/admin/workers/${id}`);
  revalidatePath("/workzone");
  revalidatePath(`/workzone/admin-workers/${id}`);
}
