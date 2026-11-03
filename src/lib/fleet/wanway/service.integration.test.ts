import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = request.values.get(name);
      return value === undefined ? undefined : { value };
    },
  }),
  headers: async () => new Headers({ 'accept-language': 'en' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
import {
  seedSecurityTenants,
  removeSecurityTenants,
  createTestSession,
} from '../../../../tests/security/fixtures';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { unseal } from './crypto';
import {
  bindDevice,
  disconnect,
  loadHistory,
  readFleet,
  readPanel,
  saveCredentials,
  syncDevices,
} from './service';
import { wanwayAction } from '@/app/(admin)/app/settings/integrations/wanway/actions';

let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>;
const imei = '000000000000001';
const key = 'synthetic-key-only';
let now: number;
let failStatus = false;
let failMileage = false;
const fetcher = vi.fn<typeof fetch>(async (url) => {
  const path = new URL(String(url)).pathname;
  let body: unknown;
  if (path === '/api/auth')
    body = {
      code: 0,
      accessToken: 'synthetic-access-token',
      expiresIn: 7200000,
    };
  else if (path === '/api/device')
    body = {
      code: 0,
      data: [
        {
          imei,
          deviceName: 'Synthetic GPS',
          deviceType: 'GS900-Wired',
          mobile: 'discard-private-sim',
        },
      ],
      page: { count: 1, currentPage: 1, pageSize: 100 },
    };
  else if (path === '/api/device/status')
    body = failStatus
      ? { code: 456, result: 'private-error-never-echo' }
      : {
          code: 0,
          data: [
            {
              imei,
              lat: '41.2',
              lng: '19.7',
              gpsTime: now,
              signalTime: now,
              status: 'offline',
              speed: 0,
              extVoltage: 123,
              sim: 'discard-private-sim',
            },
          ],
        };
  else if (path === '/api/device/miles')
    body = failMileage ? { code: 789 } : { code: 0, miles: 15 };
  else if (path === '/api/device/track/history')
    body = { code: 0, data: [{ lat: '41.2', lng: '19.7', gpsTime: now }] };
  else throw new Error('Forbidden provider endpoint');
  return new Response(JSON.stringify(body));
});
beforeEach(async () => {
  vi.stubEnv(
    'SESSION_SIGNING_SECRET',
    'synthetic-security-test-signing-key-only-20261103',
  );
  vi.stubEnv('WANWAY_GPS_ENABLED', 'true');
  vi.stubEnv('DEMO_MODE', 'false');
  vi.stubEnv('WANWAY_ACTIVE_KEY_ID', 'test');
  vi.stubEnv(
    'WANWAY_ENCRYPTION_KEYS',
    JSON.stringify({ test: 'a1'.repeat(32) }),
  );
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockClear();
  now = Math.floor(Date.now() / 1000) - 10;
  failStatus = false;
  failMileage = false;
  tenants = await seedSecurityTenants();
  request.values.clear();
  await asAdmin(0);
});
afterEach(async () => {
  await removeSecurityTenants(tenants.map((t) => t.company.id));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function asAdmin(i: number) {
  request.values.clear();
  request.values.set(
    'bk_admin_id',
    await createTestSession('admin', tenants[i].admin.id),
  );
}
async function ready() {
  await saveCredentials('synthetic-app', key, true);
  await syncDevices(true);
}
async function cooldown() {
  await prisma.wanwayIntegration.update({
    where: { companyProfileId: tenants[0].company.id },
    data: { nextRequestAt: new Date(0) },
  });
}
async function deviceId(i = 0) {
  return (
    await prisma.wanwayDevice.findFirstOrThrow({
      where: { companyProfileId: tenants[i].company.id },
    })
  ).id;
}

it('encrypts credentials/token, excludes secrets and full IMEI from DTO/audit, and preserves existing vehicles', async () => {
  await ready();
  const row = await prisma.wanwayIntegration.findUniqueOrThrow({
    where: { companyProfileId: tenants[0].company.id },
  });
  expect(row.encryptedKey).not.toContain(key);
  expect(unseal(row.encryptedKey!, tenants[0].company.id, 'key')).toBe(key);
  expect(row.encryptedToken).not.toContain('synthetic-access-token');
  const publicData = JSON.stringify({
    panel: await readPanel(),
    audit: await prisma.auditLog.findMany({
      where: { companyProfileId: tenants[0].company.id },
    }),
  });
  for (const forbidden of [
    key,
    'synthetic-access-token',
    imei,
    'discard-private-sim',
    row.encryptedKey!,
  ])
    expect(publicData).not.toContain(forbidden);
  expect(
    await prisma.machine.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(1);
  expect((await readPanel()).lastSuccessfulSync).toBeNull(); // test != telemetry sync
});

it('denies unauthenticated, worker and mixed identities before database/provider effects', async () => {
  for (const kind of ['anonymous', 'worker', 'mixed']) {
    request.values.clear();
    if (kind !== 'anonymous')
      request.values.set(
        'bk_worker_id',
        await createTestSession('worker', tenants[1].worker.id),
      );
    if (kind === 'mixed')
      request.values.set(
        'bk_admin_id',
        await createTestSession('admin', tenants[0].admin.id),
      );
    expect(
      (await wanwayAction({ action: 'save', appid: 'a', key, approved: true }))
        .ok,
    ).toBe(false);
    await expect(readPanel()).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    await prisma.wanwayIntegration.count({
      where: { companyProfileId: { in: tenants.map((t) => t.company.id) } },
    }),
  ).toBe(0);
});

it('enforces backend tenant ownership for both sides of every binding', async () => {
  await ready();
  const id = await deviceId();
  await expect(bindDevice(id, tenants[1].machine.id)).rejects.toThrow(
    'NOT_FOUND',
  );
  await asAdmin(1);
  await saveCredentials('synthetic-app-b', 'synthetic-key-b', true);
  await expect(bindDevice(id, tenants[1].machine.id)).rejects.toThrow(
    'NOT_FOUND',
  );
  expect((await readPanel()).devices).toHaveLength(0);
  expect(await readFleet()).toHaveLength(0);
  expect(
    (await prisma.wanwayDevice.findUniqueOrThrow({ where: { id } })).machineId,
  ).toBeNull();
});

it('uses composite database constraints and forced RLS to reject cross-tenant associations', async () => {
  await ready();
  const a = tenants[0].company.id;
  await expect(
    prisma.wanwayDevice.update({
      where: { id: await deviceId() },
      data: { machineId: tenants[1].machine.id },
    }),
  ).rejects.toThrow();
  // A probe role only in the disposable fixture DB; no production grants.
  await prisma.$executeRawUnsafe(
    'CREATE ROLE wanway_rls_probe NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  try {
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA public TO wanway_rls_probe',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON "WanwayIntegration", "WanwayDevice" TO wanway_rls_probe',
    );
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE wanway_rls_probe');
      expect(await tx.wanwayIntegration.count()).toBe(0);
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenants[1].company.id}, true)`;
      expect(await tx.wanwayIntegration.count()).toBe(0);
      expect(await tx.wanwayDevice.count()).toBe(0);
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${a}, true)`;
      expect(await tx.wanwayIntegration.count()).toBe(1);
      expect(await tx.wanwayDevice.count()).toBe(1);
    });
  } finally {
    await prisma.$executeRawUnsafe('DROP OWNED BY wanway_rls_probe');
    await prisma.$executeRawUnsafe('DROP ROLE wanway_rls_probe');
  }
  expect(
    await withTenantContext(a, (tx) =>
      tx.wanwayDevice.count({ where: { companyProfileId: a } }),
    ),
  ).toBe(1);
});

