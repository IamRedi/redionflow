import { getCurrentAdmin } from "./admin-session";
import { getCurrentCompanyId } from "@/lib/db/tenant";

/** Admin authority and tenant identity must resolve from the same request. */
export async function getAdminCompanyId(): Promise<string | null> {
  const [admin, companyId] = await Promise.all([getCurrentAdmin(), getCurrentCompanyId()]);
  if (!admin || !companyId || (admin.companyProfileId && admin.companyProfileId !== companyId)) return null;
  return companyId;
}
export async function requireAdminTenant(): Promise<string> {
  const companyId = await getAdminCompanyId();
  if (!companyId) throw new Error("Access denied.");
  return companyId;
}
