/**
 * BDF-P1-001: shared admin-credential verifier.
 *
 * Both the API route (`src/app/api/admin-login/route.ts`) and the server
 * action (`src/app/admin-login/actions.ts`) call this function so the two
 * surfaces cannot silently drift apart on the security-critical login
 * policy. The function does not touch cookies, redirects, or the login
 * rate-limiter — those remain each surface's responsibility.
 *
 * Rules enforced here:
 *   1. lookup is by identity only (`email`, `role: ADMIN`, `isActive: true`);
 *   2. any stored `passwordHash` that is not scrypt-formatted is treated as
 *      a legacy plaintext record and refused (`legacy_plaintext`);
 *   3. a null/empty stored hash is refused (`no_hash`);
 *   4. otherwise the caller-supplied `code` goes through scrypt via
 *      `verifyPassword`.
 *
 * The return value never contains the stored hash, the request body, or any
 * other value that could leak the credential shape to a caller.
 */

import { isLegacyPlaintextHash, verifyPassword } from "@/lib/auth/password";
import type { PrismaClient } from "@/generated/prisma/client";

type AdminUserSelection = { id: string; passwordHash: string | null; sessionEpoch: number };

type AdminAuthClient = {
  user: {
    findFirst: (args: {
      where: { email: string; role: "ADMIN"; isActive: true };
      select: { id: true; passwordHash: true; sessionEpoch: true };
    }) => Promise<AdminUserSelection | null>;
  };
};

export type AdminAuthResult =
  | { ok: true; adminId: string; sessionEpoch: number }
  | { ok: false; reason: "not_found" | "no_hash" | "legacy_plaintext" | "invalid_password" };

/**
 * Verify an admin's `code` against the stored scrypt hash. Returns a
 * discriminated result. Callers translate `reason` into their own outward
 * error shape; the two possible outward states are "invalid credentials"
 * (map `not_found`, `no_hash`, and `invalid_password` to the same message
 * to avoid enumeration) and "reset required" (map `legacy_plaintext`).
 */
export async function authenticateAdminByCode(
  prisma: Pick<PrismaClient, "user"> | AdminAuthClient,
  email: string,
  code: string,
): Promise<AdminAuthResult> {
  const client = prisma as AdminAuthClient;
  const admin = await client.user.findFirst({
    where: { email, role: "ADMIN", isActive: true },
    select: { id: true, passwordHash: true, sessionEpoch: true },
  });

  if (!admin) return { ok: false, reason: "not_found" };
  if (isLegacyPlaintextHash(admin.passwordHash)) {
    return { ok: false, reason: "legacy_plaintext" };
  }
  if (!admin.passwordHash) return { ok: false, reason: "no_hash" };
  if (!verifyPassword(code, admin.passwordHash)) {
    return { ok: false, reason: "invalid_password" };
  }
  return { ok: true, adminId: admin.id, sessionEpoch: admin.sessionEpoch };
}
