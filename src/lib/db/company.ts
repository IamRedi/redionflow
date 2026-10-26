import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { TenantUnauthorizedError } from "@/lib/db/tenant";
import { getPilotCompanyId, isRuntimePilotEnabled } from "@/lib/auth/pilot-session";
import { withPilotDbContext } from "./tenant-runtime";
import { resolveMode, type CompanyMode } from "@/lib/mode-config";
import { isSaasMode } from "@/lib/saas-config";

const companyProfileSelect = {
  id: true,
  legalName: true,
  displayName: true,
  vatId: true,
  phone: true,
  email: true,
  street: true,
  zip: true,
  city: true,
  createdAt: true,
  updatedAt: true,
  overheadSettings: true,
} as const;

function withGpsDefaults<T extends object>(company: T) {
  return {
    ...company,
    fleetGpsEnabled: false,
    workerPhoneGpsEnabled: false,
  };
}

/**
 * Returns the mode of the caller's tenant company.
 *
 * SaaS (multi-tenant): resolves the tenant of the current worker/admin
 * session via `getCurrentCompanyId` and reads that company's mode.
 * Dedicated (single-tenant): falls back to the first-created company when
 * no session is present or the tenant is not yet linked.
 *
 * Never throws — falls back to `baumdienst` if the DB or session lookup fails.
 */
export async function getCompanyMode(): Promise<CompanyMode> {
  try {
    const currentCompanyId = await getPilotCompanyId();
    if (currentCompanyId) {
      const company = await withPilotDbContext(currentCompanyId, tx => tx.companyProfile.findUnique({
        where: { id: currentCompanyId },
        select: { mode: true },
      }));
      if (company) return resolveMode(company.mode);
    }
    if (isSaasMode) return "baumdienst";
    const company = await prisma.companyProfile.findFirst({
      select: { mode: true },
      orderBy: { createdAt: "asc" },
    });
    return resolveMode(company?.mode);
  } catch (error) {
    if (isRuntimePilotEnabled()) throw error;
    return "baumdienst";
  }
}

function isCompanyGpsSchemaMissing(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2022";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("CompanyProfile.fleetGpsEnabled") || message.includes("CompanyProfile.workerPhoneGpsEnabled");
}

/**
 * Resolve the caller's company:
 * - Multi-tenant SaaS: the tenant of the current session (via `getCurrentCompanyId`).
 * - Dedicated (single-tenant): the first-created company.
 * - Empty DB: creates a default seed company and returns it.
 *
 * Callers that need to *always* return the seed default (migrations,
 * seeds, admin scripts) should not use this helper — query CompanyProfile
 * directly instead.
 */
export async function getOrCreateDefaultCompany() {
  const currentCompanyId = await getPilotCompanyId();
  if (isSaasMode && !currentCompanyId) {
    throw new TenantUnauthorizedError();
  }
  if (isRuntimePilotEnabled() && currentCompanyId) {
    return withPilotDbContext(currentCompanyId, tx => tx.companyProfile.findUniqueOrThrow({
      where: { id: currentCompanyId }, include: { overheadSettings: true },
    })); // READ only: missing tenant never creates a replacement company.
  }
  try {
    const existing = currentCompanyId
      ? await prisma.companyProfile.findUnique({
          where: { id: currentCompanyId },
          include: { overheadSettings: true },
        })
      : await prisma.companyProfile.findFirst({
          include: { overheadSettings: true },
          orderBy: { createdAt: "asc" },
        });

    if (existing) return existing;
  } catch (error) {
    if (!isCompanyGpsSchemaMissing(error)) throw error;
    const legacyExisting = currentCompanyId
      ? await prisma.companyProfile.findUnique({
          where: { id: currentCompanyId },
          select: companyProfileSelect,
        })
      : await prisma.companyProfile.findFirst({
          select: companyProfileSelect,
          orderBy: { createdAt: "asc" },
        });

    if (legacyExisting) return withGpsDefaults(legacyExisting);
  }

  const created = await prisma.companyProfile.create({
    data: {
      legalName: "Baumdienst Flow",
      displayName: "Baumdienst Flow",
      email: "office@example.local",
      street: "Straße 1",
      zip: "10115",
      city: "Berlin",
      overheadSettings: {
        create: {
          bgkPct: 0.18,
          agkPct: 0.1,
          riskPct: 0.03,
          profitPct: 0.06,
          vatPct: 0.19,
          bgkBase: "EK_TOTAL",
          riskProfitMode: "SEPARATE",
          applyVatByDefault: true,
        },
      },
    },
    select: companyProfileSelect,
  });
  return withGpsDefaults(created);
}
