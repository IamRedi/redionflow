import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => (request.values.has(key) ? { value: request.values.get(key)! } : undefined) }), headers: async () => new Headers() }));
import { prisma } from "@/lib/db/prisma";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createTestSession, removeSecurityTenants, seedSecurityTenants } from "../../../tests/security/fixtures";
import { parseManagedReference } from "./managed-reference";

// Installations without Supabase (the Railway pilot) keep private files in Postgres.
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
let storage: typeof import("./object-storage");
const pdf = (name = "contract.pdf") => new File(["%PDF-1.4\nsynthetic private document\n%%EOF\n"], name, { type: "application/pdf" });
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ""); vi.stubEnv("CONTENT_SCANNER", "none");
  vi.stubEnv("SESSION_SIGNING_SECRET", "synthetic-security-test-signing-key-only-20261001");
  storage = await import("./object-storage");
  tenants = await seedSecurityTenants(); request.values.clear();
});
afterEach(async () => { await removeSecurityTenants(tenants.map(t => t.company.id)); vi.unstubAllEnvs(); vi.resetModules(); });

it("stores a worker document in the database under the worker's company and reads it back", async () => {
  const workerId = tenants[0].worker.id;
  const url = await storage.uploadManagedFile({ scope: "worker-assets", entityId: workerId, file: pdf(), fileName: "1-contract.pdf" });
  const ref = parseManagedReference(url)!;
  expect(ref.entityId).toBe(workerId);
  const row = await prisma.managedFile.findUniqueOrThrow({ where: { scope_entityId_fileName: { scope: ref.scope, entityId: ref.entityId, fileName: ref.fileName } } });
  expect(row.companyProfileId).toBe(tenants[0].company.id);
  expect(row.mime).toBe("application/pdf");
  const response = await storage.readManagedFile(ref);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("synthetic private document");
  await storage.deleteManagedFileByUrl(url, { scope: "worker-assets", entityId: workerId });
  expect(await prisma.managedFile.count({ where: { entityId: workerId } })).toBe(0);
  expect((await storage.readManagedFile(ref)).status).toBe(404);
});

it("row level security hides one company's files from another company", async () => {
  await storage.uploadManagedFile({ scope: "baustelle-documents", entityId: tenants[0].site.id, file: pdf("plan.pdf"), fileName: "1-plan.pdf" });
  await prisma.$executeRawUnsafe("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'managed_file_rls_probe') THEN CREATE ROLE managed_file_rls_probe; END IF; END $$");
  await prisma.$executeRawUnsafe('GRANT SELECT ON "ManagedFile" TO managed_file_rls_probe');
  try {
    const seen = (companyId: string) => withTenantContext(companyId, async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE managed_file_rls_probe");
      return tx.managedFile.count();
    });
    expect(await seen(tenants[0].company.id)).toBe(1);
    expect(await seen(tenants[1].company.id)).toBe(0);
  } finally {
    await prisma.$executeRawUnsafe("DROP OWNED BY managed_file_rls_probe");
    await prisma.$executeRawUnsafe("DROP ROLE managed_file_rls_probe");
  }
});

it("site documents uploaded for a new site are kept, and an aborted import leaves nothing behind", async () => {
  const siteId = tenants[0].site.id;
  const batch = storage.planPendingImport(tenants[0].company.id, siteId, [pdf("a.pdf"), pdf("b.pdf")]);
  await storage.uploadPendingImport(batch, [pdf("a.pdf"), pdf("b.pdf")]);
  expect(await prisma.managedFile.count({ where: { entityId: siteId } })).toBe(2);
  await storage.abortPendingImport(batch); await storage.abortPendingImport(batch);
  expect(await prisma.managedFile.count({ where: { entityId: siteId } })).toBe(0);
  await storage.uploadPendingImport(batch, [pdf("a.pdf"), pdf("b.pdf")]);
  await storage.finalizePendingImport(batch);
  await storage.reconcilePendingImport(batch.id, async () => [], batch.expiresAt);
  expect(await prisma.managedFile.count({ where: { entityId: siteId } })).toBe(2);
  await storage.clearManagedEntityFolder("baustelle-documents", siteId);
  expect(await prisma.managedFile.count({ where: { entityId: siteId } })).toBe(0);
});

it("the private file route serves the stored document to its own admin and not to a foreign admin", async () => {
  const workerId = tenants[0].worker.id;
  const url = await storage.uploadManagedFile({ scope: "worker-assets", entityId: workerId, file: pdf(), fileName: "1-contract.pdf" });
  await prisma.worker.update({ where: { id: workerId }, data: { documents: [{ id: "doc", label: "Contract", url }] } });
  const { GET } = await import("@/app/api/private-files/route");
  const read = () => GET(new Request(`http://127.0.0.1:3100${url}`));
  request.values.set("bk_admin_id", await createTestSession("admin", tenants[0].admin.id));
  const own = await read();
  expect(own.status).toBe(200);
  expect(own.headers.get("content-disposition")).toContain("attachment");
  expect(await own.text()).toContain("synthetic private document");
  request.values.set("bk_admin_id", await createTestSession("admin", tenants[1].admin.id));
  expect((await read()).status).toBe(404);
});
