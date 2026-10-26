"use server";

import { revalidatePath } from "next/cache";

import { normalizeAssistantLanguage } from "@/lib/assistant/language";
import { recordAudit } from "@/lib/audit/log";
import { getCurrentAdmin, isOwnerAdmin } from "@/lib/auth/admin-session";
import { hashPassword } from "@/lib/auth/password";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { logger } from "@/lib/observability/logger";
import type { ActionResult } from "@/lib/validation/action-result";

function normalizeCode(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

export async function updateAdminProfileFormAction(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) return;

  const preferredLanguage = normalizeAssistantLanguage(formData.get("preferredLanguage"));
  const motherTongue = normalizeAssistantLanguage(formData.get("motherTongue"));
  const aiPersonalityNote = String(formData.get("aiPersonalityNote") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      name,
      preferredLanguage,
      motherTongue,
      aiPersonalityNote,
    },
  });

  revalidatePath("/app/profile");
  revalidatePath("/app/admin");
  revalidatePath("/workzone/assistant");
}

export async function upsertTestAdminFormAction(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin || !isOwnerAdmin(admin)) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = normalizeCode(formData.get("code"));
  const isActive = formData.get("isActive") === "on";
  const preferredLanguage = normalizeAssistantLanguage(formData.get("preferredLanguage"));
  const motherTongue = normalizeAssistantLanguage(formData.get("motherTongue"));

  if (!name || !email || code.length !== 6) return;

  // BDF-P1-001: the login code is a 6-digit shared PIN in local/demo mode.
  // Persist it only after scrypt-hashing so no plaintext credential is
  // ever written to `passwordHash`.
  const passwordHash = hashPassword(code);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, companyProfileId: true, role: true } });
  if (existing && (existing.companyProfileId !== currentCompanyId || existing.role !== "ADMIN")) return;
  const data = { name, passwordHash, isActive, preferredLanguage, motherTongue, role: "ADMIN" as const };
  if (existing) {
    await prisma.user.updateMany({ where: { id: existing.id, companyProfileId: currentCompanyId, role: "ADMIN" }, data });
  } else {
    // A concurrent signup with this email must never turn create into foreign UPDATE.
    try { await prisma.user.create({ data: { ...data, email, companyProfileId: currentCompanyId } }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      return;
    }
  }

  revalidatePath("/app/profile");
  revalidatePath("/workzone");
  revalidatePath("/admin-login");
}

export async function updateManagedTestAdminFormAction(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin || !isOwnerAdmin(admin)) return;

  const adminId = String(formData.get("adminId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = normalizeCode(formData.get("code"));
  const isActive = formData.get("isActive") === "on";
  const preferredLanguage = normalizeAssistantLanguage(formData.get("preferredLanguage"));
  const motherTongue = normalizeAssistantLanguage(formData.get("motherTongue"));

  if (!adminId || !name || !email || code.length !== 6) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;

  const existing = await prisma.user.findFirst({
    where: { id: adminId, role: "ADMIN" },
    select: { id: true, email: true, companyProfileId: true, isOwner: true },
  });
  if (!existing || isOwnerAdmin(existing)) return;
  // Cross-tenant guard: the owner may only edit admins in their own tenant.
  if (existing.companyProfileId !== currentCompanyId) return;

  await prisma.user.update({
    where: { id: adminId },
    data: {
      name,
      email,
      passwordHash: hashPassword(code),
      isActive,
      preferredLanguage,
      motherTongue,
      role: "ADMIN",
    },
  });

  revalidatePath("/app/profile");
  revalidatePath(`/workzone/admin-profile/${adminId}`);
  revalidatePath("/workzone");
  revalidatePath("/admin-login");
}

export async function removeManagedTestAdminAction(adminId: string): Promise<ActionResult> {
  const lang = await resolveRequestLanguage();
  const message = (key: string) => t(`admin.${key}`, lang);
  const admin = await getCurrentAdmin();
  if (!admin || !isOwnerAdmin(admin)) {
    return { ok: false, message: message("onlyPrimaryAdminCanRemoveAdmin") };
  }

  const targetId = String(adminId ?? "").trim();
  if (!targetId || targetId === admin.id) {
    return { ok: false, message: message("adminCannotBeRemoved") };
  }

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: message("notSignedIn") };

  const existing = await prisma.user.findFirst({
    where: { id: targetId, role: "ADMIN" },
    select: { id: true, email: true, companyProfileId: true, isOwner: true },
  });
  if (!existing || isOwnerAdmin(existing)) {
    return { ok: false, message: message("adminCannotBeRemoved") };
  }
  if (existing.companyProfileId !== currentCompanyId) {
    return { ok: false, message: message("adminCannotBeRemoved") };
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
  });

  // T-033: audit admin access changes.
  await recordAudit({
    companyProfileId: currentCompanyId,
    actorType: "ADMIN",
    actorId: admin.id,
    action: "admin.removed",
    payload: { removedUserId: targetId, removedEmail: existing.email },
  }).catch((error) => {
    logger.error({ event: "profile.remove_admin.audit_failed", removedUserId: targetId }, "audit failed", error);
  });

  revalidatePath("/app/profile");
  revalidatePath(`/workzone/admin-profile/${targetId}`);
  revalidatePath("/workzone");
  revalidatePath("/admin-login");

  return { ok: true, message: message("adminAccessRemoved") };
}
