import type { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { freshness } from '@/lib/fleet/wanway/adapter';
import { fuelTimeZone } from '@/lib/fleet/fuel/time';
import { midnight, nextDay } from '@/lib/dashboard/steel-metrics';
import type { RequesterContext } from './requester';

type Tx = Prisma.TransactionClient;
type Page = { cursor?: string; limit?: number };
type Search = Page & { query?: string };
const failure = (code: string, message: string) => ({ ok: false as const, code, message });
const denied = () => failure('FORBIDDEN', 'Only a current administrator of this company can read this information.');
const clipped = (value: string | null, max = 300) => value === null ? null : value.slice(0, max);
const iso = (value: Date | null) => value?.toISOString() ?? null;
function paging(input: Page) {
  if ((input.cursor !== undefined && !/^[a-z0-9_-]{1,80}$/i.test(input.cursor)) ||
      (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 30))) return null;
  return { limit: input.limit ?? 15, after: input.cursor ? { id: { gt: input.cursor } } : {} };
}
function searchText(raw?: string) {
  if (raw === undefined) return '';
  if (typeof raw !== 'string' || raw.length > 100) return null;
  return raw.trim().replace(/\s+/g, ' ');
}
function pageInfo<T extends { id: string }>(rows: T[], total: number, input: Page, limit: number) {
  const hasMore = rows.length > limit, items = rows.slice(0, limit);
  return { items, totalMatching: total, returned: items.length, hasMore,
    complete: !input.cursor && !hasMore && items.length === total,
    nextCursor: hasMore ? items.at(-1)!.id : null,
    scope: input.cursor ? 'continuation_page' : hasMore ? 'first_page' : 'all_matching_rows' };
}
async function read<T>(requester: RequesterContext, source: string, fn: (tx: Tx, zone: string, now: Date) => Promise<T>) {
  if (requester.kind !== 'admin' || !requester.companyId || !requester.adminId) return denied();
  try {
    return await withTenantContext(requester.companyId, async tx => {
      const admin = await tx.user.findFirst({ where: { id: requester.adminId, companyProfileId: requester.companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
      if (!admin) return denied();
      const company = await tx.companyProfile.findUnique({ where: { id: requester.companyId }, select: { country: true } });
      if (!company) return denied();
      const now = new Date(), timeZone = fuelTimeZone(company.country);
      return { ok: true as const, source, retrievedAt: now.toISOString(), timeZone,
        consistency: 'Current stored records read during this request; live/provider verification is not performed.',
        data: await fn(tx, timeZone, now) };
    });
  } catch {
    return failure('DATA_UNAVAILABLE', 'The stored data could not be read. Do not interpret this failure as zero, no records, or an offline device.');
  }
}

/** Directory lookup never picks a person from an ambiguous name. No authentication or identity-document fields. */
export async function adminSearchCompanyWorkers(requester: RequesterContext, input: Search & { workerId?: string; status?: 'active' | 'inactive' | 'all' } = {}) {
  const page = paging(input), query = searchText(input.query);
  if (!page || query === null || (input.status && !['active', 'inactive', 'all'].includes(input.status))) return failure('INVALID_INPUT', 'Use a bounded search, valid status and page cursor/limit.');
  return read(requester, 'Worker directory and stored live sessions', async (tx) => {
    const tokens = query.split(' ').filter(Boolean);
    const where: Prisma.WorkerWhereInput = { companyProfileId: requester.companyId,
      ...(input.workerId ? { id: input.workerId } : {}),
      ...(input.status && input.status !== 'all' ? { status: input.status } : {}),
      ...(tokens.length ? { AND: tokens.map(token => ({ OR: [{ firstName: { contains: token, mode: 'insensitive' as const } }, { lastName: { contains: token, mode: 'insensitive' as const } }] })) } : {}) };
    const live = { isLive: true, endTime: null };
    const [total, rows] = await Promise.all([
      tx.worker.count({ where }),
      tx.worker.findMany({ where: { AND: [where, page.after] }, orderBy: { id: 'asc' }, take: page.limit + 1,
        select: { id: true, firstName: true, lastName: true, position: true, licenses: true, status: true,
          availability: true, level: true, crewRole: true, startedAtCompany: true, preferredLanguage: true, updatedAt: true,
          sessions: { where: live, orderBy: { startTime: 'desc' }, take: 2, select: { id: true, startTime: true, baustelle: { select: { id: true, name: true, companyProfileId: true } } } },
          _count: { select: { sessions: { where: live } } } } }),
    ]);
    const items = rows.map(r => ({ id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), position: clipped(r.position),
      licenses: clipped(r.licenses), status: r.status, availability: r.availability, level: r.level, crewRole: r.crewRole,
      truncatedFields: [ ...(r.position && r.position.length > 300 ? ['position'] : []), ...(r.licenses && r.licenses.length > 300 ? ['licenses'] : []) ],
      startedAtCompany: iso(r.startedAtCompany), preferredLanguage: r.preferredLanguage, updatedAt: iso(r.updatedAt),
      liveSessionCount: r._count.sessions,
      liveSessions: r.sessions.map(s => ({ id: s.id, startedAt: s.startTime.toISOString(), site: s.baustelle?.companyProfileId === requester.companyId ? { id: s.baustelle.id, name: s.baustelle.name } : null })),
      liveSessionsComplete: r._count.sessions <= 2, profileUrl: `/app/admin/workers/${r.id}` }));
    return { ...pageInfo(items, total, input, page.limit),
      identityResolution: input.workerId ? 'exact_id' : query && total > 1 ? 'multiple_candidates_require_clarification' : 'directory_matches',
      caveat: 'Availability is a profile value; a live session is a stored clock-in, not proof of current physical location. Licenses are free text, not verified certificates.' };
  });
}

function plateVariants(query: string) {
  const compact = query.replace(/[\s-]/g, '');
  const al = /^([a-z]{2})(\d{3})([a-z]{2})$/i.exec(compact);
  return [...new Set([query, compact, ...(al ? [`${al[1]} ${al[2]} ${al[3]}`] : [])])];
}
/** Only reads already stored machine/device data; never synchronizes GPS or contacts WanWay. */
export async function adminSearchCompanyFleet(requester: RequesterContext, input: Search & { machineId?: string; active?: boolean } = {}) {
  const page = paging(input), query = searchText(input.query);
  if (!page || query === null || (input.active !== undefined && typeof input.active !== 'boolean')) return failure('INVALID_INPUT', 'Use a bounded fleet search and valid page cursor/limit.');
  return read(requester, 'Machine register and confirmed stored GPS', async (tx, _zone, now) => {
    const where: Prisma.MachineWhereInput = { companyProfileId: requester.companyId,
      ...(input.machineId ? { id: input.machineId } : {}), ...(input.active === undefined ? {} : { isActive: input.active }),
      ...(query ? { OR: [ ...['name', 'nickname', 'model', 'funksioni'].map(field => ({ [field]: { contains: query, mode: 'insensitive' } })), ...plateVariants(query).map(q => ({ targe: { contains: q, mode: 'insensitive' as const } })) ] } : {}) };
    const enabled = process.env.WANWAY_GPS_ENABLED === 'true' && process.env.DEMO_MODE !== 'true' && process.env.APP_ENV !== 'demo';
    const [total, rows] = await Promise.all([
      tx.machine.count({ where }),
      tx.machine.findMany({ where: { AND: [where, page.after] }, orderBy: { id: 'asc' }, take: page.limit + 1,
        select: { id: true, name: true, nickname: true, model: true, targe: true, category: true, funksioni: true, isActive: true,
          patentaEnevojshme: true, tuvDate: true, insuranceDate: true, taxDate: true, transportPermitDate: true, tachographDate: true,
          gpsEnabled: true, lastGpsLat: true, lastGpsLng: true, lastGpsAt: true, updatedAt: true,
          ...(enabled ? { wanwayDevices: { where: { companyProfileId: requester.companyId }, take: 1,
            select: { lat: true, lng: true, reportedAt: true, syncedAt: true, providerStatus: true, available: true } } } : {}) } }),
    ]);
    const items = rows.map(r => {
      const device = enabled && 'wanwayDevices' in r ? (r.wanwayDevices as Array<{ lat: number | null; lng: number | null; reportedAt: Date | null; syncedAt: Date | null; providerStatus: string | null; available: boolean }>)[0] : undefined;
      const lat = device ? device.lat : r.gpsEnabled && r.lastGpsLat !== null ? Number(r.lastGpsLat) : null;
      const lng = device ? device.lng : r.gpsEnabled && r.lastGpsLng !== null ? Number(r.lastGpsLng) : null;
      const at = device ? device.reportedAt : r.gpsEnabled ? r.lastGpsAt : null, synced = device ? device.syncedAt : at;
      const valid = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && at && at.getTime() <= now.getTime() + 60_000;
      const gps = valid ? { lat, lng, reportedAt: at.toISOString(), syncedAt: iso(synced), ageSeconds: Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000)),
        source: device ? 'stored_wanway_device' : 'stored_machine_point', ...freshness(device ? device.available ? device.providerStatus : 'offline' : 'unknown', at, synced, now.getTime()) } : null;
      return { id: r.id, name: r.name, nickname: r.nickname, model: r.model, plate: r.targe, category: r.category,
        function: clipped(r.funksioni), requiredLicense: clipped(r.patentaEnevojshme), active: r.isActive,
        truncatedFields: [ ...(r.funksioni && r.funksioni.length > 300 ? ['function'] : []), ...(r.patentaEnevojshme && r.patentaEnevojshme.length > 300 ? ['requiredLicense'] : []) ],
        recordedExpiryDates: { inspection: iso(r.tuvDate), insurance: iso(r.insuranceDate), tax: iso(r.taxDate), transportPermit: iso(r.transportPermitDate), tachograph: iso(r.tachographDate) },
        updatedAt: iso(r.updatedAt), gps, gpsStatus: gps ? gps.stale ? 'stale_stored_point' : 'recent_stored_point' : 'no_valid_stored_point',
        profileUrl: `/app/admin/machines/${r.id}` };
    });
    return { ...pageInfo(items, total, input, page.limit), identityResolution: input.machineId ? 'exact_id' : query && total > 1 ? 'multiple_candidates_require_clarification' : 'directory_matches',
      caveat: 'GPS is the last stored report, not a live refresh or proof of location now. Null GPS is not proof the machine is offline. No odometer or address is inferred.' };
  });
}

