import { cookies } from "next/headers";
import { prisma as identityLookupDb } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getCurrentAdmin } from "./admin-session";
import { isRlsEnforced } from "@/lib/db/tenant-context";
import { isSaasMode } from "@/lib/saas-config";
import { readSessionCookie } from "./session-cookie";

export function isRuntimePilotEnabled() {
  return isSaasMode && isRlsEnforced();
}

/** System identity lookup before tenant context exists; no tenant objects or hashes. */
export async function resolvePilotIdentity() {
  const jar = await cookies();
  const adminClaims = readSessionCookie(jar.get("bk_admin_id")?.value, "admin");
  const workerClaims = readSessionCookie(jar.get("bk_worker_id")?.value, "worker");
  const [admin, worker] = await Promise.all([
    adminClaims ? identityLookupDb.user.findFirst({
      where: { id: adminClaims.id, sessionEpoch: adminClaims.epoch, role: "ADMIN", isActive: true },
      select: { id: true, companyProfileId: true },
    }) : null,
    workerClaims ? identityLookupDb.worker.findFirst({
      where: { id: workerClaims.id, sessionEpoch: workerClaims.epoch, status: "active" },
      select: { id: true, companyProfileId: true },
    }) : null,
  ]);
  if (admin && worker) return null;
  const identity = admin ?? worker;
  if (!identity?.companyProfileId || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.companyProfileId)) return null;
  return { id: identity.id, companyProfileId: identity.companyProfileId, kind: admin ? "admin" as const : "worker" as const };
}

export async function getPilotCompanyId(): Promise<string | null> {
  if (!isRuntimePilotEnabled()) return getCurrentCompanyId();
  return (await resolvePilotIdentity())?.companyProfileId ?? null;
}

export async function getPilotAdmin() {
  if (!isRuntimePilotEnabled()) return getCurrentAdmin();
  const identity = await resolvePilotIdentity();
  return identity?.kind === "admin" ? identity : null;
}

export async function getPilotAdminCompanyId(): Promise<string | null> {
  if (!isRuntimePilotEnabled()) {
    const { getAdminCompanyId } = await import("./authorization");
    return getAdminCompanyId();
  }
  const identity = await resolvePilotIdentity();
  return identity?.kind === "admin" ? identity.companyProfileId : null;
}
