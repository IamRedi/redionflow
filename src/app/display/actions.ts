"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { DASHBOARD_SNAPSHOT_TAG } from "@/lib/dashboard/dashboard-snapshot";
import { getAdminCompanyId } from "@/lib/auth/authorization";
import { getCurrentDisplayUser } from "@/lib/auth/display-session";
import { isSaasMode } from "@/lib/saas-config";

export async function refreshDisplayViewsAction() {
  if (isSaasMode) {
    const [adminCompany, display] = await Promise.all([getAdminCompanyId(), getCurrentDisplayUser()]);
    if (!adminCompany && !display?.companyProfileId) throw new Error("Access denied.");
  }
  revalidateTag(DASHBOARD_SNAPSHOT_TAG, "max");
  revalidatePath("/display/dashboard");
  revalidatePath("/display/workzone");
}
