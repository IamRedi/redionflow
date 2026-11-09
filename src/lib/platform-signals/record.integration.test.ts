import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { withTenantContext } from "@/lib/db/tenant-context";
import { removeSecurityTenants, seedSecurityTenants } from "../../../tests/security/fixtures";
import { forwardPendingSignals, recordPlatformSignal } from "./record";

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
beforeEach(async () => { tenants = await seedSecurityTenants(); });
afterEach(async () => { vi.unstubAllEnvs(); await removeSecurityTenants(tenants.map(t => t.company.id)); });

const actor = (index = 0) => ({ companyId: tenants[index].company.id, kind: "worker" as const, id: tenants[index].worker.id, name: "Synthetic", language: "SQ" });
const rows = (index = 0) => withTenantContext(tenants[index].company.id, tx => tx.platformSignal.findMany({ where: { companyProfileId: tenants[index].company.id } }));

it("stores a signal once per company and counts repeats", async () => {
  await recordPlatformSignal(actor(), { kind: "feature", title: "Faturë për klientin", details: "Megi do fatura" });
  const again = await recordPlatformSignal(actor(), { kind: "feature", title: "  fature per KLIENTIN " });
  expect(again?.count).toBe(2);
  const own = await rows();
  expect(own).toHaveLength(1);
  expect(own[0]).toMatchObject({ kind: "feature", count: 2, details: "Megi do fatura", actorKind: "worker", forwardedAt: null });
  expect(await rows(1)).toHaveLength(0);
});

it("forwards pending signals to the hub and retries failures", async () => {
  vi.stubEnv("REDION_HUB_URL", "https://hub.example.test/");
  vi.stubEnv("REDION_HUB_KEY", "synthetic");
  await withTenantContext(tenants[0].company.id, tx => tx.platformSignal.create({ data: { companyProfileId: tenants[0].company.id, kind: "bug", title: "Butoni nuk punon", fingerprint: "f1", actorKind: "worker", actorId: "w" } }));
  const failing = vi.fn(async () => new Response("no", { status: 503 }));
  expect(await forwardPendingSignals(tenants[0].company.id, failing as unknown as typeof fetch)).toBe(0);
  expect((await rows())[0]).toMatchObject({ forwardedAt: null, forwardAttempts: 1 });
  const ok = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
  expect(await forwardPendingSignals(tenants[0].company.id, ok as unknown as typeof fetch)).toBe(1);
  const [url, init] = ok.mock.calls[0];
  expect(url).toBe("https://hub.example.test/api/signals");
  expect((init.headers as Record<string, string>).authorization).toBe("Bearer synthetic");
  expect(JSON.parse(init.body as string)).toMatchObject({ kind: "bug", title: "Butoni nuk punon", company: { id: tenants[0].company.id } });
  expect((await rows())[0].forwardedAt).not.toBeNull();
  expect(await prisma.platformSignal.count({ where: { forwardedAt: null, companyProfileId: tenants[0].company.id } })).toBe(0);
});

it("does nothing without a hub", async () => {
  const fetcher = vi.fn();
  expect(await forwardPendingSignals(tenants[0].company.id, fetcher as unknown as typeof fetch)).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});
