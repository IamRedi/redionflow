import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_BAUSTELLE_GEOFENCE_METERS, isInsideGeofence, presenceDurationMinutes, type GeoPoint } from "./gps-rules";

type OptionalFleetGpsPrisma = typeof prisma & {
  gpsLocationPoint?: any;
  machineBaustellePresence?: any;
};

export type MachinePresenceWithBaustelle = {
  id: string;
  companyProfileId: string;
  machineId: string;
  baustelleId: string;
  source: string;
  enteredAt: Date;
  leftAt: Date | null;
  durationMinutes: number | null;
  routePointCount: number;
  baustelle: { id: string; name: string };
};

export type MachineGpsPointWithBaustelle = {
  id: string;
  lat: { toString(): string };
  lng: { toString(): string };
  accuracyMeters: { toString(): string } | null;
  recordedAt: Date;
  baustelle: { id: string; name: string } | null;
};

export type MachinePresenceForReport = MachinePresenceWithBaustelle & {
  machine: { id: string; name: string; nickname: string | null; targe: string | null };
  baustelle: { id: string; name: string; description?: string | null; coordinates?: unknown };
};

export type FleetGpsMachine = {
  id: string;
  companyProfileId: string;
  name: string;
  category: string;
  nickname: string | null;
  targe: string | null;
  isActive: boolean;
  gpsEnabled: boolean;
  gpsDeviceId: string | null;
  lastGpsLat: { toString(): string } | null;
  lastGpsLng: { toString(): string } | null;
  lastGpsAt: Date | null;
};

function optionalPrisma() {
  return prisma as OptionalFleetGpsPrisma;
}

function isFleetGpsSchemaUnavailable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("GpsLocationPoint") ||
    message.includes("MachineBaustellePresence") ||
    message.includes("machineBaustellePresence") ||
    message.includes("Machine.gpsEnabled") ||
    message.includes("Machine.gpsDeviceId") ||
    message.includes("Machine.lastGps")
  );
}

export function isFleetGpsStoreReady() {
  const db = optionalPrisma();
  return Boolean(db.gpsLocationPoint && db.machineBaustellePresence);
}

