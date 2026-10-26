import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
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
    }
  | {
      kind: "worker";
      workerId: string;
      companyId: string;
      preferredLanguage: AssistantLanguageCode;
      displayName: string;
    }
  | {
      kind: "anonymous";
      companyId: string;
      preferredLanguage: AssistantLanguageCode;
      displayName: string;
    };

export async function getRequesterContext(): Promise<RequesterContext> {
  const company = await getOrCreateDefaultCompany();
  const [admin, worker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (admin) {
    const fresh = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { id: true, preferredLanguage: true, name: true, email: true },
    });
    return {
      kind: "admin",
      adminId: admin.id,
      companyId: company.id,
      preferredLanguage: normalizeAssistantLanguage(fresh?.preferredLanguage),
      displayName: (fresh?.name ?? fresh?.email ?? "Admin").trim(),
    };
  }
  if (worker) {
    const fresh = await prisma.worker.findUnique({
      where: { id: worker.id },
      select: { id: true, preferredLanguage: true, companyProfileId: true, firstName: true, lastName: true },
    });
    return {
      kind: "worker",
      workerId: worker.id,
      companyId: fresh?.companyProfileId ?? company.id,
      preferredLanguage: normalizeAssistantLanguage(fresh?.preferredLanguage),
      displayName: `${fresh?.firstName ?? ""} ${fresh?.lastName ?? ""}`.trim() || "Worker",
    };
  }
  return { kind: "anonymous", companyId: company.id, preferredLanguage: "DE", displayName: "Gast" };
}
