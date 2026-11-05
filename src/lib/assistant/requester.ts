import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { normalizeAssistantLanguage, type AssistantLanguageCode } from "./language";

export type RequesterContext =
  | {
      kind: "admin";
      adminId: string;
      companyId: string;
      preferredLanguage: AssistantLanguageCode;
      displayName: string;
      timeZone?: string;
    }
  | {
      kind: "worker";
      workerId: string;
      companyId: string;
      preferredLanguage: AssistantLanguageCode;
      displayName: string;
      timeZone?: string;
    }
  | {
      kind: "anonymous";
      companyId: string;
      preferredLanguage: AssistantLanguageCode;
      displayName: string;
      timeZone?: string;
    };

export async function getRequesterContext(): Promise<RequesterContext> {
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  const anonymous: RequesterContext = { kind: 'anonymous', companyId: '', preferredLanguage: 'DE', displayName: 'Gast' };
  // Resolve only an authenticated tenant; the assistant must never create a
  // default company or combine a role and another session's company.
  if ((!admin && !worker) || (admin && worker)) return anonymous;
  const companyId = await getCurrentCompanyId();
  if (!companyId) return anonymous;
  const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { country: true } });
  if (!company) return anonymous;
  const timeZone = fuelTimeZone(company.country);
  if (admin) {
    const fresh = await prisma.user.findFirst({
      where: { id: admin.id, companyProfileId: companyId, role: 'ADMIN', isActive: true },
      select: { id: true, companyProfileId: true, preferredLanguage: true, name: true, email: true },
    });
    if (!fresh || fresh.companyProfileId !== companyId) return anonymous;
    return {
      kind: "admin",
      adminId: admin.id,
      companyId,
      timeZone,
      preferredLanguage: normalizeAssistantLanguage(fresh?.preferredLanguage),
      displayName: (fresh?.name ?? fresh?.email ?? "Admin").trim(),
    };
  }
  if (worker) {
    const fresh = await prisma.worker.findFirst({
      where: { id: worker.id, companyProfileId: companyId, status: 'active' },
      select: { id: true, preferredLanguage: true, companyProfileId: true, firstName: true, lastName: true },
    });
    if (!fresh || fresh.companyProfileId !== companyId) return anonymous;
    return {
      kind: "worker",
      workerId: worker.id,
      companyId,
      timeZone,
      preferredLanguage: normalizeAssistantLanguage(fresh?.preferredLanguage),
      displayName: `${fresh?.firstName ?? ""} ${fresh?.lastName ?? ""}`.trim() || "Worker",
    };
  }
  return anonymous;
}
