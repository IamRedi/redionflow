import { prisma } from "@/lib/db/prisma";
import { normalizeAssistantLanguage, type AssistantLanguageCode } from "./language";
import type { RequesterContext } from "./requester";

export type AssistantIdentityTarget =
  | {
      type: "worker";
      workerId: string;
      displayName: string;
      aiPersonalityNote: string | null;
      preferredLanguage: AssistantLanguageCode;
    }
  | {
      type: "admin";
      adminId: string;
      displayName: string;
      aiPersonalityNote: string | null;
      preferredLanguage: AssistantLanguageCode;
    }
  | null;

export function extractAddressedName(text: string): string | null {
  // Examples:
  // "Hej Andi, ..." -> Andi
  // "Hallo Gregor ..." -> Gregor
  // "Hej Redion ..." -> Redion (fuzzy-resolve may still map to "Redi")
  const comma = text.match(/\b(hej|hi|hallo|hey|servus|moin)\s*,\s*([A-Za-zÄÖÜäöüß]{2,})\b/i);
  if (comma) return comma[2];
  const match = text.match(/\b(hej|hi|hallo|hey|servus|moin)\s+([A-Za-zÄÖÜäöüß]{2,})\b/i);
  return match ? match[2] : null;
}

function prefixNameMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x.length < 3 || y.length < 3) return false;
  return x.startsWith(y) || y.startsWith(x);
}

export async function resolveIdentityTarget(input: {
  companyId: string;
  addressedName: string | null;
}): Promise<AssistantIdentityTarget> {
  const name = (input.addressedName ?? "").trim();
  if (!name) return null;

  const worker = await prisma.worker.findFirst({
    where: {
      companyProfileId: input.companyId,
      OR: [{ firstName: { equals: name, mode: "insensitive" } }, { lastName: { equals: name, mode: "insensitive" } }],
    },
    select: { id: true, firstName: true, lastName: true, aiPersonalityNote: true, preferredLanguage: true },
  });
  if (worker) {
    return {
      type: "worker",
      workerId: worker.id,
      displayName: `${worker.firstName} ${worker.lastName}`.trim(),
      aiPersonalityNote: worker.aiPersonalityNote,
      preferredLanguage: normalizeAssistantLanguage(worker.preferredLanguage),
    };
  }

  const candidates = await prisma.worker.findMany({
    where: { companyProfileId: input.companyId },
    select: { id: true, firstName: true, lastName: true, aiPersonalityNote: true, preferredLanguage: true },
    take: 80,
  });
  const fuzzy = candidates.find(
    (w) => prefixNameMatch(name, w.firstName) || prefixNameMatch(name, w.lastName),
  );
  if (fuzzy) {
    return {
      type: "worker",
      workerId: fuzzy.id,
      displayName: `${fuzzy.firstName} ${fuzzy.lastName}`.trim(),
      aiPersonalityNote: fuzzy.aiPersonalityNote,
      preferredLanguage: normalizeAssistantLanguage(fuzzy.preferredLanguage),
    };
  }

  const admin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
      isActive: true,
      OR: [{ name: { contains: name, mode: "insensitive" } }, { email: { startsWith: name, mode: "insensitive" } }],
    },
    select: { id: true, name: true, aiPersonalityNote: true, preferredLanguage: true },
  });
  if (!admin) return null;
  return {
    type: "admin",
    adminId: admin.id,
    displayName: admin.name ?? "Admin",
    aiPersonalityNote: admin.aiPersonalityNote,
    preferredLanguage: normalizeAssistantLanguage(admin.preferredLanguage),
  };
}

export type AssistantPrivacyPolicy = {
  canUseTargetPersona: boolean;
  allowSensitiveWorkerData: boolean; // hours, private notes, etc.
  allowSensitiveAdminData: boolean; // placeholder for future finance/admin-only data
};

export function getPrivacyPolicy(requester: RequesterContext, target: AssistantIdentityTarget): AssistantPrivacyPolicy {
  // Default: deny everything if not logged in.
  if (requester.kind === "anonymous") {
    return { canUseTargetPersona: false, allowSensitiveWorkerData: false, allowSensitiveAdminData: false };
  }

  // No explicit target -> generic assistant voice, but still respect requester scope.
  if (!target) {
    return {
      canUseTargetPersona: true,
      allowSensitiveWorkerData: requester.kind === "admin",
      allowSensitiveAdminData: requester.kind === "admin",
    };
  }

  // Admin addressing anyone: full transparency.
  if (requester.kind === "admin") {
    return { canUseTargetPersona: true, allowSensitiveWorkerData: true, allowSensitiveAdminData: true };
  }

  // Worker requester:
  if (target.type === "worker") {
    // Worker -> Worker: operational data allowed, sensitive personal data denied.
    return { canUseTargetPersona: true, allowSensitiveWorkerData: false, allowSensitiveAdminData: false };
  }

  // Worker -> Admin: allowed to adopt admin persona, but data must stay within worker scope.
  return { canUseTargetPersona: true, allowSensitiveWorkerData: false, allowSensitiveAdminData: false };
}

export function canImpersonateTarget(requester: RequesterContext, target: AssistantIdentityTarget): boolean {
  return getPrivacyPolicy(requester, target).canUseTargetPersona;
}
