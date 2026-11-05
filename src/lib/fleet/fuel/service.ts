import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { withTenantContext } from '@/lib/db/tenant-context';
import { safeFileName } from '@/lib/site-files/validate';
import { fleetActor } from '../access';
import { captureFuelGps } from '../wanway/service';
import { receiptImage, readReceiptText } from './ocr';
import { fuelTimeZone, parseFuelClock, receiptClock } from './time';

export class FuelError extends Error {}
const idCheck = /^[a-z0-9]{10,40}$/i;
type Actor = Awaited<ReturnType<typeof fleetActor>>;
const ownerWhere = (a: Actor) => ({
  companyProfileId: a.companyId,
  ...(!a.can.office
    ? {
        OR: [
          { uploadedByWorkerId: a.workerId },
          { fueledByWorkerId: a.workerId },
        ],
      }
    : {}),
});

const select = {
  id: true,
  machineId: true,
  machine: { select: { name: true, nickname: true, targe: true } },
  uploadedByName: true,
  uploadedAt: true,
  confirmedAt: true,
  fueledAt: true,
  fueledByName: true,
  fueledByWorkerId: true,
  fueledByUserId: true,
  timeZone: true,
  receiptTime: true,
  timeSource: true,
  stationAddress: true,
  liters: true,
  amount: true,
  currency: true,
  gpsStatus: true,
  gpsLat: true,
  gpsLng: true,
  gpsRecordedAt: true,
  gpsDeltaSeconds: true,
  gpsSource: true,
  gpsResolvedAt: true,
  gpsEvidence: true,
} as const;

function dto(row: Prisma.FuelReceiptGetPayload<{ select: typeof select }>) {
  const { gpsEvidence, ...rest } = row;
  const times = Array.isArray(gpsEvidence)
    ? gpsEvidence.flatMap((p) =>
        p &&
        typeof p === 'object' &&
        !Array.isArray(p) &&
        typeof p.recordedAt === 'string' &&
        Number.isFinite(Date.parse(p.recordedAt))
          ? [Date.parse(p.recordedAt)]
          : [],
      )
    : [];
  const at = row.fueledAt?.getTime();
  const before = at === undefined ? [] : times.filter((t) => t <= at);
  const after = at === undefined ? [] : times.filter((t) => t >= at);
  const gap =
    before.length && after.length
      ? (Math.min(...after) - Math.max(...before)) / 1000
      : null;
  return {
    ...rest,
    gpsIntervalSeconds: gap && gap > 0 ? gap : null,
    uploadedAt: row.uploadedAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    fueledAt: row.fueledAt?.toISOString() ?? null,
    gpsRecordedAt: row.gpsRecordedAt?.toISOString() ?? null,
    gpsResolvedAt: row.gpsResolvedAt?.toISOString() ?? null,
  };
}
export type FuelReceiptView = ReturnType<typeof dto>;

export async function readFuelLog(machineId?: string) {
  const a = await fleetActor();
  return withTenantContext(a.companyId, async (tx) => {
    const [company, machines, receipts, workers] = await Promise.all([
      tx.companyProfile.findUniqueOrThrow({
        where: { id: a.companyId },
        select: { country: true },
      }),
      tx.machine.findMany({
        where: { companyProfileId: a.companyId, isActive: true },
        select: { id: true, name: true, nickname: true, targe: true },
        orderBy: { name: 'asc' },
      }),
      tx.fuelReceipt.findMany({
        where: { ...ownerWhere(a), ...(machineId ? { machineId } : {}) },
        select,
        orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        take: 61,
      }),
      a.can.office
        ? tx.worker.findMany({
            where: { companyProfileId: a.companyId, status: 'active' },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: 'asc' },
          })
        : Promise.resolve([]),
    ]);
    return {
      machines,
      receipts: receipts.slice(0, 60).map(dto),
      hasMore: receipts.length > 60,
      isOffice: a.can.office,
      workers: workers.map((w) => ({
        id: w.id,
        name: `${w.firstName} ${w.lastName}`.trim(),
      })),
      selfName: a.name,
      timeZone: fuelTimeZone(company.country),
      currency: company.country === 'AL' ? 'ALL' : 'EUR',
    };
  });
}

