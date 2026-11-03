import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { requireAdminTenant } from '@/lib/auth/authorization';
import { getCurrentAdmin } from '@/lib/auth/admin-session';
import { withTenantContext } from '@/lib/db/tenant-context';
import { encryptionReady, seal, unseal } from './crypto';
import { WanwayAdapter, WanwayError, freshness, telemetry } from './adapter';

export function wanwayEnabled() {
  return (
    process.env.WANWAY_GPS_ENABLED === 'true' &&
    process.env.DEMO_MODE !== 'true' &&
    process.env.APP_ENV !== 'demo'
  );
}
class OperationError extends Error {}
type Tx = Prisma.TransactionClient;
type Actor = { tenant: string; adminId: string };
async function actor(): Promise<Actor> {
  const tenant = await requireAdminTenant();
  const admin = await getCurrentAdmin();
  if (!admin || !wanwayEnabled()) throw new OperationError('DISABLED');
  return { tenant, adminId: admin.id };
}
async function locked<T>(tenant: string, fn: (tx: Tx) => Promise<T>) {
  return withTenantContext(tenant, async (tx) => {
    // Serialize all changes for this tenant across server replicas. No network
    // calls inside transactions; leases below guard the server-to-server work.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wanway:${tenant}`}))`;
    return fn(tx);
  });
}
async function idle(tx: Tx, tenant: string) {
  const row = await tx.wanwayIntegration.findUnique({
    where: { companyProfileId: tenant },
  });
  if (row && row.busyUntil.getTime() > Date.now())
    throw new OperationError('BUSY');
  return row;
}
async function audit(
  tx: Tx,
  a: Actor,
  action: string,
  payload: Prisma.InputJsonObject = {},
) {
  await tx.auditLog.create({
    data: {
      companyProfileId: a.tenant,
      actorType: 'ADMIN',
      actorId: a.adminId,
      action: `wanway.${action}`,
      payload,
    },
  });
}

export async function saveCredentials(
  appid: string,
  key: string,
  approved: boolean,
) {
  const a = await actor();
  if (!approved) throw new OperationError('PRIVACY');
  if (!encryptionReady()) throw new OperationError('KEYRING');
  await locked(a.tenant, async (tx) => {
    const old = await idle(tx, a.tenant);
    if (!key && (!old?.encryptedKey || old.appid !== appid))
      throw new OperationError('KEY_REQUIRED');
    // Replacing an account/key clears discovered private data and bindings.
    // Keep rate-limit state, even across disconnect/reconnect.
    if (key)
      await tx.wanwayDevice.deleteMany({
        where: { companyProfileId: a.tenant },
      });
    const data = {
      appid,
      ...(key ? { encryptedKey: seal(key, a.tenant, 'key') } : {}),
      encryptedToken: null,
      tokenExpiresAt: null,
      status: 'configured',
      lastSuccessfulSync: null,
      lastError: null,
    };
    await tx.wanwayIntegration.upsert({
      where: { companyProfileId: a.tenant },
      create: { companyProfileId: a.tenant, ...data },
      update: data,
    });
    await audit(
      tx,
      a,
      old?.encryptedKey ? 'credentials_updated' : 'credentials_saved',
    );
  });
}

export async function disconnect() {
  const a = await actor();
  await locked(a.tenant, async (tx) => {
    const row = await idle(tx, a.tenant);
    if (!row) return;
    await tx.wanwayDevice.deleteMany({ where: { companyProfileId: a.tenant } });
    await tx.wanwayIntegration.update({
      where: { companyProfileId: a.tenant },
      data: {
        appid: null,
        encryptedKey: null,
        encryptedToken: null,
        tokenExpiresAt: null,
        status: 'disconnected',
        lastSuccessfulSync: null,
        lastError: null,
      },
    });
    await audit(tx, a, 'disconnected');
  });
}

export async function bindDevice(id: string, machineId: string | null) {
  const a = await actor();
  await locked(a.tenant, async (tx) => {
    const integration = await idle(tx, a.tenant);
    if (!integration?.encryptedKey) throw new OperationError('NOT_CONFIGURED');
    const device = await tx.wanwayDevice.findFirst({
      where: { id, companyProfileId: a.tenant, available: true },
    });
    if (!device) throw new OperationError('NOT_FOUND');
    if (machineId) {
      const machine = await tx.machine.findFirst({
        where: { id: machineId, companyProfileId: a.tenant, isActive: true },
        select: { id: true, gpsEnabled: true },
      });
      if (!machine) throw new OperationError('NOT_FOUND');
      // Do not overwrite an existing ingest/provider association.
      if (machine.gpsEnabled) throw new OperationError('OTHER_GPS');
      const existing = await tx.wanwayDevice.findFirst({
        where: { companyProfileId: a.tenant, machineId, id: { not: id } },
        select: { id: true },
      });
      if (existing) throw new OperationError('ALREADY_LINKED');
    }
    await tx.wanwayDevice.updateMany({
      where: { id, companyProfileId: a.tenant },
      data: { machineId },
    });
    await audit(tx, a, 'binding_changed', {
      deviceId: id,
      previousMachineId: device.machineId,
      machineId,
    });
  });
}

