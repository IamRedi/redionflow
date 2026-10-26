/**
 * BDF-P1-003 — durable login rate-limiter storage.
 *
 * The store is the single place where attempt buckets are persisted. Two
 * adapters ship with the codebase:
 *
 *   - `PostgresLoginAttemptStore` — production default. One row per
 *     `(scope, clientKey)` pair in the `LoginAttempt` table, cleaned up
 *     opportunistically at most once per 60 s per process.
 *   - `InMemoryLoginAttemptStore` — test-only. Selected via
 *     `LOGIN_ATTEMPT_STORE=memory`; every other value falls through to
 *     the Postgres adapter.
 *
 * The `LoginAttemptStore` interface is the seam that keeps the ADR-0001
 * decision reversible: swapping in a Redis adapter later requires no
 * caller changes.
 *
 * All fail-closed / retention semantics live here so `login-guard.ts`
 * stays a thin, easily-testable facade.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";

// ---------------------------------------------------------------------------
// Constants (kept in one place so unit tests can reason about them)
// ---------------------------------------------------------------------------

export const WINDOW_MS = 10 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = 60 * 1000;
export const RETENTION_MS = 24 * 60 * 60 * 1000;

export const LIMITS = {
  admin: 6,
  display: 6,
  worker: 8,
  // BDF-P1-002: first-boot admin setup attempts.
  firstBoot: 5,
  // BDF-P8-007: signup + assistant guardrails.
  //   - signup: enough headroom for a legit user retrying a typo but
  //     small enough that an enumeration attack against known-emails
  //     runs into the 15-minute lock after ~10 tries per IP.
  //   - assistant: high enough that a working chat conversation with
  //     tool calls (~one per prompt) doesn't lock the user out, but
  //     tight enough that a scripted bot hitting the OpenAI-cost path
  //     stops within a minute.
  signup: 10,
  assistant: 30,
} as const;

export type LoginScope = keyof typeof LIMITS;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type EnsureAllowedResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export type RegisterFailedResult = {
  attempts: number;
  retryAfterSeconds: number | null;
};

export interface LoginAttemptStore {
  ensureAllowed(scope: LoginScope, clientKey: string): Promise<EnsureAllowedResult>;
  registerFailed(scope: LoginScope, clientKey: string): Promise<RegisterFailedResult>;
  clear(scope: LoginScope, clientKey: string): Promise<void>;
  /** Delete rows past the retention window. Returns the row count removed. */
  cleanup(): Promise<{ removed: number }>;
}

// ---------------------------------------------------------------------------
// In-memory adapter (test-only)
// ---------------------------------------------------------------------------

type Bucket = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
  updatedAt: number;
};

export class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private readonly buckets = new Map<string, Bucket>();

  private key(scope: LoginScope, clientKey: string) {
    return `${scope}:${clientKey}`;
  }

  async ensureAllowed(scope: LoginScope, clientKey: string): Promise<EnsureAllowedResult> {
    const bucket = this.buckets.get(this.key(scope, clientKey));
    const now = Date.now();
    if (!bucket || !bucket.lockedUntil || bucket.lockedUntil <= now) return { ok: true };
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)),
    };
  }

  async registerFailed(
    scope: LoginScope,
    clientKey: string,
  ): Promise<RegisterFailedResult> {
    const now = Date.now();
    const key = this.key(scope, clientKey);
    const existing = this.buckets.get(key);
    let bucket: Bucket;
    if (!existing || existing.firstAttemptAt + WINDOW_MS < now) {
      bucket = { attempts: 1, firstAttemptAt: now, lockedUntil: null, updatedAt: now };
    } else {
      bucket = {
        ...existing,
        attempts: existing.attempts + 1,
        updatedAt: now,
      };
    }
    if (bucket.attempts >= LIMITS[scope]) {
      bucket.lockedUntil = now + LOCK_MS;
    }
    this.buckets.set(key, bucket);
    return {
      attempts: bucket.attempts,
      retryAfterSeconds: bucket.lockedUntil
        ? Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000))
        : null,
    };
  }

  async clear(scope: LoginScope, clientKey: string): Promise<void> {
    this.buckets.delete(this.key(scope, clientKey));
  }

  async cleanup(): Promise<{ removed: number }> {
    const cutoff = Date.now() - RETENTION_MS;
    let removed = 0;
    for (const [k, b] of this.buckets) {
      if (b.updatedAt < cutoff) {
        this.buckets.delete(k);
        removed++;
      }
    }
    return { removed };
  }

  /** Testing hook — wipe all state between suites. */
  __reset() {
    this.buckets.clear();
  }
}

