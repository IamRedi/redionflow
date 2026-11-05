import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ values: new Map<string, string>() }));
const ocr = vi.hoisted(() => ({ text: '', calls: 0 }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => {
      const value = request.values.get(key);
      return value === undefined ? undefined : { value };
    },
  }),
  headers: async () => new Headers({ 'accept-language': 'sq' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('./ocr', async (original) => ({
  ...(await original<typeof import('./ocr')>()),
  readReceiptText: async () => {
    ocr.calls++;
    return ocr.text;
  },
}));
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  createTestSession,
  seedSecurityTenants,
  removeSecurityTenants,
} from '../../../../tests/security/fixtures';
import {
  prepareFuelReceipt,
  confirmFuelReceipt,
  readFuelFile,
  readFuelLog,
  readFuelReceipt,
  readOlderFuelReceipts,
} from './service';
import { localClock, parseFuelClock } from './time';
import {
  captureFuelGps,
  saveCredentials,
  createVehicleAndBind,
  syncFleetLocations,
} from '../wanway/service';
import { readFleetLocations } from '../location';
import { getMachineSidebarData } from '@/lib/workzone/machine-sidebar-data';
import { GET as receiptGet } from '@/app/api/fuel-receipts/[id]/route';
let tenants: Awaited<ReturnType<typeof seedSecurityTenants>>,
  image: Uint8Array,
  pointTime: number,
  invoiceClock: string;
const fetcher = vi.fn<typeof fetch>(async (input) => {
  const url = new URL(String(input));
  if (url.hostname !== 'open.iopgps.com')
    throw new Error('No external test network');
  if (url.pathname === '/api/auth')
    return Response.json({
      code: 0,
      accessToken: 'synthetic-token',
      expiresIn: 7200000,
    });
  if (url.pathname === '/api/device/status')
    return Response.json({
      code: 0,
      data: [
        {
          imei: '000000000000001',
          lat: '41.2',
          lng: '19.7',
          gpsTime: pointTime,
          signalTime: pointTime,
          status: 'offline',
        },
      ],
    });
  if (url.pathname === '/api/device/track/history')
    return Response.json({
      code: 0,
      data: [
        { lat: '41.2', lng: '19.7', gpsTime: pointTime },
        { lat: '41.201', lng: '19.701', gpsTime: pointTime + 90 },
      ],
    });
  throw new Error('Forbidden test provider path');
});
async function as(kind: 'admin' | 'worker', i = 0) {
  request.values.clear();
  request.values.set(
    kind === 'admin' ? 'bk_admin_id' : 'bk_worker_id',
    await createTestSession(
      kind,
      kind === 'admin' ? tenants[i].admin.id : tenants[i].worker.id,
    ),
  );
}
const file = () =>
  new File([new Uint8Array(image)], 'synthetic-receipt.png', {
    type: 'image/png',
  });
const clock = () => invoiceClock;
async function upload() {
  return prepareFuelReceipt(tenants[0].machine.id, randomUUID(), file());
}
async function connection() {
  await as('admin');
  await saveCredentials('synthetic-app', 'synthetic-key', true);
  return prisma.wanwayDevice.create({
    data: {
      companyProfileId: tenants[0].company.id,
      imei: '000000000000001',
      name: 'Synthetic GPS',
      machineId: tenants[0].machine.id,
    },
  });
}
beforeEach(async () => {
  vi.stubEnv(
    'SESSION_SIGNING_SECRET',
    'synthetic-fuel-session-key-for-local-tests-20261104',
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
  ocr.text = '';
  ocr.calls = 0;
  tenants = await seedSecurityTenants();
  await prisma.companyProfile.update({
    where: { id: tenants[0].company.id },
    data: { country: 'AL' },
  });
  image = new Uint8Array(
    await readFile('tests/fixtures/synthetic-fuel-receipt.png'),
  );
  pointTime = Math.floor(Date.now() / 1000) - 300;
  invoiceClock = localClock(new Date(Date.now() - 300000), 'Europe/Tirane');
  await as('worker');
});
afterEach(async () => {
  await removeSecurityTenants(tenants.map((t) => t.company.id));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('keeps the original receipt, server uploader and upload time, separately from confirmed invoice time', async () => {
  const before = Date.now();
  ocr.text = `Date: ${clock().replace('T', ' Time: ')}`;
  const draft = await upload();
  expect(draft.receiptTime).toBe(clock());
  expect(draft.confirmedAt).toBeNull();
  const saved = await confirmFuelReceipt(
    draft.id,
    clock(),
    'Synthetic receipt address',
    40,
    2500,
  );
  expect(saved.uploadedAt).toBe(draft.uploadedAt);
  expect(Date.parse(saved.uploadedAt)).toBeGreaterThanOrEqual(before - 1000);
  expect(Date.parse(saved.fueledAt!)).toBeLessThan(
    Date.parse(saved.uploadedAt),
  );
  expect(saved).toMatchObject({
    uploadedByName: `${tenants[0].worker.firstName} ${tenants[0].worker.lastName}`,
    timeZone: 'Europe/Tirane',
    timeSource: 'receipt',
    gpsStatus: 'no_gps',
    liters: 40,
    amount: 2500,
    currency: 'ALL',
  });
  const raw = await prisma.fuelReceipt.findUniqueOrThrow({
    where: { id: draft.id },
  });
  expect(raw.uploadedByWorkerId).toBe(tenants[0].worker.id);
  expect(Buffer.from(raw.data)).toEqual(Buffer.from(image));
  expect(raw.sha256).toBe(createHash('sha256').update(image).digest('hex'));
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not duplicate an upload or rerun OCR on a retried request', async () => {
  const id = randomUUID();
  const a = await prepareFuelReceipt(tenants[0].machine.id, id, file());
  const b = await prepareFuelReceipt(tenants[0].machine.id, id, file());
  expect(a.id).toBe(b.id);
  expect(ocr.calls).toBe(1);
  expect(
    await prisma.fuelReceipt.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(1);
  await expect(confirmFuelReceipt(a.id, '', '', null, null)).rejects.toThrow(
    'CLOCK',
  );
});
it('pages the complete private receipt history without duplicates or tenant crossover', async () => {
  const draft = await upload();
  const raw = await prisma.fuelReceipt.findUniqueOrThrow({
    where: { id: draft.id },
  });
  await prisma.fuelReceipt.createMany({
    data: Array.from({ length: 60 }, () => ({
      companyProfileId: raw.companyProfileId,
      machineId: raw.machineId,
      requestId: randomUUID(),
      uploadedByWorkerId: raw.uploadedByWorkerId,
      uploadedByName: raw.uploadedByName,
      uploadedAt: raw.uploadedAt,
      timeZone: raw.timeZone,
      currency: raw.currency,
      fileName: raw.fileName,
      mime: raw.mime,
      size: raw.size,
      data: raw.data,
      sha256: raw.sha256,
    })),
  });
  const first = await readFuelLog();
  expect(first.receipts).toHaveLength(60);
  expect(first.hasMore).toBe(true);
  const last = first.receipts.at(-1)!;
  const next = await readOlderFuelReceipts(null, {
    id: last.id,
    uploadedAt: last.uploadedAt,
  });
  expect(next.receipts).toHaveLength(1);
  expect(next.hasMore).toBe(false);
  expect(
    new Set([...first.receipts, ...next.receipts].map((r) => r.id)).size,
  ).toBe(61);
  await as('worker', 1);
  expect(
    (
      await readOlderFuelReceipts(null, {
        id: last.id,
        uploadedAt: last.uploadedAt,
      })
    ).receipts,
  ).toHaveLength(0);
});
it('keeps the office uploader separately from the actual worker, and refuses a foreign worker', async () => {
  await as('admin');
  const draft = await upload();
  await expect(
    confirmFuelReceipt(
      draft.id,
      clock(),
      '',
      null,
      null,
      null,
      tenants[1].worker.id,
    ),
  ).rejects.toThrow('NOT_FOUND');
  const saved = await confirmFuelReceipt(
    draft.id,
    clock(),
    '',
    null,
    null,
    null,
    tenants[0].worker.id,
  );
  expect(saved.fueledByWorkerId).toBe(tenants[0].worker.id);
  const raw = await prisma.fuelReceipt.findUniqueOrThrow({
    where: { id: draft.id },
  });
  expect(raw.uploadedByUserId).toBe(tenants[0].admin.id);
  expect(raw.uploadedByWorkerId).toBeNull();
  await as('worker');
  expect((await readFuelReceipt(draft.id)).id).toBe(draft.id);
  expect(await readFuelFile(draft.id)).not.toBeNull();
});
it('requires manual time when OCR is empty and preserves immutable confirmed data', async () => {
  const row = await upload();
  expect(row.receiptTime).toBeNull();
  const saved = await confirmFuelReceipt(row.id, clock(), '', null, null);
  expect(saved.timeSource).toBe('manual');
  expect((await confirmFuelReceipt(row.id, clock(), '', null, null)).id).toBe(
    row.id,
  );
  await expect(
    confirmFuelReceipt(row.id, clock(), 'changed', null, null),
  ).rejects.toThrow('IMMUTABLE');
  expect((await readFuelReceipt(row.id)).stationAddress).toBeNull();
});
it('protects receipt metadata and exact bytes across tenants, mixed and anonymous sessions', async () => {
  const row = await upload();
  await as('admin', 1);
  expect((await readFuelLog()).receipts).toHaveLength(0);
  expect(await readFuelFile(row.id)).toBeNull();
  await expect(
    confirmFuelReceipt(row.id, clock(), '', null, null),
  ).rejects.toThrow('NOT_FOUND');
  await expect(captureFuelGps(row.id)).rejects.toThrow('NOT_FOUND');
  const response = await receiptGet(
    new Request(`http://127.0.0.1/api/fuel-receipts/${row.id}`),
    { params: Promise.resolve({ id: row.id }) },
  );
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  request.values.set(
    'bk_worker_id',
    await createTestSession('worker', tenants[0].worker.id),
  );
  await expect(readFuelLog()).rejects.toThrow('FLEET_UNAUTHORIZED');
  request.values.clear();
  await expect(upload()).rejects.toThrow('FLEET_UNAUTHORIZED');
  expect(fetcher).not.toHaveBeenCalled();
});
it('lets the office review all company receipts while coworkers see only their own', async () => {
  const row = await upload();
  const other = await prisma.worker.create({
    data: {
      companyProfileId: tenants[0].company.id,
      firstName: 'Another',
      lastName: 'Synthetic',
    },
  });
  request.values.clear();
  request.values.set(
    'bk_worker_id',
    await createTestSession('worker', other.id),
  );
  expect((await readFuelLog()).receipts).toHaveLength(0);
  expect(await readFuelFile(row.id)).toBeNull();
  await as('admin');
  expect((await readFuelLog()).receipts.map((r) => r.id)).toContain(row.id);
  const response = await receiptGet(
    new Request(`http://127.0.0.1/api/fuel-receipts/${row.id}`),
    { params: Promise.resolve({ id: row.id }) },
  );
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(image));
});
it('rejects a foreign or inactive machine before storing bytes or running OCR', async () => {
  await expect(
    prepareFuelReceipt(tenants[1].machine.id, randomUUID(), file()),
  ).rejects.toThrow('NOT_FOUND');
  await prisma.machine.update({
    where: { id: tenants[0].machine.id },
    data: { isActive: false },
  });
  await expect(upload()).rejects.toThrow('NOT_FOUND');
  expect(ocr.calls).toBe(0);
  expect(
    await prisma.fuelReceipt.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(0);
});
it('captures only the nearest historical vehicle point with its actual time and signed gap', async () => {
  const device = await connection();
  await as('worker');
  const row = await upload();
  const at = clock();
  const fueledMs = parseFuelClock(at, 'Europe/Tirane')!.getTime();
  pointTime = Math.floor(fueledMs / 1000) - 30;
  const saved = await confirmFuelReceipt(row.id, at, '', null, null);
  expect(saved).toMatchObject({
    gpsStatus: 'matched',
    gpsDeltaSeconds: -30,
    gpsSource: 'wanway_history',
    gpsLat: 41.2,
  });
  const call = fetcher.mock.calls.find(([input]) =>
    new URL(String(input)).pathname.endsWith('/history'),
  );
  expect(call).toBeDefined();
  const url = new URL(String(call![0]));
  expect(url.searchParams.get('noFilter')).toBe('1');
  expect(
    Number(url.searchParams.get('endTime')) -
      Number(url.searchParams.get('startTime')),
  ).toBeLessThanOrEqual(3600);
  expect(JSON.stringify(saved)).not.toContain('000000000000001');
  expect(JSON.stringify(saved)).not.toContain('synthetic-key');
  const original = saved.gpsRecordedAt;
  await captureFuelGps(row.id);
  expect((await readFuelReceipt(row.id)).gpsRecordedAt).toBe(original);
  // A later replacement GPS must never rewrite an older receipt with the
  // replacement device's historic route. Keep the original evidence/device.
  await prisma.wanwayDevice.update({
    where: { id: device.id },
    data: { machineId: null },
  });
  await prisma.wanwayDevice.create({
    data: {
      companyProfileId: tenants[0].company.id,
      imei: '000000000000002',
      name: 'Replacement synthetic GPS',
      machineId: tenants[0].machine.id,
      lat: 42,
      lng: 20,
      reportedAt: parseFuelClock(at, 'Europe/Tirane'),
    },
  });
  fetcher.mockClear();
  await captureFuelGps(row.id);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await readFuelReceipt(row.id)).gpsRecordedAt).toBe(original);
  expect(
    (await prisma.fuelReceipt.findUniqueOrThrow({ where: { id: row.id } }))
      .gpsDeviceId,
  ).toBe(device.id);
});
it('keeps a receipt saved when GPS is busy and never substitutes the upload time for fueling time', async () => {
  await connection();
  await prisma.wanwayIntegration.update({
    where: { companyProfileId: tenants[0].company.id },
    data: { nextRequestAt: new Date(Date.now() + 60000) },
  });
  await as('worker');
  const row = await upload();
  const saved = await confirmFuelReceipt(row.id, clock(), '', null, null);
  expect(saved).toMatchObject({ gpsStatus: 'cooldown', gpsLat: null });
  expect(saved.fueledAt).not.toBe(saved.uploadedAt);
  expect(fetcher).not.toHaveBeenCalled();
});
it('serves only own confirmed positions to Workzone and can refresh them without allowing worker configuration', async () => {
  const d = await connection();
  await as('worker');
  expect(await readFleetLocations()).toEqual([]);
  expect(await syncFleetLocations()).toBe(1);
  expect((await readFleetLocations()).map((m) => m.id)).toEqual([
    tenants[0].machine.id,
  ]);
  expect((await readFleetLocations())[0].online).toBe(false);
  expect((await getMachineSidebarData()).map((m) => m.id)).toEqual([
    tenants[0].machine.id,
  ]);
  await expect(
    createVehicleAndBind(d.id, 'Forged vehicle', 'ZZ999XX'),
  ).rejects.toThrow();
  await as('worker', 1);
  expect(await readFleetLocations()).toEqual([]);
  expect((await getMachineSidebarData()).map((m) => m.id)).toEqual([
    tenants[1].machine.id,
  ]);
});
it('adds a missing vehicle only through explicit admin confirmation and rejects duplicate plates', async () => {
  await connection();
  await prisma.wanwayDevice.updateMany({
    where: { companyProfileId: tenants[0].company.id },
    data: { machineId: null },
  });
  const d = await prisma.wanwayDevice.findFirstOrThrow({
    where: { companyProfileId: tenants[0].company.id },
  });
  await createVehicleAndBind(d.id, 'Synthetic new truck', 'ZZ 999 XX');
  expect(
    await prisma.machine.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(2);
  expect(
    (await prisma.wanwayDevice.findUniqueOrThrow({ where: { id: d.id } }))
      .machineId,
  ).not.toBeNull();
  await prisma.wanwayDevice.update({
    where: { id: d.id },
    data: { machineId: null },
  });
  await expect(
    createVehicleAndBind(d.id, 'Other truck', 'ZZ999XX'),
  ).rejects.toThrow('VEHICLE_EXISTS');
  expect(
    await prisma.machine.count({
      where: { companyProfileId: tenants[0].company.id },
    }),
  ).toBe(2);
});
it('uses a composite machine key and forced RLS on stored receipts', async () => {
  const row = await upload();
  await expect(
    prisma.fuelReceipt.update({
      where: { id: row.id },
      data: { machineId: tenants[1].machine.id },
    }),
  ).rejects.toThrow();
  await prisma.$executeRawUnsafe(
    'CREATE ROLE fuel_rls_probe NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  try {
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA public TO fuel_rls_probe',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON "FuelReceipt" TO fuel_rls_probe',
    );
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE fuel_rls_probe');
      expect(await tx.fuelReceipt.count()).toBe(0);
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${tenants[1].company.id},true)`;
      expect(await tx.fuelReceipt.count()).toBe(0);
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id',${tenants[0].company.id},true)`;
      expect(await tx.fuelReceipt.count()).toBe(1);
    });
  } finally {
    await prisma.$executeRawUnsafe('DROP OWNED BY fuel_rls_probe');
    await prisma.$executeRawUnsafe('DROP ROLE fuel_rls_probe');
  }
  expect(
    await withTenantContext(tenants[0].company.id, (tx) =>
      tx.fuelReceipt.count(),
    ),
  ).toBeGreaterThan(0);
});