async function claim(a: Actor) {
  return locked(a.tenant, async (tx) => {
    const row = await idle(tx, a.tenant);
    if (!row?.appid || !row.encryptedKey)
      throw new OperationError('NOT_CONFIGURED');
    if (row.nextRequestAt.getTime() > Date.now())
      throw new OperationError('COOLDOWN');
    const operationId = randomUUID();
    await tx.wanwayIntegration.update({
      where: { companyProfileId: a.tenant },
      data: {
        operationId,
        busyUntil: new Date(Date.now() + 120_000),
        nextRequestAt: new Date(Date.now() + 60_000),
      },
    });
    return { ...row, operationId };
  });
}

async function operation<T>(
  run: (
    api: WanwayAdapter,
    token: string,
    appid: string,
    a: Actor,
  ) => Promise<(tx: Tx) => Promise<T>>,
) {
  const a = await actor();
  if (!encryptionReady()) throw new OperationError('KEYRING');
  const row = await claim(a);
  try {
    const api = new WanwayAdapter();
    let token: string;
    if (
      row.encryptedToken &&
      row.tokenExpiresAt &&
      row.tokenExpiresAt.getTime() > Date.now()
    )
      token = unseal(row.encryptedToken, a.tenant, 'token');
    else {
      const auth = await api.authenticate(
        row.appid!,
        unseal(row.encryptedKey!, a.tenant, 'key'),
      );
      token = auth.token;
      await locked(a.tenant, async (tx) => {
        const updated = await tx.wanwayIntegration.updateMany({
          where: { companyProfileId: a.tenant, operationId: row.operationId },
          data: {
            encryptedToken: seal(token, a.tenant, 'token'),
            tokenExpiresAt: auth.expiresAt,
          },
        });
        if (updated.count !== 1) throw new OperationError('BUSY');
      });
    }
    const commit = await run(api, token, row.appid!, a);
    return await locked(a.tenant, async (tx) => {
      const current = await tx.wanwayIntegration.findFirst({
        where: { companyProfileId: a.tenant, operationId: row.operationId },
      });
      if (!current) throw new OperationError('BUSY');
      const result = await commit(tx);
      await tx.wanwayIntegration.update({
        where: { companyProfileId: a.tenant },
        data: {
          busyUntil: new Date(0),
          operationId: null,
          lastError: null,
          status: 'connected',
        },
      });
      return result;
    });
  } catch (error) {
    const safe = errorCode(error);
    await locked(a.tenant, (tx) =>
      tx.wanwayIntegration.updateMany({
        where: { companyProfileId: a.tenant, operationId: row.operationId },
        data: {
          busyUntil: new Date(0),
          operationId: null,
          status: 'error',
          lastError: safe,
          ...(error instanceof WanwayError && error.retryAt
            ? {
                nextRequestAt: new Date(
                  Math.max(Date.now() + 60_000, error.retryAt),
                ),
              }
            : {}),
          ...(error instanceof WanwayError &&
          (error.kind === 'PROVIDER' || error.code === 401)
            ? { encryptedToken: null, tokenExpiresAt: null }
            : {}),
        },
      }),
    );
    throw error;
  }
}

export async function syncDevices(testOnly = false) {
  return operation(async (api, token, appid, a) => {
    const devices = await api.devices(token);
    const statuses = testOnly ? [] : await api.statuses(token, appid);
    const byImei = new Map(statuses.map((s) => [s.imei, s]));
    const mapped = testOnly
      ? []
      : await withTenantContext(a.tenant, (tx) =>
          tx.wanwayDevice.findMany({
            where: {
              companyProfileId: a.tenant,
              machineId: { not: null },
              available: true,
            },
            select: { imei: true },
          }),
        );
    const mileage = new Map<string, number | null>();
    const mileageErrors = new Map<string, string>();
    let retryAt = 0;
    for (const d of mapped)
      if (devices.some((found) => found.imei === d.imei)) {
        // Optional mileage permission must not prevent a valid position sync.
        if (retryAt) {
          mileageErrors.set(d.imei, 'COOLDOWN');
          continue;
        }
        try {
          mileage.set(d.imei, await api.mileage(token, d.imei));
        } catch (error) {
          mileageErrors.set(d.imei, errorCode(error));
          if (error instanceof WanwayError && error.retryAt)
            retryAt = error.retryAt;
        }
      }
    return async (tx) => {
      const now = new Date();
      await tx.wanwayDevice.updateMany({
        where: { companyProfileId: a.tenant },
        data: { available: false },
      });
      for (const d of devices) {
        const s = byImei.get(d.imei);
        const snapshot = s
          ? telemetry(s)
          : {
              lat: null,
              lng: null,
              reportedAt: null,
              signalAt: null,
              providerStatus: 'unknown',
              speedKmh: null,
              voltage: null,
              plate: null,
            };
        const data = {
          name: d.deviceName ?? 'GPS',
          model: d.deviceType ?? null,
          available: true,
          ...(!testOnly
            ? {
                ...snapshot,
                syncedAt: now,
                mileage24hKm: mileage.get(d.imei) ?? null,
                mileageAt: mileage.has(d.imei) ? now : null,
                mileageError: mileageErrors.get(d.imei) ?? null,
              }
            : {}),
        };
        await tx.wanwayDevice.upsert({
          where: {
            companyProfileId_imei: { companyProfileId: a.tenant, imei: d.imei },
          },
          create: { companyProfileId: a.tenant, imei: d.imei, ...data },
          update: data,
        });
      }
      if (!testOnly)
        await tx.wanwayIntegration.update({
          where: { companyProfileId: a.tenant },
          data: {
            lastSuccessfulSync: now,
            ...(retryAt
              ? {
                  nextRequestAt: new Date(
                    Math.max(Date.now() + 60_000, retryAt),
                  ),
                }
              : {}),
          },
        });
      await audit(tx, a, testOnly ? 'connection_tested' : 'synced', {
        deviceCount: devices.length,
      });
      return devices.length;
    };
  });
}

