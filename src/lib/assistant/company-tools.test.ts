import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import type { RequesterContext } from './requester';

const mocks = vi.hoisted(() => ({ withTenantContext: vi.fn() }));
const assetFacts=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('./asset-grounding',async original=>({...await original<typeof import('./asset-grounding')>(),assistantAssetGrounding:assetFacts.read}));
vi.mock('@/lib/db/tenant-context', () => mocks);
import { adminGetCompanyFuelReceipts, adminSearchCompanyFleet, adminSearchCompanyInventory, adminSearchCompanyWorkers } from './company-tools';

const now = new Date('2026-11-05T12:00:00Z');
const requester: RequesterContext = { kind: 'admin', adminId: 'admin-a', companyId: 'tenant-a', preferredLanguage: 'SQ', displayName: 'Demo' };
const tx = {
  user: { findFirst: vi.fn() }, companyProfile: { findUnique: vi.fn() },
  worker: { count: vi.fn(), findMany: vi.fn() }, machine: { count: vi.fn(), findMany: vi.fn() },
  fuelReceipt: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  companyInventoryItem: { count: vi.fn(), findMany: vi.fn() },
};
const worker = (id: string) => ({ id, firstName: 'Demo', lastName: 'Worker', position: 'Welder', licenses: 'CE', status: 'active', availability: 'AVAILABLE', level: 'WORKER', crewRole: 'welder', startedAtCompany: null, preferredLanguage: 'SQ', updatedAt: now,
  sessions: [{ id: 'session-a', startTime: now, baustelle: { id: 'site-a', name: 'Demo site', companyProfileId: 'tenant-a' } }], _count: { sessions: 1 }, loginCode: 'NEVER_EXPORT_LOGIN', nationalId: 'NEVER_EXPORT_ID' });
const machine = () => ({ id: 'machine-a', name: 'Demo crane', nickname: 'Crane', model: null, targe: 'AB 123 CD', category: 'OTHER', funksioni: 'lifting', isActive: true, patentaEnevojshme: null,
  tuvDate: null, insuranceDate: null, taxDate: null, transportPermitDate: null, tachographDate: null,
  gpsEnabled: true, lastGpsLat: 41, lastGpsLng: 19, lastGpsAt: now, updatedAt: now,
  wanwayDevices: [{ lat: 41.1, lng: 19.1, reportedAt: new Date('2026-11-05T11:00:00Z'), syncedAt: now, providerStatus: 'driving', available: true, imei: 'NEVER_EXPORT_DEVICE' }] });

