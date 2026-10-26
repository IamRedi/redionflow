"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { DASHBOARD_SNAPSHOT_TAG } from "@/lib/dashboard/dashboard-snapshot";
import { requireAdminTenant } from "@/lib/auth/authorization";

export async function refreshDashboardSnapshotAction() {
  await requireAdminTenant();
  revalidateTag(DASHBOARD_SNAPSHOT_TAG, "max");
  revalidatePath("/app/dashboard");
}