it('keeps unlinked vehicles unchanged and shows offline data with real report time and converted voltage', async () => {
  await ready();
  const id = await deviceId();
  await bindDevice(id, tenants[0].machine.id);
  await cooldown();
  await syncDevices();
  const [d] = await readFleet();
  expect(d).toMatchObject({
    online: false,
    voltage: 12.3,
    speedKmh: 0,
    mileage24hKm: 15,
    machineId: tenants[0].machine.id,
  });
  expect(d.reportedAt).toBe(new Date(now * 1000).toISOString());
  const machine = await prisma.machine.findUniqueOrThrow({
    where: { id: tenants[0].machine.id },
  });
  expect(machine.gpsEnabled).toBe(false);
  expect(machine.lastGpsAt).toBeNull();
  expect((await readPanel()).lastSuccessfulSync).not.toBeNull();
  expect(
    fetcher.mock.calls.filter(([u]) => String(u).includes('/api/auth')),
  ).toHaveLength(1);
});

it('rate limits across calls and guards overlapping credential/binding/disconnect operations', async () => {
  await ready();
  await expect(syncDevices()).rejects.toThrow('COOLDOWN');
  expect(
    fetcher.mock.calls.filter(([u]) => String(u).includes('/api/auth')),
  ).toHaveLength(1);
  await prisma.wanwayIntegration.update({
    where: { companyProfileId: tenants[0].company.id },
    data: { busyUntil: new Date(Date.now() + 60000) },
  });
  await expect(saveCredentials('app', key, true)).rejects.toThrow('BUSY');
  await expect(disconnect()).rejects.toThrow('BUSY');
  await expect(
    bindDevice(await deviceId(), tenants[0].machine.id),
  ).rejects.toThrow('BUSY');
});