export function coordsFromJson(value: unknown): GeoPoint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const lat = Number(record.lat ?? record.latitude);
  const lng = Number(record.lng ?? record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function nearestBaustelleForPoint(companyProfileId: string, point: GeoPoint) {
  const baustellen = await prisma.baustelle.findMany({
    where: { companyProfileId, status: "active" },
    select: { id: true, name: true, coordinates: true },
  });

  return (
    baustellen.find((baustelle) => {
      const center = coordsFromJson(baustelle.coordinates);
      return center ? isInsideGeofence(point, center, DEFAULT_BAUSTELLE_GEOFENCE_METERS) : false;
    }) ?? null
  );
}

const fleetGpsMachineSelect = {
  id: true,
  companyProfileId: true,
  name: true,
  category: true,
  nickname: true,
  targe: true,
  isActive: true,
  gpsEnabled: true,
  gpsDeviceId: true,
  lastGpsLat: true,
  lastGpsLng: true,
  lastGpsAt: true,
} as const;

const fallbackMachineSelect = {
  id: true,
  companyProfileId: true,
  name: true,
  category: true,
  nickname: true,
  targe: true,
  isActive: true,
} as const;

function withGpsDefaults(machine: {
  id: string;
  companyProfileId: string;
  name: string;
  category: string;
  nickname: string | null;
  targe: string | null;
  isActive: boolean;
}): FleetGpsMachine {
  return {
    ...machine,
    gpsEnabled: false,
    gpsDeviceId: null,
    lastGpsLat: null,
    lastGpsLng: null,
    lastGpsAt: null,
  };
}

export async function findFleetGpsMachines(companyProfileId: string): Promise<FleetGpsMachine[]> {
  try {
    return await prisma.machine.findMany({
      where: { companyProfileId, isActive: true },
      orderBy: [{ gpsEnabled: "desc" }, { lastGpsAt: "desc" }, { name: "asc" }],
      select: fleetGpsMachineSelect,
    });
  } catch (error) {
    if (!isFleetGpsSchemaUnavailable(error)) throw error;
    const machines = await prisma.machine.findMany({
      where: { companyProfileId, isActive: true },
      orderBy: [{ name: "asc" }],
      select: fallbackMachineSelect,
    });
    return machines.map(withGpsDefaults);
  }
}

export async function findFleetGpsMachine(companyProfileId: string, machineId: string): Promise<FleetGpsMachine | null> {
  try {
    return await prisma.machine.findFirst({
      where: { id: machineId, companyProfileId },
      select: fleetGpsMachineSelect,
    });
  } catch (error) {
    if (!isFleetGpsSchemaUnavailable(error)) throw error;
    const machine = await prisma.machine.findFirst({
      where: { id: machineId, companyProfileId },
      select: fallbackMachineSelect,
    });
    return machine ? withGpsDefaults(machine) : null;
  }
}

export async function findFleetGpsMachineByDeviceId(companyProfileId: string, deviceId: string): Promise<FleetGpsMachine | null> {
  try {
    return await prisma.machine.findFirst({
      where: { companyProfileId, gpsDeviceId: deviceId },
      select: fleetGpsMachineSelect,
    });
  } catch (error) {
    if (!isFleetGpsSchemaUnavailable(error)) throw error;
    return null;
  }
}

export async function createGpsLocationPointSafe(data: Record<string, unknown>) {
  const delegate = optionalPrisma().gpsLocationPoint;
  if (!delegate) return null;
  try {
    return await delegate.create({ data });
  } catch (error) {
    if (isFleetGpsSchemaUnavailable(error)) return null;
    throw error;
  }
}

export async function findOpenMachinePresences(companyProfileId: string): Promise<MachinePresenceWithBaustelle[]> {
  const delegate = optionalPrisma().machineBaustellePresence;
  if (!delegate) return [];
  try {
    return await delegate.findMany({
      where: { companyProfileId, leftAt: null },
      include: {
        baustelle: { select: { id: true, name: true } },
      },
      orderBy: { enteredAt: "desc" },
    }) as MachinePresenceWithBaustelle[];
  } catch (error) {
    if (isFleetGpsSchemaUnavailable(error)) return [];
    throw error;
  }
}

export async function findMachinePresences(machineId: string): Promise<MachinePresenceWithBaustelle[]> {
  const delegate = optionalPrisma().machineBaustellePresence;
  if (!delegate) return [];
  try {
    return await delegate.findMany({
      where: { machineId },
      include: { baustelle: { select: { id: true, name: true } } },
      orderBy: { enteredAt: "desc" },
      take: 30,
    }) as MachinePresenceWithBaustelle[];
  } catch (error) {
    if (isFleetGpsSchemaUnavailable(error)) return [];
    throw error;
  }
}

export async function findMachineGpsPoints(machineId: string): Promise<MachineGpsPointWithBaustelle[]> {
  const delegate = optionalPrisma().gpsLocationPoint;
  if (!delegate) return [];
  try {
    return await delegate.findMany({
      where: { machineId, source: "MACHINE" },
      include: { baustelle: { select: { id: true, name: true } } },
      orderBy: { recordedAt: "desc" },
      take: 80,
    }) as MachineGpsPointWithBaustelle[];
  } catch (error) {
    if (isFleetGpsSchemaUnavailable(error)) return [];
    throw error;
  }
}

export async function findMachinePresencesForBaustelles(
  baustelleIds: string[],
  start: Date,
  end: Date,
): Promise<MachinePresenceForReport[]> {
  const delegate = optionalPrisma().machineBaustellePresence;
  if (!delegate || baustelleIds.length === 0) return [];
  try {
    return await delegate.findMany({
      where: {
        baustelleId: { in: baustelleIds },
        enteredAt: { lt: end },
        OR: [{ leftAt: null }, { leftAt: { gte: start } }],
      },
      include: {
        baustelle: true,
        machine: { select: { id: true, name: true, nickname: true, targe: true } },
      },
      orderBy: { enteredAt: "asc" },
    }) as MachinePresenceForReport[];
  } catch (error) {
    if (isFleetGpsSchemaUnavailable(error)) return [];
    throw error;
  }
}

export async function syncMachineBaustellePresence(input: {
  companyProfileId: string;
  machineId: string;
  baustelleId: string | null;
  recordedAt: Date;
}) {
  const delegate = optionalPrisma().machineBaustellePresence;
  if (!delegate) return false;

  const openPresence = await delegate.findFirst({
    where: { machineId: input.machineId, leftAt: null },
    orderBy: { enteredAt: "desc" },
  });

  if (input.baustelleId) {
    if (openPresence?.baustelleId === input.baustelleId) {
      await delegate.update({
        where: { id: openPresence.id },
        data: { routePointCount: { increment: 1 } },
      });
      return true;
    }

    const updates = [];
    if (openPresence) {
      updates.push(
        delegate.update({
          where: { id: openPresence.id },
          data: {
            leftAt: input.recordedAt,
            durationMinutes: presenceDurationMinutes(openPresence.enteredAt, input.recordedAt),
          },
        }),
      );
    }
    updates.push(
      delegate.create({
        data: {
          companyProfileId: input.companyProfileId,
          machineId: input.machineId,
          baustelleId: input.baustelleId,
          source: "MACHINE_GPS",
          enteredAt: input.recordedAt,
          routePointCount: 1,
        },
      }),
    );
    await prisma.$transaction(updates);
    return true;
  }

  if (openPresence) {
    await delegate.update({
      where: { id: openPresence.id },
      data: {
        leftAt: input.recordedAt,
        durationMinutes: presenceDurationMinutes(openPresence.enteredAt, input.recordedAt),
      },
    });
  }
  return true;
}
