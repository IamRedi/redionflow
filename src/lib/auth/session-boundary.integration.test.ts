import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => {
    const value = request.values.get(name);
    return value === undefined ? undefined : { value };
  } }),
}));
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin, ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { createTestSession as createSessionCookie } from "../../../tests/security/fixtures";
import { getCurrentDisplayUser, DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { getCurrentWorker, WORKER_COOKIE } from "@/lib/workzone/worker-session";

const companies: string[] = [];
let adminB: string;
let workerB: string;
beforeAll(async () => {
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-security-test-signing-key-only-20261001");
  for (const label of ["A", "B"]) {
    const company = await prisma.companyProfile.create({ data: {
      displayName: `Security synthetic ${label}`, legalName: `Security synthetic ${label}`,
    } });
    companies.push(company.id);
    const admin = await prisma.user.create({ data: {
      email: `security-${company.id}@example.test`, role: "ADMIN", companyProfileId: company.id,
    } });
    const worker = await prisma.worker.create({ data: {
      firstName: "Synthetic", lastName: label, companyProfileId: company.id,
    } });
    if (label === "B") { adminB = admin.id; workerB = worker.id; }
  }
});
beforeEach(() => { request.values.clear(); vi.restoreAllMocks(); });
afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.user.deleteMany({ where: { companyProfileId: { in: companies } } });
  await prisma.companyProfile.deleteMany({ where: { id: { in: companies } } });
});
it("a forged known foreign admin ID is not an authenticated session", async () => {
  request.values.set(ADMIN_COOKIE, adminB);
  expect(await getCurrentAdmin()).toBeNull();
});
it("a forged known foreign worker ID is not an authenticated session", async () => {
  request.values.set(WORKER_COOKIE, workerB);
  expect(await getCurrentWorker()).toBeNull();
});

it("signed admin and worker sessions resolve the correct tenant", async () => {
  request.values.set(ADMIN_COOKIE, await createSessionCookie("admin", adminB));
  expect((await getCurrentAdmin())?.companyProfileId).toBe(companies[1]);
  request.values.set(WORKER_COOKIE, await createSessionCookie("worker", workerB));
  expect((await getCurrentWorker())?.companyProfileId).toBe(companies[1]);
});
it("worker token cannot authenticate as admin or display", async () => {
  const token = await createSessionCookie("worker", workerB);
  request.values.set(ADMIN_COOKIE, token);
  request.values.set(DISPLAY_COOKIE, token);
  expect(await getCurrentAdmin()).toBeNull();
  expect(await getCurrentDisplayUser()).toBeNull();
});
it("altering a signed subject is rejected", async () => {
  const [payload, signature] = (await createSessionCookie("admin", adminB)).split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  claims.id = "another-known-object-id";
  request.values.set(ADMIN_COOKIE, `${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`);
  expect(await getCurrentAdmin()).toBeNull();
});
it("signed session expiry is enforced server-side", async () => {
  const now = Date.now();
  request.values.set(ADMIN_COOKIE, await createSessionCookie("admin", adminB));
  vi.spyOn(Date, "now").mockReturnValue(now + 31 * 24 * 60 * 60 * 1000);
  expect(await getCurrentAdmin()).toBeNull();
});
it("epoch rotation invalidates admin and worker sessions", async () => {
  request.values.set(ADMIN_COOKIE, await createSessionCookie("admin", adminB));
  request.values.set(WORKER_COOKIE, await createSessionCookie("worker", workerB));
  await prisma.user.update({ where: { id: adminB }, data: { sessionEpoch: { increment: 1 } } });
  await prisma.worker.update({ where: { id: workerB }, data: { sessionEpoch: { increment: 1 } } });
  expect(await getCurrentAdmin()).toBeNull();
  expect(await getCurrentWorker()).toBeNull();
});
it("inactive workers cannot keep an authenticated session", async () => {
  request.values.set(WORKER_COOKIE, await createSessionCookie("worker", workerB));
  await prisma.worker.update({ where: { id: workerB }, data: { status: "inactive" } });
  expect(await getCurrentWorker()).toBeNull();
  await prisma.worker.update({ where: { id: workerB }, data: { status: "active" } });
});
it("missing or short signing configuration fails closed", async () => {
  const token = await createSessionCookie("admin", adminB);
  for (const key of ["", "short"]) {
    vi.stubEnv("SESSION_SIGNING_SECRET", key);
    request.values.set(ADMIN_COOKIE, token);
    expect(await getCurrentAdmin()).toBeNull();
    await expect(createSessionCookie("admin", adminB)).rejects.toThrow("SESSION_SIGNING_SECRET");
  }
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-security-test-signing-key-only-20261001");
});
