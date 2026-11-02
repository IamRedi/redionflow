import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { logger } from "@/lib/observability/logger";
import { getCurrentWorker } from "@/lib/workzone/worker-session";

import { createKidrahtWorkspace, kidrahtBase, kidrahtLang, kidrahtLoginUrl, kidrahtRole } from "./platform";

/** True when the KiDraht button should show for this company. */
export async function kidrahtAvailable(companyId: string | null): Promise<boolean> {
  if (!companyId || !kidrahtBase()) return false;
  if (process.env.KIDRAHT_SETUP_TOKEN) return true;
  const c = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { kidrahtWorkspaceId: true, kidrahtApiKey: true } });
  return Boolean(c?.kidrahtWorkspaceId && c.kidrahtApiKey);
}

export type KidrahtLink = { url: string } | { error: "signed_out" | "off" | "unreachable" };

/**
 * Sign-in link to the company's KiDraht for whoever is signed in here.
 * Creates the company's KiDraht workspace on first use (with its base pack).
 */
export async function kidrahtLinkForCurrentPerson(): Promise<KidrahtLink> {
  const base = kidrahtBase();
  if (!base) return { error: "off" };
  const [admin, worker, companyId] = await Promise.all([getCurrentAdmin(), getCurrentWorker(), getCurrentCompanyId()]);
  if ((!admin && !worker) || !companyId) return { error: "signed_out" };

  let company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: { id: true, displayName: true, mode: true, country: true, kidrahtWorkspaceId: true, kidrahtApiKey: true },
  });
  if (!company) return { error: "signed_out" };

  if (!company.kidrahtWorkspaceId || !company.kidrahtApiKey) {
    const token = process.env.KIDRAHT_SETUP_TOKEN;
    if (!token) return { error: "off" };
    const owner = await prisma.user.findFirst({
      where: { companyProfileId: company.id, role: "ADMIN", isActive: true },
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
      select: { name: true, email: true, preferredLanguage: true },
    });
    const lang = kidrahtLang(owner?.preferredLanguage ?? (company.country === "AL" ? "SQ" : "DE"));
    try {
      const created = await createKidrahtWorkspace(base, token, company, (owner?.name || company.displayName).slice(0, 60), lang);
      if (!created) return { error: "unreachable" };
      // Only the first request links the company; a parallel one keeps what is already there.
      await prisma.companyProfile.updateMany({
        where: { id: company.id, kidrahtWorkspaceId: null },
        data: { kidrahtWorkspaceId: created.workspaceId, kidrahtApiKey: created.apiKey },
      });
      company = await prisma.companyProfile.findUnique({
        where: { id: company.id },
        select: { id: true, displayName: true, mode: true, country: true, kidrahtWorkspaceId: true, kidrahtApiKey: true },
      });
      logger.info({ event: "kidraht.workspace_created", companyId: company?.id, workspace: company?.kidrahtWorkspaceId }, "KiDraht workspace created");
    } catch (error) {
      logger.error({ event: "kidraht.workspace_create_failed", companyId }, "KiDraht workspace could not be created", error);
      return { error: "unreachable" };
    }
  }
  if (!company?.kidrahtWorkspaceId || !company.kidrahtApiKey) return { error: "unreachable" };

  const person = worker
    ? {
        ext: `w-${worker.id}`,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        role: kidrahtRole({ isAdmin: false, crewRole: worker.crewRole }),
        lang: kidrahtLang(worker.preferredLanguage),
      }
    : {
        ext: `a-${admin!.id}`,
        name: admin!.name || admin!.email.split("@")[0]!,
        role: kidrahtRole({ isAdmin: true }),
        lang: kidrahtLang(admin!.preferredLanguage),
      };
  return { url: kidrahtLoginUrl(base, company.kidrahtApiKey, { ws: company.kidrahtWorkspaceId, ...person, name: person.name.slice(0, 60) || "RediOnFlow" }) };
}
