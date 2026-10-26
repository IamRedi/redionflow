/**
 * BDF-P1-002 integration coverage — first-boot admin setup against a live
 * disposable Postgres. Run via:
 *
 *   npm run test:integration:local
 *
 * The runner (`scripts/test-integration-local.ts`) provisions the DB and
 * applies committed migrations; CI provides the same shape via the
 * existing `postgres:16` service (BDF-P1-001 completion pass).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// These service-contract cases exercise the enabled first-boot gate. Keep
// their mode explicit when the enclosing local runner uses SAAS_MODE=true;
// the SaaS rejection case below loads its own isSaasMode=true mock.
vi.mock("@/lib/saas-config", () => ({ isSaasMode: false }));

import { authenticateAdmin } from "@/lib/auth/authenticate-admin";
import { hashPassword } from "@/lib/auth/password";
import { performFirstBootSetup } from "@/lib/auth/first-boot-setup-service";
// Use the same Prisma singleton the service uses so writes made from the
// test setup and reads made from inside the service share a connection
// pool. Two independent PrismaPg adapters against the same DB can see
// stale snapshots under some vitest fork orderings.
import { prisma } from "@/lib/db/prisma";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run this suite via `npm run test:integration:local` or `npm run test:integration` against a provisioned DB.",
  );
}

const HEX64 = "a".repeat(64);
const HEX64_ALT = "b".repeat(64);

async function resetUsers() {
  await prisma.user.deleteMany({});
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

const validInput = {
  token: HEX64,
  email: "first-admin@example.local",
  password: "correcthorse-strong",
  confirmation: "correcthorse-strong",
  name: "First Admin",
};

const okEnv = {
  FIRST_BOOT_SETUP_ENABLED: "true",
  FIRST_BOOT_SETUP_TOKEN: HEX64,
} as unknown as NodeJS.ProcessEnv;

describe("performFirstBootSetup (real DB)", () => {
  it("fresh DB + full gate + valid input → creates exactly one scrypt-hashed admin", async () => {
    const before = await prisma.user.count();
    expect(before).toBe(0);

    const result = await performFirstBootSetup(validInput, okEnv);
    expect(result.ok).toBe(true);

    const rows = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, passwordHash: true, isActive: true, name: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(validInput.email);
    expect(rows[0]?.isActive).toBe(true);
    expect(rows[0]?.name).toBe(validInput.name);
    expect(rows[0]?.passwordHash?.startsWith("scrypt$1$")).toBe(true);
    expect(rows[0]?.passwordHash).not.toBe(validInput.password);
  });

  it("fresh DB + setup disabled → no admin created", async () => {
    const result = await performFirstBootSetup(validInput, {} as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("setup_disabled");
    expect(await prisma.user.count()).toBe(0);
  });

  it("fresh DB + missing token env → no admin created", async () => {
    const result = await performFirstBootSetup(validInput, {
      FIRST_BOOT_SETUP_ENABLED: "true",
    } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(await prisma.user.count()).toBe(0);
  });

  it("fresh DB + malformed configured token → no admin created", async () => {
    const result = await performFirstBootSetup(validInput, {
      FIRST_BOOT_SETUP_ENABLED: "true",
      FIRST_BOOT_SETUP_TOKEN: "short-token",
    } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(await prisma.user.count()).toBe(0);
  });

  it("fresh DB + wrong submitted token → invalid_token, no admin created", async () => {
    const result = await performFirstBootSetup(
      { ...validInput, token: HEX64_ALT },
      okEnv,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_token");
    expect(await prisma.user.count()).toBe(0);
  });

  it("created admin can authenticate via authenticateAdmin", async () => {
    const setup = await performFirstBootSetup(validInput, okEnv);
    expect(setup.ok).toBe(true);
    const auth = await authenticateAdmin(prisma, validInput.email, validInput.password);
    expect(auth.ok).toBe(true);
    if (auth.ok && setup.ok) expect(auth.adminId).toBe(setup.adminId);
  });

  it("second setup attempt after success → denied (admin_exists)", async () => {
    await performFirstBootSetup(validInput, okEnv);
    const result = await performFirstBootSetup(
      { ...validInput, email: "second@example.local" },
      okEnv,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("admin_exists");
    expect(await prisma.user.count()).toBe(1);
  });

  it("existing active admin blocks anonymous setup", async () => {
    await prisma.user.create({
      data: {
        email: "existing@example.local",
        role: "ADMIN",
        isActive: true,
        passwordHash: hashPassword("existing-password-12"),
      },
    });
    const result = await performFirstBootSetup(validInput, okEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("admin_exists");
  });

  it("existing INACTIVE admin still blocks anonymous setup", async () => {
    // Documented decision: any admin identity row blocks first-boot so it
    // cannot be used as an account-takeover vector on an existing
    // installation (BDF-P1-002).
    await prisma.user.create({
      data: {
        email: "inactive@example.local",
        role: "ADMIN",
        isActive: false,
        passwordHash: hashPassword("existing-password-12"),
      },
    });
    const result = await performFirstBootSetup(validInput, okEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("admin_exists");
  });

  it("existing legacy-plaintext admin blocks anonymous setup", async () => {
    // Documented decision: a legacy plaintext admin row is still an
    // admin identity. First-boot cannot bypass it; recovery is an
    // explicit operator path (BDF-P1-002 does not implement it).
    await prisma.user.create({
      data: {
        email: "legacy@example.local",
        role: "ADMIN",
        isActive: true,
        passwordHash: "654321",
      },
    });
    const result = await performFirstBootSetup(validInput, okEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("admin_exists");
    expect(await prisma.user.count()).toBe(1);
  });

  it("invalid email is rejected", async () => {
    const result = await performFirstBootSetup(
      { ...validInput, email: "not-an-email" },
      okEnv,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
    expect(await prisma.user.count()).toBe(0);
  });

  it("short password is rejected", async () => {
    const result = await performFirstBootSetup(
      { ...validInput, password: "short", confirmation: "short" },
      okEnv,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
    expect(await prisma.user.count()).toBe(0);
  });

  it("password mismatch is rejected", async () => {
    const result = await performFirstBootSetup(
      { ...validInput, confirmation: "different-value-12" },
      okEnv,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
    expect(await prisma.user.count()).toBe(0);
  });

  it("password equal to the setup token is rejected", async () => {
    const result = await performFirstBootSetup(
      { ...validInput, password: HEX64, confirmation: HEX64 },
      okEnv,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
    expect(await prisma.user.count()).toBe(0);
  });

  it("SaaS mode denies setup regardless of gate", async () => {
    vi.resetModules();
    vi.doMock("@/lib/saas-config", () => ({ isSaasMode: true }));
    const { performFirstBootSetup: performUnderSaas } = await import(
      "./first-boot-setup-service"
    );
    const result = await performUnderSaas(validInput, okEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("setup_disabled");
    expect(await prisma.user.count()).toBe(0);
    vi.doUnmock("@/lib/saas-config");
    vi.resetModules();
  });

  it("two concurrent valid setup requests create exactly one admin (advisory-lock serialisation)", async () => {
    // Use Promise.all so both requests are in flight simultaneously.
    const [r1, r2] = await Promise.all([
      performFirstBootSetup(
        { ...validInput, email: "concurrent-a@example.local" },
        okEnv,
      ),
      performFirstBootSetup(
        { ...validInput, email: "concurrent-b@example.local" },
        okEnv,
      ),
    ]);
    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    // The losing request must fail with admin_exists (not database_error).
    for (const f of failures) {
      if (!f.ok) expect(f.reason).toBe("admin_exists");
    }
    // Only one admin row survives; no partial or duplicate record.
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    expect(admins).toHaveLength(1);
    expect(admins[0]?.passwordHash?.startsWith("scrypt$1$")).toBe(true);
  });
});
