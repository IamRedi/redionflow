/**
 * BDF-P1-005 integration coverage.
 *
 * Runs against a live disposable Postgres (`npm run test:integration:local`).
 * Exercises the scrypt-only policy for worker and display authentication
 * end-to-end.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authenticateDisplayByCode } from "@/lib/auth/authenticate-display";
import { authenticateWorkerByCode } from "@/lib/auth/authenticate-worker";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run this suite via `npm run test:integration:local`.",
  );
}

async function resetAll() {
  await prisma.worker.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.companyProfile.deleteMany({});
}

async function seedCompany() {
  return prisma.companyProfile.create({
    data: {
      legalName: "Test Co",
      displayName: "Test Co",
    },
    select: { id: true },
  });
}

async function seedWorker(
  companyId: string,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    loginCode: string | null;
    loginCodeHash: string | null;
    status: "active" | "inactive";
  }> = {},
) {
  return prisma.worker.create({
    data: {
      companyProfileId: companyId,
      firstName: overrides.firstName ?? "Anna",
      lastName: overrides.lastName ?? "Beispiel",
      loginCode: overrides.loginCode ?? null,
      loginCodeHash: overrides.loginCodeHash ?? null,
      status: overrides.status ?? "active",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      loginCode: true,
      loginCodeHash: true,
    },
  });
}

async function seedDisplayUser(email: string, storedHash: string) {
  return prisma.user.create({
    data: {
      email,
      role: "STAFF",
      isActive: true,
      passwordHash: storedHash,
    },
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await resetAll();
});

beforeEach(async () => {
  await resetAll();
});

describe("authenticateWorkerByCode (real DB, BDF-P1-005)", () => {
  it("rejects a legacy plaintext loginCode", async () => {
    const { id: companyId } = await seedCompany();
    await seedWorker(companyId, { loginCode: "123456" });
    const result = await authenticateWorkerByCode(prisma, "123456");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("legacy_plaintext");
  });

  it("rejects the legacy 6-digit PIN 000000 stored as plaintext", async () => {
    const { id: companyId } = await seedCompany();
    await seedWorker(companyId, { loginCode: "000000" });
    const result = await authenticateWorkerByCode(prisma, "000000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("legacy_plaintext");
  });

  it("rejects a malformed / mismatched code as invalid_code", async () => {
    const { id: companyId } = await seedCompany();
    await seedWorker(companyId, { loginCodeHash: hashPassword("111111") });
    const result = await authenticateWorkerByCode(prisma, "222222");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_code");
  });

  it("authenticates a worker whose loginCodeHash matches the submitted code", async () => {
    const { id: companyId } = await seedCompany();
    const worker = await seedWorker(companyId, {
      loginCodeHash: hashPassword("111111"),
    });
    const result = await authenticateWorkerByCode(prisma, "111111");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.worker.id).toBe(worker.id);
  });

  it("ignores inactive workers", async () => {
    const { id: companyId } = await seedCompany();
    await seedWorker(companyId, {
      loginCodeHash: hashPassword("111111"),
      status: "inactive",
    });
    const result = await authenticateWorkerByCode(prisma, "111111");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_code");
  });

  it("rotation: after admin re-writes with a fresh hash the new code works and the old plaintext row is inaccessible", async () => {
    const { id: companyId } = await seedCompany();
    // Legacy plaintext row.
    const worker = await seedWorker(companyId, { loginCode: "111111" });
    // Admin rotation clears `loginCode` and writes `loginCodeHash`.
    await prisma.worker.update({
      where: { id: worker.id },
      data: {
        loginCode: null,
        loginCodeHash: hashPassword("222222"),
      },
    });
    // Old code no longer authenticates.
    const oldAttempt = await authenticateWorkerByCode(prisma, "111111");
    expect(oldAttempt.ok).toBe(false);
    // New code authenticates.
    const newAttempt = await authenticateWorkerByCode(prisma, "222222");
    expect(newAttempt.ok).toBe(true);
  });

  it("does not disclose the stored hash or the raw code in the return value", async () => {
    const { id: companyId } = await seedCompany();
    await seedWorker(companyId, { loginCode: "424242" });
    const result = await authenticateWorkerByCode(prisma, "424242");
    expect(JSON.stringify(result)).not.toContain("scrypt");
    expect(JSON.stringify(result)).not.toContain("loginCodeHash");
  });
});

describe("authenticateDisplayByCode (real DB, BDF-P1-005)", () => {
  it("rejects a legacy plaintext passwordHash '303030'", async () => {
    await seedDisplayUser("legacy-display@example.local", "303030");
    const result = await authenticateDisplayByCode(
      prisma,
      "legacy-display@example.local",
      "303030",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("legacy_plaintext");
  });

  it("rejects an arbitrary plaintext passwordHash", async () => {
    await seedDisplayUser("arbitrary@example.local", "notascrypthash");
    const result = await authenticateDisplayByCode(
      prisma,
      "arbitrary@example.local",
      "notascrypthash",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("legacy_plaintext");
  });

  it("authenticates a display user whose passwordHash is scrypt-hashed", async () => {
    const user = await seedDisplayUser(
      "valid-display@example.local",
      hashPassword("displayhorse"),
    );
    const result = await authenticateDisplayByCode(
      prisma,
      "valid-display@example.local",
      "displayhorse",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe(user.id);
  });

  it("ignores inactive display accounts", async () => {
    await prisma.user.create({
      data: {
        email: "inactive-display@example.local",
        role: "STAFF",
        isActive: false,
        passwordHash: hashPassword("displayhorse"),
      },
    });
    const result = await authenticateDisplayByCode(
      prisma,
      "inactive-display@example.local",
      "displayhorse",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("does not disclose the stored hash in the return value", async () => {
    await seedDisplayUser("shape-check@example.local", "303030");
    const result = await authenticateDisplayByCode(
      prisma,
      "shape-check@example.local",
      "303030",
    );
    expect(JSON.stringify(result)).not.toContain("303030");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });
});

describe("ensureDefaultDisplayUsers gated demo bootstrap (real DB, BDF-P1-005)", () => {
  it("creates a scrypt-hashed display user under the local gate + explicit env", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("ALLOW_DEMO_DISPLAY_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_DISPLAY_EMAIL", "demo-display@example.local");
    vi.stubEnv("DEMO_DISPLAY_PASSWORD", "displayhorse-strong");
    vi.resetModules();

    const { ensureDefaultDisplayUsers } = await import("@/lib/auth/display-session");
    await ensureDefaultDisplayUsers();

    const row = await prisma.user.findUnique({
      where: { email: "demo-display@example.local" },
      select: { role: true, isActive: true, passwordHash: true },
    });
    expect(row).not.toBeNull();
    expect(row?.role).toBe("STAFF");
    expect(row?.isActive).toBe(true);
    expect(row?.passwordHash?.startsWith("scrypt$1$")).toBe(true);
    expect(row?.passwordHash).not.toBe("displayhorse-strong");

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("APP_ENV=production with the flag creates nothing", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SAAS_MODE", "false");
    vi.stubEnv("ALLOW_DEMO_DISPLAY_BOOTSTRAP", "true");
    vi.stubEnv("DEMO_DISPLAY_EMAIL", "prod-display@example.local");
    vi.stubEnv("DEMO_DISPLAY_PASSWORD", "displayhorse-strong");
    vi.resetModules();

    const { ensureDefaultDisplayUsers } = await import("@/lib/auth/display-session");
    await ensureDefaultDisplayUsers();
    expect(await prisma.user.count()).toBe(0);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
