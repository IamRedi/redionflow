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
  const match = text.match(/^\s*(hej|hi|hallo|hey|servus|moin|p[eë]rsh[eë]ndetje)[\s,]+([\p{L}][\p{L}'-]{1,60})\b/iu);
  return match ? match[2] : null;
}

export type AssistantIdentityResolution =
  | { status: 'found'; target: Exclude<AssistantIdentityTarget, null> }
  | { status: 'not_found' }
  | { status: 'ambiguous'; candidates: Array<{ type: 'worker' | 'admin'; displayName: string }> };

export async function resolveIdentityTargetResult(input: {
  companyId: string;
  addressedName: string | null;
}): Promise<AssistantIdentityResolution> {
  const name = (input.addressedName ?? "").trim();
  if (!name || !input.companyId) return { status: 'not_found' };
  const [workers, admins] = await Promise.all([
    prisma.worker.findMany({
      where: {
        companyProfileId: input.companyId,
        OR: [{ firstName: { equals: name, mode: 'insensitive' } }, { lastName: { equals: name, mode: 'insensitive' } }],
      },
      select: { id: true, firstName: true, lastName: true, aiPersonalityNote: true, preferredLanguage: true },
      orderBy: { id: 'asc' },
      take: 2,
    }),
    prisma.user.findMany({
      where: {
        companyProfileId: input.companyId,
        role: 'ADMIN',
        isActive: true,
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { name: { startsWith: `${name} `, mode: 'insensitive' } },
          { name: { endsWith: ` ${name}`, mode: 'insensitive' } },
          { email: { equals: name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, aiPersonalityNote: true, preferredLanguage: true },
      orderBy: { id: 'asc' },
      take: 2,
    }),
  ]);
  const matches: Exclude<AssistantIdentityTarget, null>[] = [
    ...workers.map(worker => ({
      type: "worker",
      workerId: worker.id,
      displayName: `${worker.firstName} ${worker.lastName}`.trim(),
      aiPersonalityNote: worker.aiPersonalityNote,
      preferredLanguage: normalizeAssistantLanguage(worker.preferredLanguage),
    } as const)),
    ...admins.map(admin => ({
      type: 'admin',
      adminId: admin.id,
      displayName: admin.name ?? 'Admin',
      aiPersonalityNote: admin.aiPersonalityNote,
      preferredLanguage: normalizeAssistantLanguage(admin.preferredLanguage),
    } as const)),
  ];
  if (!matches.length) return { status: 'not_found' };
  if (matches.length > 1) return { status: 'ambiguous', candidates: matches.map(({ type, displayName }) => ({ type, displayName })) };
  return { status: 'found', target: matches[0] };
}

export async function resolveIdentityTarget(input: { companyId: string; addressedName: string | null }): Promise<AssistantIdentityTarget> {
  const result = await resolveIdentityTargetResult(input);
  return result.status === 'found' ? result.target : null;
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