function validDay(value: string) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
const fuelSelect = { id: true, machineId: true, machine: { select: { name: true, nickname: true, targe: true } },
  uploadedByName: true, uploadedAt: true, confirmedAt: true, fueledAt: true, fueledByName: true,
  timeZone: true, receiptTime: true, timeSource: true, stationAddress: true, liters: true, amount: true, currency: true,
  gpsStatus: true, gpsLat: true, gpsLng: true, gpsRecordedAt: true, gpsDeltaSeconds: true, gpsSource: true, gpsResolvedAt: true } as const;
/** Receipt metadata only. File/photo bytes, hashes, provider IDs and raw evidence are never returned. */
export async function adminGetCompanyFuelReceipts(requester: RequesterContext, input: Page & { receiptId?: string; machineId?: string; uploadedByWorkerId?: string; fueledByWorkerId?: string; confirmed?: boolean; from?: string; to?: string; dateBasis?: 'uploaded' | 'fueled'; latest?: boolean } = {}) {
  const page = paging(input);
  if (!page || (input.from && !validDay(input.from)) || (input.to && !validDay(input.to)) || (input.from && input.to && input.from > input.to) || (input.dateBasis && !['uploaded', 'fueled'].includes(input.dateBasis)) || (input.latest !== undefined && typeof input.latest !== 'boolean') || (input.confirmed !== undefined && typeof input.confirmed !== 'boolean') || (input.latest && input.cursor)) return failure('INVALID_INPUT', 'Use valid calendar dates, ordered from/to, uploaded/fueled date basis, and a valid page cursor/limit. Latest selection cannot use a list cursor.');
  return read(requester, 'FuelReceipt stored invoice metadata and captured GPS evidence', async (tx, zone) => {
    const dateBasis = input.dateBasis ?? 'uploaded';
    const period = input.from || input.to ? { ...(input.from ? { gte: midnight(input.from, zone) } : {}), ...(input.to ? { lt: midnight(nextDay(input.to), zone) } : {}) } : undefined;
    const where: Prisma.FuelReceiptWhereInput = { companyProfileId: requester.companyId, machine: { companyProfileId: requester.companyId },
      ...(input.receiptId ? { id: input.receiptId } : {}), ...(input.machineId ? { machineId: input.machineId } : {}),
      ...(input.uploadedByWorkerId ? { uploadedByWorkerId: input.uploadedByWorkerId } : {}),
      ...(input.fueledByWorkerId ? { fueledByWorkerId: input.fueledByWorkerId } : {}),
      ...(input.confirmed === undefined ? {} : { confirmedAt: input.confirmed ? { not: null } : null }),
      ...(period ? { [dateBasis === 'uploaded' ? 'uploadedAt' : 'fueledAt']: period } : {}),
      ...(input.latest && dateBasis === 'fueled' ? { fueledAt: { ...period, not: null } } : {}) };
    const [total, rows, totals] = await Promise.all([
      tx.fuelReceipt.count({ where }),
      tx.fuelReceipt.findMany({ where: { AND: [where, page.after] },
        orderBy: input.latest ? [dateBasis === 'fueled' ? { fueledAt: 'desc' as const } : { uploadedAt: 'desc' as const }, { id: 'desc' }] : { id: 'asc' },
        take: input.latest ? 1 : page.limit + 1, select: fuelSelect }),
      tx.fuelReceipt.groupBy({ by: ['currency'], where, _sum: { liters: true, amount: true }, _count: { _all: true, liters: true, amount: true } }),
    ]);
    const items = rows.map(r => ({ id: r.id, machineId: r.machineId, machineName: r.machine.nickname || r.machine.name, plate: r.machine.targe,
      uploadedBy: r.uploadedByName, uploadedAt: iso(r.uploadedAt), confirmedAt: iso(r.confirmedAt),
      fueledBy: r.fueledByName, fueledAt: iso(r.fueledAt), timeZone: r.timeZone, receiptTime: r.receiptTime, timeSource: r.timeSource,
      stationAddress: clipped(r.stationAddress), liters: r.liters, amount: r.amount, currency: r.currency,
      truncatedFields: r.stationAddress && r.stationAddress.length > 300 ? ['stationAddress'] : [],
      gps: { status: r.gpsStatus, lat: r.gpsLat, lng: r.gpsLng, recordedAt: iso(r.gpsRecordedAt), deltaSeconds: r.gpsDeltaSeconds, source: r.gpsSource, resolvedAt: iso(r.gpsResolvedAt) },
      invoiceUrl: `/api/fuel-receipts/${r.id}` }));
    const selection = input.latest ? { items, totalMatching: total, returned: items.length, complete: total <= 1 && items.length === total, hasMore: total > items.length, nextCursor: null, scope: `latest_matching_${dateBasis}_receipt`, latestBy: dateBasis,
      continuation: 'Latest is a one-row selection, not a history page. Omit latest to list/paginate the matching history.' } : pageInfo(items, total, input, page.limit);
    return { ...selection, dateBasis, actorFilters: { uploadedByWorkerId: input.uploadedByWorkerId ?? null, fueledByWorkerId: input.fueledByWorkerId ?? null }, confirmedOnly: input.confirmed ?? null, period: { from: input.from ?? null, through: input.to ?? null, timeZone: zone },
      totalsScope: 'all_matching_stored_receipts_not_just_this_page',
      totalsByCurrency: totals.map(t => ({ currency: t.currency, receipts: t._count._all, recordedLiters: t._sum.liters, recordedAmount: t._sum.amount,
        missingLiters: t._count._all - t._count.liters, missingAmount: t._count._all - t._count.amount })),
      caveat: 'Missing amount/liters remain unknown; currency groups must not be added together. Uploaded time/uploader are not fueling time/fueling actor. Station address is recorded invoice data; GPS is a captured point at its own timestamp and offset, not an inferred station or proof of exact location at fueling.' };
  });
}

