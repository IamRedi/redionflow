import { withTenantContext } from '@/lib/db/tenant-context';
import { freshness } from './wanway/adapter';
import { wanwayEnabled } from './wanway/service';
import { fleetActor } from './access';

export type FleetLocation = {
  id: string;
  name: string;
  plate: string | null;
  lat: number;
  lng: number;
  reportedAt: string;
  syncedAt: string | null;
  online: boolean;
  stale: boolean;
};

/** Confirmed machine locations only; no provider identifiers, keys or route data. */
export async function readFleetLocations(): Promise<FleetLocation[]> {
  const a = await fleetActor();
  return withTenantContext(a.companyId, async (tx) => {
    const machines = await tx.machine.findMany({
      where: { companyProfileId: a.companyId, isActive: true },
      select: {
        id: true,
        name: true,
        nickname: true,
        targe: true,
        gpsEnabled: true,
        lastGpsLat: true,
        lastGpsLng: true,
        lastGpsAt: true,
      },
    });
    const devices = wanwayEnabled()
      ? await tx.wanwayDevice.findMany({
          where: { companyProfileId: a.companyId, machineId: { not: null } },
          select: {
            machineId: true,
            lat: true,
            lng: true,
            reportedAt: true,
            syncedAt: true,
            providerStatus: true,
            available: true,
          },
        })
      : [];
    return machines.flatMap((m) => {
      const d = devices.find((d) => d.machineId === m.id);
      const lat = d
        ? d.lat
        : m.gpsEnabled && m.lastGpsLat !== null
          ? Number(m.lastGpsLat)
          : null;
      const lng = d
        ? d.lng
        : m.gpsEnabled && m.lastGpsLng !== null
          ? Number(m.lastGpsLng)
          : null;
      const at = d ? d.reportedAt : m.gpsEnabled ? m.lastGpsAt : null;
      if (
        lat === null ||
        lng === null ||
        !at ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180 ||
        at.getTime() > Date.now() + 60_000
      )
        return [];
      const synced = d ? d.syncedAt : at;
      const state = freshness(
        d ? (d.available ? d.providerStatus : 'offline') : 'unknown',
        at,
        synced,
      );
      return [
        {
          id: m.id,
          name: m.nickname || m.name,
          plate: m.targe,
          lat,
          lng,
          reportedAt: at.toISOString(),
          syncedAt: synced?.toISOString() ?? null,
          ...state,
        },
      ];
    });
  });
}
