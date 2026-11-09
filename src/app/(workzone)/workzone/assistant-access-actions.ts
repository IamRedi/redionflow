"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin, isOwnerAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";

/**
 * The boss turns the AI assistant on or off for one person. Any active admin
 * of the company may do it for workers; only the owner may do it for other
 * admins (the owner always has access). Nothing else on the person changes.
 */
export async function setWorkerAssistantAccessAction(formData: FormData): Promise<void> {
  const workerId = String(formData.get("workerId") ?? "");
  const enabled = formData.get("enabled") === "on";
  const [admin, companyId] = await Promise.all([getCurrentAdmin(), getCurrentCompanyId()]);
  if (!admin || !companyId || admin.companyProfileId !== companyId || !workerId) return;
  await prisma.worker.updateMany({ where: { id: workerId, companyProfileId: companyId }, data: { assistantAccess: enabled } });
  revalidatePath(`/workzone/admin-workers/${workerId}`);
  revalidatePath("/workzone", "layout");
}

export async function setAdminAssistantAccessAction(formData: FormData): Promise<void> {
  const adminId = String(formData.get("adminId") ?? "");
  const enabled = formData.get("enabled") === "on";
  const [admin, companyId] = await Promise.all([getCurrentAdmin(), getCurrentCompanyId()]);
  if (!admin || !companyId || admin.companyProfileId !== companyId || !isOwnerAdmin(admin) || !adminId || adminId === admin.id) return;
  await prisma.user.updateMany({ where: { id: adminId, companyProfileId: companyId, role: "ADMIN", isOwner: false }, data: { assistantAccess: enabled } });
  revalidatePath(`/workzone/admin-profile/${adminId}`);
  revalidatePath("/workzone", "layout");
}