/** Catalog and active assigned-asset counts; not an invented warehouse stock balance. */
export async function adminSearchCompanyInventory(requester: RequesterContext, input: Search & { itemId?: string } = {}) {
  const page = paging(input), query = searchText(input.query);
  if (!page || query === null) return failure('INVALID_INPUT', 'Use a bounded inventory search and valid page cursor/limit.');
  return read(requester, 'CompanyInventoryItem catalog and active worker asset assignments', async tx => {
    const where: Prisma.CompanyInventoryItemWhereInput = { companyProfileId: requester.companyId,
      ...(input.itemId ? { id: input.itemId } : {}), ...(query ? { OR: ['name', 'itemCode', 'barcode'].map(field => ({ [field]: { contains: query, mode: 'insensitive' } })) } : {}) };
    const [total, rows] = await Promise.all([
      tx.companyInventoryItem.count({ where }),
      tx.companyInventoryItem.findMany({ where: { AND: [where, page.after] }, orderBy: { id: 'asc' }, take: page.limit + 1,
        select: { id: true, category: true, itemCode: true, barcode: true, name: true, sizeLabel: true, isActive: true, updatedAt: true,
          _count: { select: { workerAssignments: { where: { status: 'ACTIVE', deletedAt: null, worker: { companyProfileId: requester.companyId } } } } } } }),
    ]);
    return { ...pageInfo(rows.map(r => ({ id: r.id, name: r.name, category: r.category, itemCode: r.itemCode, barcode: r.barcode,
      size: r.sizeLabel, active: r.isActive, updatedAt: iso(r.updatedAt), activeWorkerAssignments: r._count.workerAssignments })), total, input, page.limit),
      caveat: 'These are catalog entries and active recorded assignments, not physical stock quantities or availability. No quantity/condition is inferred from catalog presence.' };
  });
}
