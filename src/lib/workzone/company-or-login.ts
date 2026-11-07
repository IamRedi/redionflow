import { redirect } from "next/navigation";

import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { TenantUnauthorizedError } from "@/lib/db/tenant";

/**
 * Workzone pages: the caller's company, or the login screen when nobody is
 * signed in (new phone, expired or revoked session). Without this an
 * anonymous visit in SaaS mode ended in a 500 error page.
 */
export async function companyOrLogin() {
  try {
    return await getOrCreateDefaultCompany();
  } catch (error) {
    if (error instanceof TenantUnauthorizedError) redirect("/workzone/login");
    throw error;
  }
}
