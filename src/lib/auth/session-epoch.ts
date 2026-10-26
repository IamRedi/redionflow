/**
 * BDF-P8-007 Phase 1 — session revocation helpers.
 *
 * This module is the single seam through which the codebase reads
 * and rotates the session epoch on `User` (admin) and `Worker`
 * (Workzone) records. The column landed in migration
 * `20260730000000_add_session_epoch` with a default of 0 so every
 * existing session cookie continues to work — the cookie carries no
 * epoch yet, and the enforcement guard (Phase 2) reads a missing
 * epoch as 0, which matches the row default.
 *
 * The helpers exposed here are safe to call today; nothing in the
 * production flows invokes them yet. Phase 2 will:
 *   1. embed the current epoch inside the session cookie payload;
 *   2. call `getUserSessionEpoch` / `getWorkerSessionEpoch` on every
 *      request and reject cookies whose epoch is lower than the DB;
 *   3. call `revokeUserSessions` on password change / admin removal
 *      and `revokeWorkerSessions` on login-code rotation / "log out
 *      everywhere" actions from the admin worker card.
 *
 * Design notes
 * ------------
 *
 * - Rotation is an atomic `sessionEpoch + 1` update, not a wallclock
 *   timestamp. Clock skew across replicas cannot desynchronise it.
 * - The API returns the *new* epoch so a caller that immediately
 *   mints a fresh cookie can embed the up-to-date value without a
 *   second read. This closes the race where a rotator's own new
 *   session would be revoked by the very rotation that produced it.
 * - Nothing here mutates cookies; that's the caller's responsibility
 *   in Phase 2.
 */

import type { PrismaClient } from "@/generated/prisma/client";

export type PrismaTx = Pick<PrismaClient, "user" | "worker">;

/**
 * Read the current session epoch for an admin/staff user. Returns
 * `null` when the row doesn't exist (deleted account, or an
 * attacker-forged id), which the enforcement guard treats as a
 * blanket rejection.
 */
export async function getUserSessionEpoch(prisma: PrismaTx, userId: string): Promise<number | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionEpoch: true },
  });
  return row ? row.sessionEpoch : null;
}

/** Read the current session epoch for a Workzone worker. */
export async function getWorkerSessionEpoch(prisma: PrismaTx, workerId: string): Promise<number | null> {
  const row = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { sessionEpoch: true },
  });
  return row ? row.sessionEpoch : null;
}

/**
 * Bump the user's session epoch by one, atomically. Returns the new
 * epoch so the caller can mint a fresh cookie carrying it. Used by:
 *   - password rotation / reset flow
 *   - admin removal (defence-in-depth: the row still exists briefly)
 *   - explicit "sign out everywhere" UI
 */
export async function revokeUserSessions(prisma: PrismaTx, userId: string): Promise<number | null> {
  try {
    const row = await prisma.user.update({
      where: { id: userId },
      data: { sessionEpoch: { increment: 1 } },
      select: { sessionEpoch: true },
    });
    return row.sessionEpoch;
  } catch {
    // Row no longer exists — nothing to revoke. Callers already
    // handle a null return.
    return null;
  }
}

/** Same as `revokeUserSessions`, scoped to a Workzone worker record. */
export async function revokeWorkerSessions(prisma: PrismaTx, workerId: string): Promise<number | null> {
  try {
    const row = await prisma.worker.update({
      where: { id: workerId },
      data: { sessionEpoch: { increment: 1 } },
      select: { sessionEpoch: true },
    });
    return row.sessionEpoch;
  } catch {
    return null;
  }
}

/**
 * Match the epoch embedded in a session cookie against the current
 * DB value. Missing cookie epoch is treated as 0 so cookies minted
 * before Phase 2 continue to validate. This is the exact predicate
 * the Phase 2 guard will use inside `getCurrentAdmin` /
 * `getCurrentWorker`.
 */
export function isEpochStillValid(cookieEpoch: number | null | undefined, dbEpoch: number | null): boolean {
  if (dbEpoch === null) return false;
  const claimed = typeof cookieEpoch === "number" && Number.isFinite(cookieEpoch) ? cookieEpoch : 0;
  return claimed >= dbEpoch;
}
