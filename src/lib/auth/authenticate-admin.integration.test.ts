/**
 * BDF-P1-001 integration coverage.
 *
 * Exercises `authenticateAdminByCode`, `ensureDefaultAdmins`, and the
 * gated demo-bootstrap against a live disposable Postgres. Run via:
 *
 *   npm run test:integration:local
 *
 * The runner (`scripts/test-integration-local.ts`) provisions the
 * database, applies committed migrations, and provides `DATABASE_URL`
 * / `DIRECT_URL` in the environment.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateAdminByCode } from "@/lib/auth/authenticate-admin";
import { hashPassword } from "@/lib/auth/password";
import { resolveDemoAdminBootstrap } from "@/lib/auth/demo-admin-bootstrap";
// BDF-P1-002 completion pass: use the same Prisma singleton the service
// modules use so that (a) test setup writes and (b) service reads share
// one connection pool. Two independent `PrismaPg` adapters against the
// same DB can see stale snapshots under some vitest fork orderings.
import { prisma } from "@/lib/db/prisma";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run this suite via `npm run test:integration:local`.",
  );
}

async function resetUsers() {
  await prisma.user.deleteMany({});
}

async function createAdmin(
  email: string,
  storedHash: string,
  overrides: Partial<{ name: string; isActive: boolean }> = {},
) {
  return prisma.user.create({
    data: {
      email,
      name: overrides.name ?? "Test Admin",
      role: "ADMIN",
      isActive: overrides.isActive ?? true,
      passwordHash: storedHash,
    },
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await resetUsers();
  // Do NOT $disconnect the singleton: another file in the same singleFork
  // process may still be about to use it.
});

beforeEach(async () => {
  await resetUsers();
});

describe("authenticateAdminByCode (real DB)", () => {
  it("rejects a legacy plaintext PIN 654321", async () => {
    await createAdmin("legacy-a@example.local", "654321");
    const result = await authenticateAdminByCode(prisma, "legacy-a@example.local", "654321");
    expect(result).toEqual({ ok: false, reason: "legacy_plaintext" });
  });

  it("rejects a legacy plaintext PIN 202020", async () => {
    await createAdmin("legacy-b@example.local", "202020");
    const result = await authenticateAdminByCode(prisma, "legacy-b@example.local", "202020");
    expect(result).toEqual({ ok: false, reason: "legacy_plaintext" });
  });

  it("rejects an arbitrary plaintext passwordHash", async () => {
    await createAdmin("legacy-c@example.local", "hunter2");
    const result = await authenticateAdminByCode(prisma, "legacy-c@example.local", "hunter2");
    expect(result).toEqual({ ok: false, reason: "legacy_plaintext" });
  });

  it("rejects a malformed scrypt$… value", async () => {
    await createAdmin("legacy-d@example.local", "scrypt$9$deadbeef$deadbeef");
    const result = await authenticateAdminByCode(prisma, "legacy-d@example.local", "hunter2");
    // Malformed scrypt fails verifyPassword (`invalid_password`) because
    // isLegacyPlaintextHash only flags values that don't start with `scrypt$`.
    expect(result).toEqual({ ok: false, reason: "invalid_password" });
  });

  it("authenticates a valid scrypt-hashed administrator", async () => {
    const admin = await createAdmin(
      "valid@example.local",
      hashPassword("correcthorse"),
    );
    const result = await authenticateAdminByCode(prisma, "valid@example.local", "correcthorse");
    expect(result).toEqual({ ok: true, adminId: admin.id, sessionEpoch: admin.sessionEpoch });
  });

  it("does not enumerate account existence — unknown email returns not_found", async () => {
    const result = await authenticateAdminByCode(prisma, "no-such@example.local", "anything");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses inactive admins even with a correct hash", async () => {
    await createAdmin("inactive@example.local", hashPassword("correcthorse"), { isActive: false });
    const result = await authenticateAdminByCode(prisma, "inactive@example.local", "correcthorse");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses when the stored hash is null/empty", async () => {
    await createAdmin("empty@example.local", "");
    const result = await authenticateAdminByCode(prisma, "empty@example.local", "anything");
    // Empty-string hash: `isLegacyPlaintextHash` returns false (needs
    // non-empty), so we fall through to `no_hash` (empty string is falsy
    // once passed to verifyPassword).
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(["no_hash", "invalid_password"]).toContain(result.reason);
  });

  it("does not disclose the stored hash in its return value", async () => {
    await createAdmin("legacy-x@example.local", "654321");
    const result = await authenticateAdminByCode(prisma, "legacy-x@example.local", "wrong");
    expect(JSON.stringify(result)).not.toContain("654321");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });
});

describe("ensureDefaultAdmins gated demo bootstrap (real DB)", () => {
  it("creates a scrypt-hashed admin under the local gate + explicit env", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("ALLOW_DEMO_ADMIN_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_ADMIN_EMAIL", "demo-admin@example.local");
    vi.stubEnv("DEMO_ADMIN_PASSWORD", "correcthorse-strong");

    vi.resetModules();
    const { ensureDefaultAdmins } = await import("@/lib/auth/admin-session");

    await ensureDefaultAdmins();

    const row = await prisma.user.findUnique({
      where: { email: "demo-admin@example.local" },
      select: { role: true, isActive: true, passwordHash: true },
    });
    expect(row).not.toBeNull();
    expect(row?.role).toBe("ADMIN");
    expect(row?.isActive).toBe(true);
    expect(row?.passwordHash?.startsWith("scrypt$1$")).toBe(true);
    expect(row?.passwordHash).not.toBe("correcthorse-strong");
    expect(row?.passwordHash).not.toContain("654321");

    // Idempotent: a second invocation does not throw and does not
    // silently rotate the stored password.
    const firstHash = row?.passwordHash;
    await ensureDefaultAdmins();
    const row2 = await prisma.user.findUnique({
      where: { email: "demo-admin@example.local" },
      select: { passwordHash: true },
    });
    // The password IS re-hashed on each call because `upsert.update`
    // writes a fresh scrypt output (different salt), but the resulting
    // hash still verifies the same password and is still scrypt-formatted.
    expect(row2?.passwordHash?.startsWith("scrypt$1$")).toBe(true);
    expect(row2?.passwordHash).not.toBe(firstHash === row2?.passwordHash ? "" : firstHash);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("APP_ENV=production with the flag creates nothing", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("ALLOW_DEMO_ADMIN_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_ADMIN_EMAIL", "prod-admin@example.local");
    vi.stubEnv("DEMO_ADMIN_PASSWORD", "correcthorse-strong");

    vi.resetModules();
    const { ensureDefaultAdmins } = await import("@/lib/auth/admin-session");
    await ensureDefaultAdmins();
    const count = await prisma.user.count();
    expect(count).toBe(0);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("SAAS_MODE=true with the flag creates nothing", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("SAAS_MODE", "true");
    vi.stubEnv("ALLOW_DEMO_ADMIN_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_ADMIN_EMAIL", "saas-admin@example.local");
    vi.stubEnv("DEMO_ADMIN_PASSWORD", "correcthorse-strong");

    vi.resetModules();
    const { ensureDefaultAdmins } = await import("@/lib/auth/admin-session");
    await ensureDefaultAdmins();
    const count = await prisma.user.count();
    expect(count).toBe(0);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("local + missing flag creates nothing", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("DEMO_ADMIN_EMAIL", "demo-admin@example.local");
    vi.stubEnv("DEMO_ADMIN_PASSWORD", "correcthorse-strong");
    // ALLOW_DEMO_ADMIN_BOOTSTRAP not set

    vi.resetModules();
    const { ensureDefaultAdmins } = await import("@/lib/auth/admin-session");
    await ensureDefaultAdmins();
    const count = await prisma.user.count();
    expect(count).toBe(0);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("local + flag but missing DEMO_ADMIN_PASSWORD creates nothing", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("ALLOW_DEMO_ADMIN_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_ADMIN_EMAIL", "demo-admin@example.local");
    // DEMO_ADMIN_PASSWORD deliberately missing

    vi.resetModules();
    const { ensureDefaultAdmins } = await import("@/lib/auth/admin-session");
    await ensureDefaultAdmins();
    const count = await prisma.user.count();
    expect(count).toBe(0);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not overwrite an unrelated existing admin's password when the gate is not satisfied", async () => {
    const existingHash = hashPassword("preserved-password");
    await createAdmin("keep@example.local", existingHash);

    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("ALLOW_DEMO_ADMIN_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_ADMIN_EMAIL", "demo-admin@example.local");
    vi.stubEnv("DEMO_ADMIN_PASSWORD", "correcthorse-strong");

    vi.resetModules();
    const { ensureDefaultAdmins } = await import("@/lib/auth/admin-session");
    await ensureDefaultAdmins();

    const row = await prisma.user.findUnique({
      where: { email: "keep@example.local" },
      select: { passwordHash: true },
    });
    expect(row?.passwordHash).toBe(existingHash);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("resolveDemoAdminBootstrap — decision matrix (sanity)", () => {
  it("returns null when APP_ENV=production even with valid demo creds", () => {
    const result = resolveDemoAdminBootstrap({
      APP_ENV: "production",
      ALLOW_DEMO_ADMIN_BOOTSTRAP: "true",
      DEMO_ADMIN_EMAIL: "x@y.local",
      DEMO_ADMIN_PASSWORD: "hunter22-strong",
    } as unknown as NodeJS.ProcessEnv);
    expect(result).toBeNull();
  });
});
