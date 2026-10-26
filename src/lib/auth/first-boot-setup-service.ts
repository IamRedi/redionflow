/**
 * BDF-P1-002: safe first-boot administrator setup — DB service layer.
 *
 * `performFirstBootSetup` is the single mutating entrypoint. It composes:
 *
 *   1. server-side gate check (`readFirstBootSetupConfig`);
 *   2. constant-time comparison of the submitted token;
 *   3. input validation (email + password + confirmation + no-legacy-PIN);
 *   4. a PostgreSQL advisory-lock transaction that (a) verifies no
 *      administrator identity row exists, (b) inserts the new admin,
 *      (c) is serialised so two concurrent valid requests cannot both
 *      succeed.
 *
 * Discriminated result:
 *   { ok: true, adminId }
 *   { ok: false, reason: … }
 *
 * The caller (server action) maps every non-OK reason to the same generic
 * outward response and only differentiates internally for the rate limiter
 * and operational logs. The token is never returned in the result.
 */

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

import {
  readFirstBootSetupConfig,
  validateFirstBootInput,
  verifyToken,
} from "@/lib/auth/first-boot-setup";

// A fixed 64-bit identifier for the advisory lock. Random-but-constant; the
// exact value does not matter as long as this file is the only lock user.
const FIRST_BOOT_ADVISORY_LOCK_ID = 4210020n;

export type FirstBootSetupResult =
  | { ok: true; adminId: string; sessionEpoch: number }
  | {
      ok: false;
      reason:
        | "setup_disabled"
        | "invalid_token"
        | "invalid_input"
        | "admin_exists"
        | "database_error";
    };

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function hasBlockingAdminInsideTx(tx: PrismaTx): Promise<boolean> {
  const existing = await tx.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Perform the setup. See module docstring for guarantees.
 *
 * @param input.token           — token submitted in the POST body
 * @param input.email           — proposed administrator email
 * @param input.password        — proposed administrator password (plaintext,
 *                                 hashed with scrypt before persistence)
 * @param input.confirmation    — password confirmation
 * @param env                   — process env override for unit testing
 */
export async function performFirstBootSetup(
  input: {
    token: unknown;
    email: unknown;
    password: unknown;
    confirmation: unknown;
    name?: unknown;
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<FirstBootSetupResult> {
  const config = readFirstBootSetupConfig(env);
  if (!config.enabled) return { ok: false, reason: "setup_disabled" };

  if (!verifyToken(input.token, config.token)) {
    return { ok: false, reason: "invalid_token" };
  }

  const validated = validateFirstBootInput(input);
  if (!validated.ok) return { ok: false, reason: "invalid_input" };

  const passwordHash = hashPassword(validated.password);
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) || null : null;

  try {
    return await prisma.$transaction(async (tx) => {
      // Serialise concurrent first-boot attempts. `pg_advisory_xact_lock`
      // blocks until we hold the lock; the transaction commits/rolls back
      // it automatically. Two concurrent valid requests race here — the
      // second one waits for the first to commit, then finds the admin
      // that the first created and returns `admin_exists`.
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${FIRST_BOOT_ADVISORY_LOCK_ID})`,
      );

      if (await hasBlockingAdminInsideTx(tx)) {
        return { ok: false, reason: "admin_exists" } as const;
      }

      const created = await tx.user.create({
        data: {
          email: validated.email,
          name,
          role: "ADMIN",
          passwordHash,
          isActive: true,
        },
        select: { id: true, sessionEpoch: true },
      });

      return { ok: true, adminId: created.id, sessionEpoch: created.sessionEpoch } as const;
    });
  } catch (error) {
    // Do NOT include the token or credentials in the error log.
    console.error("[first-boot-setup] transaction failed", error);
    return { ok: false, reason: "database_error" };
  }
}

/**
 * Public helper: is any administrator identity already present in the DB?
 * Used by the `/first-boot` GET handler to decide whether to show the form
 * or return a non-disclosing 404, and by the server action to short-circuit
 * before running the more expensive token validation. Independent of the
 * env gate.
 */
export async function hasBlockingAdmin(): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  return existing !== null;
}