beforeEach(() => {
  vi.clearAllMocks();
  assetFacts.read.mockResolvedValue({applicable:false,complete:true,items:[],retrievedAt:now.toISOString(),warning:null});
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  vi.stubEnv('WANWAY_GPS_ENABLED', 'true'); vi.stubEnv('DEMO_MODE', 'false'); vi.stubEnv('APP_ENV', 'saas');
  tx.user.findFirst.mockResolvedValue({ id: 'admin-a' }); tx.companyProfile.findUnique.mockResolvedValue({ country: 'AL' });
  for (const model of [tx.worker, tx.machine, tx.fuelReceipt, tx.companyInventoryItem]) { model.count.mockResolvedValue(0); model.findMany.mockResolvedValue([]); }
  tx.fuelReceipt.groupBy.mockResolvedValue([]);
  mocks.withTenantContext.mockImplementation(async (_company: string, fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx as unknown as Prisma.TransactionClient));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('company assistant read tools', () => {
  it('does not present an active register machine with a canonical defect as usable',async()=>{
    tx.machine.count.mockResolvedValue(1);tx.machine.findMany.mockResolvedValue([machine()]);
    assetFacts.read.mockResolvedValue({applicable:true,complete:true,items:[{ref:{kind:'machine',id:'machine-a'},baseRecordActive:true,operationalAvailability:'reported',usable:false}],retrievedAt:now.toISOString(),warning:null});
    expect(await adminSearchCompanyFleet(requester)).toMatchObject({ok:true,data:{items:[{active:true,baseRecordActive:true,operationalAvailability:'reported',usable:false}],operationalCoverage:{complete:true}}});
  });
  it('keeps failure of the operational read explicitly unknown instead of falling back to active=true',async()=>{
    tx.machine.count.mockResolvedValue(1);tx.machine.findMany.mockResolvedValue([machine()]);assetFacts.read.mockResolvedValue({applicable:true,complete:false,items:[],retrievedAt:now.toISOString(),warning:'Operational data unavailable'});
    expect(await adminSearchCompanyFleet(requester)).toMatchObject({ok:true,data:{items:[{active:true,baseRecordActive:true,operationalAvailability:null,usable:null,operationalCoverageComplete:false}],operationalCoverage:{complete:false}}});
  });
  it('denies workers before any database call, and verifies live admin membership before business reads', async () => {
    const workerRequester: RequesterContext = { kind: 'worker', workerId: 'worker-a', companyId: 'tenant-a', preferredLanguage: 'SQ', displayName: 'Demo' };
    for (const tool of [adminSearchCompanyWorkers, adminSearchCompanyFleet, adminGetCompanyFuelReceipts, adminSearchCompanyInventory]) expect(await tool(workerRequester)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
    tx.user.findFirst.mockResolvedValue(null);
    expect(await adminSearchCompanyWorkers(requester)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(tx.user.findFirst).toHaveBeenCalledWith({ where: { id: 'admin-a', companyProfileId: 'tenant-a', role: 'ADMIN', isActive: true }, select: { id: true } });
    expect(tx.worker.findMany).not.toHaveBeenCalled();
    expect(tx.companyProfile.findUnique).not.toHaveBeenCalled();
  });

  it('keeps same-name workers as candidates, preserves exact matching total across pages, and omits secret fields', async () => {
    tx.worker.count.mockResolvedValue(3); tx.worker.findMany.mockResolvedValue([worker('a'), worker('b'), worker('c')]);
    const result = await adminSearchCompanyWorkers(requester, { query: 'Demo Worker', limit: 2 });
    expect(result).toMatchObject({ ok: true, timeZone: 'Europe/Tirane', retrievedAt: now.toISOString(), data: { totalMatching: 3, returned: 2, hasMore: true, complete: false, nextCursor: 'b', identityResolution: 'multiple_candidates_require_clarification' } });
    expect(tx.worker.findMany.mock.calls[0][0]).toMatchObject({ where: { AND: [{ companyProfileId: 'tenant-a' }, {}] }, orderBy: { id: 'asc' }, take: 3 });
    expect(JSON.stringify(result)).not.toContain('NEVER_EXPORT');
    tx.worker.findMany.mockResolvedValue([worker('c')]);
    const next = await adminSearchCompanyWorkers(requester, { query: 'Demo Worker', limit: 2, cursor: 'b' });
    expect(next).toMatchObject({ ok: true, data: { totalMatching: 3, hasMore: false, complete: false, scope: 'continuation_page', nextCursor: null } });
    expect(tx.worker.findMany.mock.calls[1][0].where.AND[1]).toEqual({ id: { gt: 'b' } });
  });

  it('returns stale GPS with its own report time and plate without treating it as current location', async () => {
    tx.machine.count.mockResolvedValue(2); tx.machine.findMany.mockResolvedValue([machine()]);
    const result = await adminSearchCompanyFleet(requester, { query: 'AB123CD' });
    expect(result).toMatchObject({ ok: true, data: { identityResolution: 'multiple_candidates_require_clarification', items: [{ plate: 'AB 123 CD', gpsStatus: 'stale_stored_point', gps: { stale: true, online: false, reportedAt: '2026-11-05T11:00:00.000Z', ageSeconds: 3600 } }] } });
    expect(tx.machine.count.mock.calls[0][0]).toMatchObject({ where: { companyProfileId: 'tenant-a', OR: expect.arrayContaining([{ targe: { contains: 'AB 123 CD', mode: 'insensitive' } }]) } });
    expect(JSON.stringify(result)).not.toContain('NEVER_EXPORT_DEVICE');
    expect(tx.machine.findMany.mock.calls[0][0].select.wanwayDevices.where).toEqual({ companyProfileId: 'tenant-a' });
  });

  it('does not fall back to a misleading older machine GPS point when a confirmed device point is invalid', async () => {
    tx.machine.count.mockResolvedValue(1); const row = machine(); row.wanwayDevices[0].reportedAt = new Date('2026-11-06T00:00:00Z'); tx.machine.findMany.mockResolvedValue([row]);
    expect(await adminSearchCompanyFleet(requester, { machineId: 'machine-a' })).toMatchObject({ ok: true, data: { items: [{ gps: null, gpsStatus: 'no_valid_stored_point' }] } });
  });

  it('provides all-filtered invoice totals by currency, missing-value counts and actor/time/GPS provenance without file contents', async () => {
    tx.fuelReceipt.count.mockResolvedValue(4);
    tx.fuelReceipt.groupBy.mockResolvedValue([
      { currency: 'ALL', _count: { _all: 3, liters: 2, amount: 2 }, _sum: { liters: 30, amount: 4000 } },
      { currency: 'EUR', _count: { _all: 1, liters: 0, amount: 0 }, _sum: { liters: null, amount: null } },
    ]);
    const receipt = { id: 'receipt-a', machineId: 'machine-a', machine: { name: 'Demo truck', nickname: null, targe: 'AB 123 CD' }, uploadedByName: 'Uploader', uploadedAt: now, confirmedAt: now,
      fueledAt: new Date('2026-11-05T08:00:00Z'), fueledByName: 'Fueler', timeZone: 'Europe/Tirane', receiptTime: '2026-11-05T09:00', timeSource: 'confirmed', stationAddress: 'Recorded demo station', liters: 10, amount: 1000, currency: 'ALL',
      gpsStatus: 'matched', gpsLat: 41, gpsLng: 19, gpsRecordedAt: new Date('2026-11-05T08:03:00Z'), gpsDeltaSeconds: 180, gpsSource: 'stored', gpsResolvedAt: now, data: 'NEVER_EXPORT_IMAGE', sha256: 'NEVER_EXPORT_HASH' };
    tx.fuelReceipt.findMany.mockResolvedValue([receipt, { ...receipt, id: 'receipt-b' }]);
    const result = await adminGetCompanyFuelReceipts(requester, { machineId: 'machine-a', from: '2026-11-05', to: '2026-11-05', dateBasis: 'fueled', limit: 1 });
    expect(result).toMatchObject({ ok: true, data: { totalMatching: 4, returned: 1, complete: false, hasMore: true, dateBasis: 'fueled', totalsScope: 'all_matching_stored_receipts_not_just_this_page',
      totalsByCurrency: [{ currency: 'ALL', recordedLiters: 30, recordedAmount: 4000, missingLiters: 1, missingAmount: 1 }, { currency: 'EUR', recordedAmount: null, missingAmount: 1 }],
      items: [{ uploadedBy: 'Uploader', fueledBy: 'Fueler', uploadedAt: '2026-11-05T12:00:00.000Z', fueledAt: '2026-11-05T08:00:00.000Z', gps: { recordedAt: '2026-11-05T08:03:00.000Z', deltaSeconds: 180 } }] } });
    expect(tx.fuelReceipt.count.mock.calls[0][0].where).toMatchObject({ companyProfileId: 'tenant-a', machine: { companyProfileId: 'tenant-a' }, fueledAt: { gte: new Date('2026-11-04T23:00:00Z'), lt: new Date('2026-11-05T23:00:00Z') } });
    expect(JSON.stringify(result)).not.toContain('NEVER_EXPORT');
    expect(tx.fuelReceipt.findMany.mock.calls[0][0].select).not.toHaveProperty('data');
    expect(tx.fuelReceipt.findMany.mock.calls[0][0].select).not.toHaveProperty('gpsEvidence');
  });

  it('rejects invalid dates, unbounded page requests and database failures without fabricating empty results', async () => {
    for (const input of [{ from: '2026-02-30' }, { from: '2026-11-06', to: '2026-11-05' }, { limit: 1000 }, { cursor: 'bad cursor' }]) expect(await adminGetCompanyFuelReceipts(requester, input)).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    expect(mocks.withTenantContext).not.toHaveBeenCalled();
    tx.machine.findMany.mockRejectedValue(new Error('NEVER_EXPORT_DATABASE_MESSAGE'));
    const result = await adminSearchCompanyFleet(requester);
    expect(result).toMatchObject({ ok: false, code: 'DATA_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain('NEVER_EXPORT');
  });

  it('can select the latest fueling event without confusing upload order or silently paging in a different order', async () => {
    tx.fuelReceipt.count.mockResolvedValue(3);
    expect(await adminGetCompanyFuelReceipts(requester, { latest: true, dateBasis: 'fueled' })).toMatchObject({ ok: true, data: { scope: 'latest_matching_fueled_receipt', latestBy: 'fueled', totalMatching: 3, complete: false, nextCursor: null } });
    expect(tx.fuelReceipt.findMany.mock.calls[0][0]).toMatchObject({ where: { AND: [{ fueledAt: { not: null } }, {}] }, orderBy: [{ fueledAt: 'desc' }, { id: 'desc' }], take: 1 });
    expect(await adminGetCompanyFuelReceipts(requester, { latest: true, cursor: 'receipt-a' })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  });

  it('applies worker-role and confirmation filters to exact totals as well as the displayed receipt page', async () => {
    const result = await adminGetCompanyFuelReceipts(requester, { uploadedByWorkerId: 'worker-a', confirmed: true });
    expect(result).toMatchObject({ ok: true, data: { actorFilters: { uploadedByWorkerId: 'worker-a', fueledByWorkerId: null }, confirmedOnly: true } });
    const where = tx.fuelReceipt.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyProfileId: 'tenant-a', uploadedByWorkerId: 'worker-a', confirmedAt: { not: null } });
    expect(tx.fuelReceipt.groupBy.mock.calls[0][0].where).toEqual(where);
    expect(tx.fuelReceipt.findMany.mock.calls[0][0].where.AND[0]).toEqual(where);
  });

  it('labels the inventory as a catalog instead of inventing physical stock and tenant-scopes assignment counts', async () => {
    tx.companyInventoryItem.count.mockResolvedValue(1); tx.companyInventoryItem.findMany.mockResolvedValue([{ id: 'item-a', category: 'CLOTHING', itemCode: 'DEMO-1', barcode: 'DEMO-BAR', name: 'Demo jacket', sizeLabel: 'L', isActive: true, updatedAt: now, _count: { workerAssignments: 2 } }]);
    const result = await adminSearchCompanyInventory(requester, { query: 'jacket' });
    expect(result).toMatchObject({ ok: true, data: { totalMatching: 1, complete: true, items: [{ activeWorkerAssignments: 2 }] } });
    expect(tx.companyInventoryItem.findMany.mock.calls[0][0].select._count.select.workerAssignments.where).toMatchObject({ status: 'ACTIVE', deletedAt: null, worker: { companyProfileId: 'tenant-a' } });
    expect(JSON.stringify(result)).not.toContain('availableStock');
  });
});