// ---------------------------------------------------------------------------
// Postgres adapter (production default)
// ---------------------------------------------------------------------------

export class PostgresLoginAttemptStore implements LoginAttemptStore {
  private lastCleanupAt = 0;

  async ensureAllowed(scope: LoginScope, clientKey: string): Promise<EnsureAllowedResult> {
    const row = await prisma.loginAttempt.findUnique({
      where: { scope_clientKey: { scope, clientKey } },
      select: { lockedUntil: true },
    });
    if (!row || !row.lockedUntil) return { ok: true };
    const now = Date.now();
    const lockedUntilMs = row.lockedUntil.getTime();
    if (lockedUntilMs <= now) return { ok: true };
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((lockedUntilMs - now) / 1000)),
    };
  }

  async registerFailed(
    scope: LoginScope,
    clientKey: string,
  ): Promise<RegisterFailedResult> {
    // Opportunistic cleanup — at most once per CLEANUP_INTERVAL_MS per
    // process. This keeps the shared table bounded without incurring a
    // DELETE on every request.
    if (Date.now() - this.lastCleanupAt > CLEANUP_INTERVAL_MS) {
      this.lastCleanupAt = Date.now();
      // Fire-and-forget: cleanup failures never break login.
      this.cleanup().catch((error) => {
        logger.warn(
          { event: "auth.rate_limiter.cleanup_failed" },
          "opportunistic cleanup failed",
          error,
        );
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const existing = await tx.loginAttempt.findUnique({
        where: { scope_clientKey: { scope, clientKey } },
        select: {
          id: true,
          attempts: true,
          firstAttemptAt: true,
          lockedUntil: true,
        },
      });

      let attempts: number;
      let firstAttemptAt: Date;
      const nowMs = now.getTime();

      if (!existing || existing.firstAttemptAt.getTime() + WINDOW_MS < nowMs) {
        attempts = 1;
        firstAttemptAt = now;
      } else {
        attempts = existing.attempts + 1;
        firstAttemptAt = existing.firstAttemptAt;
      }

      const lockedUntil = attempts >= LIMITS[scope] ? new Date(nowMs + LOCK_MS) : null;

      const upserted = await tx.loginAttempt.upsert({
        where: { scope_clientKey: { scope, clientKey } },
        create: {
          scope,
          clientKey,
          attempts,
          firstAttemptAt,
          lockedUntil,
        },
        update: {
          attempts,
          firstAttemptAt,
          lockedUntil,
        },
        select: { attempts: true, lockedUntil: true },
      });

      return upserted;
    });

    const retryAfterSeconds = result.lockedUntil
      ? Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000))
      : null;
    return { attempts: result.attempts, retryAfterSeconds };
  }

  async clear(scope: LoginScope, clientKey: string): Promise<void> {
    await prisma.loginAttempt.deleteMany({ where: { scope, clientKey } });
  }

  async cleanup(): Promise<{ removed: number }> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const { count } = await prisma.loginAttempt.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
    return { removed: count };
  }

  /** Testing hook — wipe every row. */
  async __reset() {
    await prisma.loginAttempt.deleteMany({});
    this.lastCleanupAt = 0;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let cached: LoginAttemptStore | null = null;

/**
 * Return the process-wide default store. `LOGIN_ATTEMPT_STORE=memory`
 * selects the in-memory adapter (unit tests); any other value falls
 * through to the Postgres adapter.
 */
export function getDefaultLoginAttemptStore(
  env: NodeJS.ProcessEnv = process.env,
): LoginAttemptStore {
  if (cached) return cached;
  const selection = env.LOGIN_ATTEMPT_STORE?.trim().toLowerCase();
  cached =
    selection === "memory"
      ? new InMemoryLoginAttemptStore()
      : new PostgresLoginAttemptStore();
  return cached;
}

/** Testing hook — drop the cached store so a subsequent call re-reads env. */
export function __resetDefaultLoginAttemptStore(): void {
  cached = null;
}