it('allows existing vehicle deletion without dangling GPS references', async () => {
  await ready();
  await bindDevice(await deviceId(), tenants[0].machine.id);
  await prisma.machine.delete({ where: { id: tenants[0].machine.id } });
  expect((await readPanel()).devices).toHaveLength(0);
  await cooldown();
  await syncDevices(true);
  expect((await readPanel()).devices[0].machineId).toBeNull();
  expect(
    await prisma.machine.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(0);
});

it('on provider failure retains snapshots and sync time, reports only real error code, and releases lease', async () => {
  await ready();
  await cooldown();
  await syncDevices();
  const before = (await readPanel()).lastSuccessfulSync;
  await cooldown();
  failStatus = true;
  expect(await wanwayAction({ action: 'sync' })).toEqual({
    ok: false,
    code: 'WANWAY_PROVIDER_456',
  });
  const panel = await readPanel();
  expect(panel.lastSuccessfulSync).toBe(before);
  expect(panel.lastError).toBe('WANWAY_PROVIDER_456');
  expect(
    (
      await prisma.wanwayIntegration.findUniqueOrThrow({
        where: { companyProfileId: tenants[0].company.id },
      })
    ).operationId,
  ).toBeNull();
});

it('loads history only for an owned mapped device, returns transient points, and disconnect erases private cache', async () => {
  await ready();
  const id = await deviceId();
  await bindDevice(id, tenants[0].machine.id);
  await cooldown();
  expect((await loadHistory(id)).points).toHaveLength(1);
  await disconnect();
  expect((await readPanel()).devices).toHaveLength(0);
  expect(await readFleet()).toHaveLength(0);
  const row = await prisma.wanwayIntegration.findUniqueOrThrow({
    where: { companyProfileId: tenants[0].company.id },
  });
  expect(row.encryptedKey).toBeNull();
  expect(row.encryptedToken).toBeNull();
  expect(row.nextRequestAt.getTime()).toBeGreaterThan(Date.now());
  expect(
    await prisma.machine.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(1);
});

it('replacing credentials clears bindings; missing encryption and privacy approval fail closed', async () => {
  await ready();
  await bindDevice(await deviceId(), tenants[0].machine.id);
  await saveCredentials('synthetic-app-next', 'synthetic-key-next', true);
  expect((await readPanel()).devices).toHaveLength(0);
  vi.stubEnv('WANWAY_ENCRYPTION_KEYS', '{}');
  await expect(saveCredentials('app', key, true)).rejects.toThrow('KEYRING');
  await expect(saveCredentials('app', key, false)).rejects.toThrow('PRIVACY');
});

it('public demos fail closed for every read and action', async () => {
  vi.stubEnv('DEMO_MODE', 'true');
  expect(await readFleet()).toEqual([]);
  await expect(readPanel()).rejects.toThrow('DISABLED');
  expect(
    (await wanwayAction({ action: 'save', appid: 'a', key, approved: true }))
      .ok,
  ).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps valid positions when optional mileage permission is denied', async () => {
  await ready();
  await bindDevice(await deviceId(), tenants[0].machine.id);
  await cooldown();
  failMileage = true;
  await syncDevices();
  const [d] = await readFleet();
  expect(d.lat).toBe(41.2);
  expect(d.mileage24hKm).toBeNull();
  expect(d.mileageError).toBe('WANWAY_PROVIDER_789');
  expect((await readPanel()).lastSuccessfulSync).not.toBeNull();
});
