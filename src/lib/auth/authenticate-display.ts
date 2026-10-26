/**
 * BDF-P1-005 — shared display-user credential verifier.
 *
 * Reuses the `User.passwordHash` column (display accounts already live
 * on `User { role: "STAFF" }`). Legacy plaintext rows (`passwordHash`
 * not prefixed `scrypt$`) are refused with a `legacy_plaintext` reason;
 * every write path is required to go through `hashPassword`.
 */

import { isLegacyPlaintextHash, verifyPassword } from "@/lib/auth/password";
import type { PrismaClient } from "@/generated/prisma/client";

type DisplayRow = { id: string; passwordHash: string | null; sessionEpoch: number };

type DisplayAuthClient = {
  user: {
    findFirst: (args: {
      where: { email: string; role: "STAFF"; isActive: true };
      select: { id: true; passwordHash: true; sessionEpoch: true };
    }) => Promise<DisplayRow | null>;
  };
};

export type DisplayAuthResult =
  | { ok: true; userId: string; sessionEpoch: number }
  | { ok: false; reason: "not_found" | "no_hash" | "legacy_plaintext" | "invalid_password" };

export async function authenticateDisplayByCode(
  prisma: Pick<PrismaClient, "user"> | DisplayAuthClient,
  email: string,
  code: string,
): Promise<DisplayAuthResult> {
  const client = prisma as DisplayAuthClient;
  const row = await client.user.findFirst({
    where: { email, role: "STAFF", isActive: true },
    select: { id: true, passwordHash: true, sessionEpoch: true },
  });

  if (!row) return { ok: false, reason: "not_found" };
  if (isLegacyPlaintextHash(row.passwordHash)) {
    return { ok: false, reason: "legacy_plaintext" };
  }
  if (!row.passwordHash) return { ok: false, reason: "no_hash" };
  if (!verifyPassword(code, row.passwordHash)) {
    return { ok: false, reason: "invalid_password" };
  }
  return { ok: true, userId: row.id, sessionEpoch: row.sessionEpoch };
}