export async function readOlderFuelReceipts(
  machineId: string | null,
  cursor: { id: string; uploadedAt: string },
) {
  const a = await fleetActor();
  if (
    !idCheck.test(cursor.id) ||
    !Number.isFinite(Date.parse(cursor.uploadedAt)) ||
    (machineId && !idCheck.test(machineId))
  )
    throw new FuelError('INVALID');
  const at = new Date(cursor.uploadedAt);
  const rows = await withTenantContext(a.companyId, (tx) =>
    tx.fuelReceipt.findMany({
      where: {
        AND: [
          ownerWhere(a),
          machineId ? { machineId } : {},
          {
            OR: [
              { uploadedAt: { lt: at } },
              { uploadedAt: at, id: { lt: cursor.id } },
            ],
          },
        ],
      },
      select,
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
      take: 61,
    }),
  );
  return { receipts: rows.slice(0, 60).map(dto), hasMore: rows.length > 60 };
}

/** Upload first; the server's immutable upload time survives OCR and manual entry. */
export async function prepareFuelReceipt(
  machineId: string,
  requestId: string,
  file: File,
) {
  const receivedAt = new Date();
  const a = await fleetActor();
  if (!idCheck.test(machineId) || !/^[a-z0-9-]{20,80}$/i.test(requestId))
    throw new FuelError('INVALID');
  if (!(file instanceof File) || !file.size || file.size > 8_000_000)
    throw new FuelError('FILE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = receiptImage(bytes);
  if (!mime) throw new FuelError('FILE');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const created = await withTenantContext(a.companyId, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fuel-upload:${a.companyId}`}))`;
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyProfileId: a.companyId, isActive: true },
      select: { id: true },
    });
    if (!machine) throw new FuelError('NOT_FOUND');
    const previous = await tx.fuelReceipt.findFirst({
      where: { companyProfileId: a.companyId, requestId },
      select: {
        ...select,
        uploadedByUserId: true,
        uploadedByWorkerId: true,
        sha256: true,
      },
    });
    if (previous) {
      if (
        previous.uploadedByUserId !== a.userId ||
        previous.uploadedByWorkerId !== a.workerId ||
        previous.machineId !== machineId ||
        previous.sha256 !== hash
      )
        throw new FuelError('INVALID');
      return { row: previous, fresh: false };
    }
    const recent = await tx.fuelReceipt.count({
      where: {
        companyProfileId: a.companyId,
        uploadedAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    const day = await tx.fuelReceipt.count({
      where: {
        companyProfileId: a.companyId,
        uploadedAt: { gte: new Date(Date.now() - 86400_000) },
      },
    });
    if (recent >= 5 || day >= 200) throw new FuelError('LIMIT');
    const company = await tx.companyProfile.findUniqueOrThrow({
      where: { id: a.companyId },
      select: { country: true },
    });
    const row = await tx.fuelReceipt.create({
      data: {
        companyProfileId: a.companyId,
        machineId,
        requestId,
        uploadedByUserId: a.userId,
        uploadedByWorkerId: a.workerId,
        uploadedByName: a.name,
        uploadedAt: receivedAt,
        timeZone: fuelTimeZone(company.country),
        currency: company.country === 'AL' ? 'ALL' : 'EUR',
        fileName: safeFileName(file.name),
        mime,
        size: bytes.length,
        data: bytes,
        sha256: hash,
      },
      select,
    });
    return { row, fresh: true };
  });
  if (created.fresh) {
    // One OCR process per application DB at a time. If busy/unavailable, keep
    // the original receipt and let the person enter the invoice clock.
    const clock = await withTenantContext(
      a.companyId,
      async (tx) => {
        const [lock] = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(71401104) AS locked`;
        return lock.locked
          ? receiptClock(await readReceiptText(bytes), created.row.timeZone)
          : null;
      },
      { timeout: 15000 },
    ).catch(() => null);
    if (clock) {
      const row = await withTenantContext(a.companyId, (tx) =>
        tx.fuelReceipt.update({
          where: { id: created.row.id },
          data: { receiptTime: clock },
          select,
        }),
      );
      return dto(row);
    }
  }
  return dto(created.row);
}

export async function confirmFuelReceipt(
  id: string,
  clock: string,
  stationAddress: string,
  liters: number | null,
  amount: number | null,
  utcOffset?: number | null,
  fueledByWorkerId?: string | null,
) {
  const a = await fleetActor();
  if (!a.can.office && fueledByWorkerId && fueledByWorkerId !== a.workerId)
    throw new FuelError('NOT_FOUND');
  let fueledBy = { workerId: a.workerId, userId: a.userId, name: a.name };
  if (a.can.office && fueledByWorkerId) {
    const worker = await withTenantContext(a.companyId, (tx) =>
      tx.worker.findFirst({
        where: {
          id: fueledByWorkerId,
          companyProfileId: a.companyId,
          status: 'active',
        },
        select: { id: true, firstName: true, lastName: true },
      }),
    );
    if (!worker) throw new FuelError('NOT_FOUND');
    fueledBy = {
      workerId: worker.id,
      userId: null,
      name: `${worker.firstName} ${worker.lastName}`.trim(),
    };
  }
  const row = await withTenantContext(a.companyId, (tx) =>
    tx.fuelReceipt.findFirst({ where: { id, ...ownerWhere(a) }, select }),
  );
  if (!row) throw new FuelError('NOT_FOUND');
  const fueledAt = parseFuelClock(clock, row.timeZone, new Date(), utcOffset);
  if (!fueledAt) throw new FuelError('CLOCK');
  const result = await withTenantContext(a.companyId, async (tx) => {
    // Atomic first confirmation. A retry may return the same saved receipt;
    // nobody can silently replace its time, author, file or location evidence.
    const updated = await tx.fuelReceipt.updateMany({
      where: { id, ...ownerWhere(a), confirmedAt: null },
      data: {
        fueledAt,
        confirmedAt: new Date(),
        timeSource: row.receiptTime === clock ? 'receipt' : 'manual',
        fueledByWorkerId: fueledBy.workerId,
        fueledByUserId: fueledBy.userId,
        fueledByName: fueledBy.name,
        stationAddress: stationAddress || null,
        liters,
        amount,
      },
    });
    const saved = await tx.fuelReceipt.findFirstOrThrow({
      where: { id, ...ownerWhere(a) },
      select,
    });
    if (
      !updated.count &&
      (saved.fueledAt?.getTime() !== fueledAt.getTime() ||
        saved.stationAddress !== (stationAddress || null) ||
        saved.liters !== liters ||
        saved.amount !== amount ||
        saved.fueledByWorkerId !== fueledBy.workerId ||
        saved.fueledByUserId !== fueledBy.userId)
    )
      throw new FuelError('IMMUTABLE');
    if (updated.count)
      await tx.auditLog.create({
        data: {
          companyProfileId: a.companyId,
          actorType: a.workerId ? 'WORKER' : 'ADMIN',
          actorId: (a.workerId ?? a.userId)!,
          action: 'fleet.fuel_confirmed',
          payload: { receiptId: id, machineId: row.machineId },
        },
      });
    return { saved, fresh: updated.count > 0 };
  });
  if (result.fresh) await captureFuelGps(id).catch(() => undefined); // Receipt remains saved during a provider outage.
  return readFuelReceipt(id);
}

export async function readFuelReceipt(id: string) {
  const a = await fleetActor();
  const row = await withTenantContext(a.companyId, (tx) =>
    tx.fuelReceipt.findFirst({ where: { id, ...ownerWhere(a) }, select }),
  );
  if (!row) throw new FuelError('NOT_FOUND');
  return dto(row);
}

export async function readFuelFile(id: string) {
  const a = await fleetActor();
  return withTenantContext(a.companyId, (tx) =>
    tx.fuelReceipt.findFirst({
      where: { id, ...ownerWhere(a) },
      select: { data: true, mime: true, fileName: true },
    }),
  );
}