export async function loadHistory(id: string) {
  return operation(async (api, token, _appid, a) => {
    const d = await withTenantContext(a.tenant, (tx) =>
      tx.wanwayDevice.findFirst({
        where: {
          id,
          companyProfileId: a.tenant,
          available: true,
          machineId: { not: null },
        },
      }),
    );
    if (!d) throw new OperationError('NOT_FOUND');
    const points = await api.history(token, d.imei);
    return async (tx) => {
      await audit(tx, a, 'history_loaded', {
        deviceId: id,
        pointCount: points.length,
      });
      return { points, fetchedAt: new Date().toISOString() };
    };
  });
}

// Explicit DTO: no encrypted secrets, tokens, SIM/ICCID or full IMEI returned.
export async function readPanel() {
  const a = await actor();
  return withTenantContext(a.tenant, async (tx) => {
    const row = await tx.wanwayIntegration.findUnique({
      where: { companyProfileId: a.tenant },
      select: {
        appid: true,
        status: true,
        lastSuccessfulSync: true,
        lastError: true,
      },
    });
    const devices = await tx.wanwayDevice.findMany({
      where: { companyProfileId: a.tenant },
      select: {
        id: true,
        imei: true,
        name: true,
        model: true,
        machineId: true,
        available: true,
      },
      orderBy: { name: 'asc' },
    });
    const machines = await tx.machine.findMany({
      where: { companyProfileId: a.tenant, isActive: true },
      select: { id: true, name: true, targe: true },
    });
    return {
      appid: row?.appid ?? '',
      status: row?.status ?? 'disconnected',
      lastSuccessfulSync: row?.lastSuccessfulSync?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      keyReady: encryptionReady(),
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name.replaceAll(d.imei, 'GPS'),
        model: d.model,
        machineId: d.machineId,
        available: d.available,
        suffix: d.imei.slice(-4),
      })),
      machines,
    };
  });
}

export async function readFleet(machineId?: string) {
  // Optional module; workers and public demo routes never receive WanWay data.
  if (!wanwayEnabled()) return [];
  const a = await actor();
  return withTenantContext(a.tenant, async (tx) => {
    const devices = await tx.wanwayDevice.findMany({
      where: {
        companyProfileId: a.tenant,
        machineId: machineId ?? { not: null },
        machine: { isActive: true },
      },
      select: {
        id: true,
        machineId: true,
        available: true,
        lat: true,
        lng: true,
        reportedAt: true,
        signalAt: true,
        syncedAt: true,
        providerStatus: true,
        speedKmh: true,
        voltage: true,
        mileage24hKm: true,
        mileageAt: true,
        mileageError: true,
      },
    });
    return devices.map((d) => ({
      ...d,
      ...freshness(
        d.available ? d.providerStatus : 'offline',
        d.reportedAt,
        d.syncedAt,
      ),
      reportedAt: d.reportedAt?.toISOString() ?? null,
      signalAt: d.signalAt?.toISOString() ?? null,
      syncedAt: d.syncedAt?.toISOString() ?? null,
      mileageAt: d.mileageAt?.toISOString() ?? null,
    }));
  });
}

export function errorCode(error: unknown) {
  if (error instanceof OperationError) return error.message;
  if (error instanceof WanwayError) return error.message;
  if (
    error instanceof Error &&
    /^WANWAY_(KEYRING|DECRYPT)$/.test(error.message)
  )
    return 'KEYRING';
  // Do not pass raw Prisma/Zod/network exception text to frontend or logs.
  return 'INTERNAL';
}
