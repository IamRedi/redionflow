import { readSessionCookie } from "@/lib/auth/session-cookie";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { logger } from "@/lib/observability/logger";
import {
  describeDemoAdminBootstrapGate,
  resolveDemoAdminBootstrap,
} from "@/lib/auth/demo-admin-bootstrap";

export const ADMIN_COOKIE = "bk_admin_id";

let bootstrapWarningLogged = false;

/**
 * BDF-P1-001: strictly gated demo/local admin bootstrap.
 *
 * Previously this function seeded three admins with hard-coded 6-digit
 * PINs written verbatim into `passwordHash`. Those literals have been
 * removed; there is no plaintext fallback of any kind and no silently
 * generated password.
 *
 * A demo admin is now only created when `resolveDemoAdminBootstrap`
 * returns credentials (see that helper for the exact gate). In every
 * other environment this function is a safe no-op that logs a single
 * operational warning once so operators can tell the bootstrap did not
 * run. Production and SaaS modes never trigger a bootstrap.
 */
export async function ensureDefaultAdmins() {
  const bootstrap = resolveDemoAdminBootstrap();
  if (!bootstrap) {
    if (!bootstrapWarningLogged) {
      bootstrapWarningLogged = true;
      logger.info(
        { event: "auth.demo_bootstrap_skipped", reason: describeDemoAdminBootstrapGate() },
        "demo admin bootstrap skipped; use BDF-P1-002 first-boot flow to create the first admin",
      );
    }
    return;
  }

  try {
    const passwordHash = hashPassword(bootstrap.password);

    // Link the demo admin to the first-created company on dedicated
    // deployments so tenancy resolution works out of the box.
    const defaultCompanyId = (
      await prisma.companyProfile.findFirst({
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })
    )?.id;

    await prisma.user.upsert({
      where: { email: bootstrap.email },
      update: {
        role: "ADMIN",
        isOwner: true,
        passwordHash,
        isActive: true,
        ...(defaultCompanyId ? { companyProfileId: defaultCompanyId } : {}),
      },
      create: {
        email: bootstrap.email,
        name: "Demo Admin",
        role: "ADMIN",
        isOwner: true,
        passwordHash,
        isActive: true,
        ...(defaultCompanyId ? { companyProfileId: defaultCompanyId } : {}),
      },
    });

  } catch (error) {
    logger.error({ event: "auth.ensure_default_admins_failed" }, "ensureDefaultAdmins failed", error);
    throw error;
  }
}

export async function getCurrentAdmin() {
  const jar = await cookies();
  const claims = readSessionCookie(jar.get(ADMIN_COOKIE)?.value, "admin");
  if (!claims) return null;

  try {
    return await prisma.user.findFirst({
      where: {
        id: claims.id,
        sessionEpoch: claims.epoch,
        role: "ADMIN",
        isActive: true,
      },
    });
  } catch (error) {
    logger.error({ event: "auth.get_current_admin_failed" }, "getCurrentAdmin failed", error);
    return null;
  }
}

/** Only the company owner may manage the other admins. */
export function isOwnerAdmin(user: { isOwner: boolean } | null | undefined): boolean {
  return Boolean(user?.isOwner);
}

