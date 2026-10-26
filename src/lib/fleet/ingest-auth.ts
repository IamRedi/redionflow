import { timingSafeEqual } from "node:crypto";

import { isSaasMode } from "@/lib/saas-config";
import { prisma } from "@/lib/db/prisma";

/**
 * T-034 — Resolve the tenant that owns a fleet-GPS ingest request.
 *
 * Order:
 *   1. Per-tenant `FleetIngestToken` (SaaS-safe). Looks the token up in the
 *      DB and records `lastUsedAt` so admins can spot stale devices.
 *   2. Global `FLEET_GPS_INGEST_TOKEN` env fallback (dedicated only). A
 *      match here resolves to the single default company via
 *      `defaultCompanyId`. This exists so existing dedicated deployments do
 *      not break when they upgrade to T-034.
 *
 * Returns `null` on token mismatch. Callers should respond `401` in that
 * case without leaking which lookup failed.
 */
export async function resolveFleetIngestTenant(
  presentedToken: string,
  fallbackDefaultCompanyId?: string,
): Promise<{ companyProfileId: string } | null> {
  if (!presentedToken) return null;

  // Try per-tenant token first.
  const record = await prisma.fleetIngestToken.findFirst({
    where: { token: presentedToken, isActive: true },
    select: { id: true, companyProfileId: true },
  });
  if (record) {
    // Best-effort touch; skipping on failure keeps the ingest path fast.
    prisma.fleetIngestToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return { companyProfileId: record.companyProfileId };
  }

  // Fallback: env token for dedicated deployments.
  const envToken = process.env.FLEET_GPS_INGEST_TOKEN?.trim() ?? "";
  if (!isSaasMode && envToken && constantTimeEquals(presentedToken, envToken) && fallbackDefaultCompanyId) {
    return { companyProfileId: fallbackDefaultCompanyId };
  }

  return null;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
