"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/authorization";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import type { ActionResult } from "@/lib/validation/action-result";

function normalizeCategory(value: string) {
  if (value === "PLATE") return "PLATE";
  if (value === "FENCE") return "FENCE";
  if (value === "OTHER") return "OTHER";
  return "SIGN";
}

export async function upsertSafetyCatalogItemAction(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) return;

  const companyId = String(formData.get("companyId") ?? "");
  const category = normalizeCategory(String(formData.get("category") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const totalQuantity = Math.max(0, Math.floor(Number(formData.get("totalQuantity") ?? 0) || 0));

  if (!companyId || !name) return;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== companyId) return;

  await prisma.companyInventoryCatalog.upsert({
    where: { companyProfileId_category: { companyProfileId: companyId, category: category as any } },
    create: {
      companyProfileId: companyId,
      category: category as any,
      name,
      totalQuantity,
      isActive: true,
    },
    update: {
      name,
      totalQuantity,
      isActive: true,
    },
  });

  revalidatePath("/app/admin");
  revalidatePath("/workzone");
  notifyRealtimeUpdate("safety.updated", ["safety-panel"]);
}

