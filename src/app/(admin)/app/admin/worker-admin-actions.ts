"use server";

import { regionConfig } from "@/lib/region";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeAssistantLanguage } from "@/lib/assistant/language";
import { isLoginCodeTaken, isValidLoginCode } from "@/lib/auth/login-code";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { WorkerAvailability, WorkerLevel } from "@/generated/prisma/enums";
import { readCrewRole } from "@/lib/workzone/crew-roles";
import { parseEnumInput } from "@/lib/validation/enum-input";

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
  if (loginCode && !isValidLoginCode(loginCode)) redirect("/app/admin?code=format");

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const owned = await prisma.worker.findUnique({ where: { id }, select: { companyProfileId: true } });
  if (!owned || owned.companyProfileId !== currentCompanyId) return;
  // Two workers with one code could not sign in at all; nothing is saved.
  if (loginCode && (await isLoginCodeTaken(prisma, loginCode, id))) redirect("/app/admin?code=taken");
  const company = await prisma.companyProfile.findUnique({ where: { id: currentCompanyId }, select: { country: true } });

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
      availability: parseEnumInput(formData.get("availability"), WorkerAvailability, WorkerAvailability.AVAILABLE),
      vacationAllowanceDays: cleanInt(formData.get("vacationAllowanceDays"), regionConfig(company?.country).defaultVacationDays),
      // Blank profile fields preserve both hashed and legacy credentials.
      ...(loginCode ? { loginCode: null, loginCodeHash: hashPassword(loginCode) } : {}),
      isTemporary: formData.get("isTemporary") === "on",
      birthDate: cleanDate(formData.get("birthDate")),
      startedAtCompany: cleanDate(formData.get("startedAtCompany")),
      level: parseEnumInput(formData.get("level"), WorkerLevel, WorkerLevel.JUNIOR),
      // Only forms that show the role send it; others must not clear it.
      ...(formData.has("crewRole") ? { crewRole: readCrewRole(formData.get("crewRole")) } : {}),
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
