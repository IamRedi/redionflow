/**
 * BDF-P1-005 — shared worker-credential verifier.
 *
 * Mirrors `authenticateAdminByCode` for the worker login flow so the
 * server action in `src/app/(workzone)/workzone/hr-actions.ts` (and any
 * future caller) cannot drift on the security-critical login policy.
 *
 * Rules:
 *   1. lookup is by `loginCode` (legacy read-only column) OR identity
 *      derivable from other fields — the worker login form still asks
 *      the operator to type the 6-digit code, so we look the worker up
 *      only after we know the code hashes match. To avoid enumerating
 *      by code, pre-auth lookup currently fetches all active workers globally and
 *      compares hashes. More than one matching account is ambiguous and
 *      refused; this remains O(n) across all active workers, not per tenant;
 *   2. any row whose `loginCodeHash` is NULL is treated as a **legacy
 *      plaintext** row and refused;
 *   3. otherwise the submitted `code` goes through scrypt via
 *      `verifyPassword`.
 *
 * The return value never contains the stored hash or the raw
 * `loginCode`.
 */

import { verifyPassword } from "@/lib/auth/password";
import type { PrismaClient } from "@/generated/prisma/client";

type WorkerRow = {
  id: string;
  firstName: string;
  lastName: string;
  loginCode: string | null;
  loginCodeHash: string | null;
  sessionEpoch: number;
};

type WorkerAuthClient = {
  worker: {
    findMany: (args: {
      where: { status: "active" };
      select: {
        id: true;
        firstName: true;
        lastName: true;
        loginCode: true;
        loginCodeHash: true;
        sessionEpoch: true;
      };
    }) => Promise<WorkerRow[]>;
  };
};

export type WorkerAuthResult =
  | { ok: true; worker: Pick<WorkerRow, "id" | "firstName" | "lastName" | "sessionEpoch"> }
  | { ok: false; reason: "not_found" | "legacy_plaintext" | "invalid_code" };

export async function authenticateWorkerByCode(
  prisma: Pick<PrismaClient, "worker"> | WorkerAuthClient,
  code: string,
): Promise<WorkerAuthResult> {
  if (typeof code !== "string" || code.length === 0) {
    return { ok: false, reason: "not_found" };
  }
  const client = prisma as WorkerAuthClient;
  const workers = await client.worker.findMany({
    where: { status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      loginCode: true,
      loginCodeHash: true,
      sessionEpoch: true,
    },
  });

  // No tenant identity exists yet. Never pick the first global hash match.
  let match: WorkerRow | undefined;
  for (const worker of workers) {
    if (worker.loginCodeHash && verifyPassword(code, worker.loginCodeHash)) {
      if (match) return { ok: false, reason: "invalid_code" };
      match = worker;
    }
  }
  if (match) {
    const { id, firstName, lastName, sessionEpoch } = match;
    return { ok: true, worker: { id, firstName, lastName, sessionEpoch } };
  }

  // Second pass: reveal whether the code exists as a legacy plaintext
  // row so the caller can surface a "reset required" hint instead of the
  // generic invalid-code message. This does not disclose *which* worker;
  // the caller returns a generic message anyway.
  for (const worker of workers) {
    if (
      !worker.loginCodeHash &&
      typeof worker.loginCode === "string" &&
      worker.loginCode.length > 0 &&
      worker.loginCode === code
    ) {
      return { ok: false, reason: "legacy_plaintext" };
    }
  }

  return { ok: false, reason: "invalid_code" };
}
