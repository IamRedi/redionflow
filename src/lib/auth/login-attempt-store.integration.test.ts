/**
 * BDF-P1-003 integration coverage — durable login rate limiter against a
 * live disposable Postgres. Run via `npm run test:integration:local`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  LIMITS,
  PostgresLoginAttemptStore,
  RETENTION_MS,
  WINDOW_MS,
} from "@/lib/auth/login-attempt-store";
import { prisma } from "@/lib/db/prisma";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run this suite via `npm run test:integration:local`.",
  );
}

async function resetTable() {
  await prisma.loginAttempt.deleteMany({});
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await resetTable();
});

beforeEach(async () => {
  await resetTable();
});

describe("PostgresLoginAttemptStore (real DB)", () => {
  it("persists a bucket across store instances (simulates process restart / second replica)", async () => {
    const instanceA = new PostgresLoginAttemptStore();
    for (let i = 0; i < LIMITS.admin; i++) {
      await instanceA.registerFailed("admin", "clientA");
    }
    const check = await instanceA.ensureAllowed("admin", "clientA");
    expect(check.ok).toBe(false);

    // A fresh store instance (as if a new Node process or a second replica
    // handled the next request) sees the same locked bucket.
    const instanceB = new PostgresLoginAttemptStore();
    const seenByB = await instanceB.ensureAllowed("admin", "clientA");
    expect(seenByB.ok).toBe(false);

    // Different client on instance B is unaffected.
    expect((await instanceB.ensureAllowed("admin", "clientB")).ok).toBe(true);
  });

  it("shared blocking: instance B counts an existing bucket toward its own lock decision", async () => {
    const instanceA = new PostgresLoginAttemptStore();
    // Just under the threshold on A.
    for (let i = 0; i < LIMITS.admin - 1; i++) {
      await instanceA.registerFailed("admin", "shared");
    }

    // Instance B (new store) records the final attempt; that request pushes
    // the shared bucket over the threshold.
    const instanceB = new PostgresLoginAttemptStore();
    const result = await instanceB.registerFailed("admin", "shared");
    expect(result.attempts).toBe(LIMITS.admin);
    expect(result.retryAfterSeconds).not.toBeNull();
    expect(result.retryAfterSeconds).toBeGreaterThan(0);

    // Instance A now sees the lock — no in-memory-only state involved.
    const seenByA = await instanceA.ensureAllowed("admin", "shared");
    expect(seenByA.ok).toBe(false);
  });

  it("clear() releases the shared bucket for every instance", async () => {
    const instanceA = new PostgresLoginAttemptStore();
    for (let i = 0; i < LIMITS.admin; i++) {
      await instanceA.registerFailed("admin", "toclear");
    }
    const instanceB = new PostgresLoginAttemptStore();
    expect((await instanceB.ensureAllowed("admin", "toclear")).ok).toBe(false);
    await instanceB.clear("admin", "toclear");
    expect((await instanceA.ensureAllowed("admin", "toclear")).ok).toBe(true);
  });

  it("cleanup() removes only rows older than RETENTION_MS", async () => {
    const store = new PostgresLoginAttemptStore();
    await store.registerFailed("admin", "fresh");
    // Backdate one row past the retention window.
    await prisma.loginAttempt.updateMany({
      where: { clientKey: "fresh" },
      data: {
        firstAttemptAt: new Date(Date.now() - RETENTION_MS - 5_000),
        updatedAt: new Date(Date.now() - RETENTION_MS - 5_000),
      },
    });
    // A brand-new row should stay.
    await store.registerFailed("admin", "recent");
    const { removed } = await store.cleanup();
    expect(removed).toBe(1);
    const remaining = await prisma.loginAttempt.findMany({ select: { clientKey: true } });
    expect(remaining.map((r) => r.clientKey)).toEqual(["recent"]);
  });

  it("window expiry: an attempt older than WINDOW_MS resets the counter", async () => {
    const store = new PostgresLoginAttemptStore();
    for (let i = 0; i < LIMITS.admin - 1; i++) {
      await store.registerFailed("admin", "expiring");
    }
    // Backdate the row past the window.
    await prisma.loginAttempt.updateMany({
      where: { clientKey: "expiring" },
      data: {
        firstAttemptAt: new Date(Date.now() - WINDOW_MS - 5_000),
      },
    });
    const next = await store.registerFailed("admin", "expiring");
    expect(next.attempts).toBe(1);
    expect((await store.ensureAllowed("admin", "expiring")).ok).toBe(true);
  });

  it("scopes are isolated in the DB (unique index on (scope, clientKey))", async () => {
    const store = new PostgresLoginAttemptStore();
    for (let i = 0; i < LIMITS.admin; i++) {
      await store.registerFailed("admin", "sameKey");
    }
    // Other scopes get their own rows and aren't blocked.
    for (const scope of ["worker", "display", "firstBoot"] as const) {
      const check = await store.ensureAllowed(scope, "sameKey");
      expect(check.ok).toBe(true);
    }
    // Row count reflects one row per (scope, clientKey) touched.
    const rows = await prisma.loginAttempt.findMany({
      where: { clientKey: "sameKey" },
    });
    expect(rows.map((r) => r.scope).sort()).toEqual(["admin"]);
  });

  it("firstBoot compatibility: threshold applies to the firstBoot scope", async () => {
    const store = new PostgresLoginAttemptStore();
    for (let i = 0; i < LIMITS.firstBoot; i++) {
      await store.registerFailed("firstBoot", "firstBootClient");
    }
    expect((await store.ensureAllowed("firstBoot", "firstBootClient")).ok).toBe(false);
  });

  it("cleanup command (scripts/login-attempts-cleanup.ts) removes expired rows and preserves fresh rows", async () => {
    // BDF-P1-003 finalisation: prove the top-level cron command uses the
    // exact same retention semantics as the opportunistic path — because
    // it delegates to `PostgresLoginAttemptStore.cleanup()`.
    const store = new PostgresLoginAttemptStore();
    await store.registerFailed("admin", "old-1");
    await store.registerFailed("admin", "old-2");
    await store.registerFailed("admin", "fresh-1");

    // Backdate two rows past retention.
    await prisma.loginAttempt.updateMany({
      where: { clientKey: { in: ["old-1", "old-2"] } },
      data: {
        firstAttemptAt: new Date(Date.now() - RETENTION_MS - 5_000),
        updatedAt: new Date(Date.now() - RETENTION_MS - 5_000),
      },
    });

    // Spawn the actual script the way an operator would.
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(
      "npx",
      ["tsx", "scripts/login-attempts-cleanup.ts"],
      {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("removed=2");

    const remaining = await prisma.loginAttempt.findMany({
      select: { clientKey: true },
      orderBy: { clientKey: "asc" },
    });
    expect(remaining.map((r) => r.clientKey)).toEqual(["fresh-1"]);
  });

  it("clear() persists across instances (used by the login guard's success path)", async () => {
    const a = new PostgresLoginAttemptStore();
    for (let i = 0; i < LIMITS.admin - 1; i++) {
      await a.registerFailed("admin", "success-path");
    }
    await a.clear("admin", "success-path");
    const b = new PostgresLoginAttemptStore();
    expect((await b.ensureAllowed("admin", "success-path")).ok).toBe(true);
    const rows = await prisma.loginAttempt.findMany({
      where: { clientKey: "success-path" },
    });
    expect(rows).toHaveLength(0);
  });
});
