import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isSaasMode } from "@/lib/saas-config";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { prisma } from "@/lib/db/prisma";
import { resolveFleetIngestTenant } from "@/lib/fleet/ingest-auth";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import {
  createGpsLocationPointSafe,
  findFleetGpsMachine,
  findFleetGpsMachineByDeviceId,
  isFleetGpsStoreReady,
  nearestBaustelleForPoint,
  syncMachineBaustellePresence,
} from "@/lib/workzone/fleet-gps";

const machineGpsSchema = z
  .object({
    machineId: z.string().min(1).optional(),
    deviceId: z.string().min(1).optional(),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    accuracyMeters: z.coerce.number().min(0).max(10000).optional(),
    speedKmh: z.coerce.number().min(0).max(300).optional(),
    headingDeg: z.coerce.number().min(0).max(360).optional(),
    recordedAt: z.string().datetime().optional(),
  })
  .refine((value) => value.machineId || value.deviceId, "machineId or deviceId required");

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? request.headers.get("x-fleet-gps-token") ?? "";
}

export async function POST(request: NextRequest) {
  const parsed = machineGpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid GPS payload." }, { status: 400 });
  }

  const data = parsed.data;
  if (!isFleetGpsStoreReady()) {
    return NextResponse.json({ ok: false, message: "Fleet GPS database is not ready." }, { status: 503 });
  }

  // T-034: resolve the tenant via a per-tenant `FleetIngestToken` (SaaS-safe)
  // or fall back to the legacy `FLEET_GPS_INGEST_TOKEN` env var + default
  // company for dedicated deployments that have not migrated yet.
  const defaultCompanyId = isSaasMode ? undefined : (await getOrCreateDefaultCompany()).id;
  const tenant = await resolveFleetIngestTenant(bearerToken(request), defaultCompanyId);
  if (!tenant) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }
  const companyProfileId = tenant.companyProfileId;

  const machine = data.machineId
    ? await findFleetGpsMachine(companyProfileId, data.machineId)
    : await findFleetGpsMachineByDeviceId(companyProfileId, data.deviceId ?? "");
  if (!machine || !machine.isActive) return NextResponse.json({ ok: false, message: "Machine not found." }, { status: 404 });
  const company = await prisma.companyProfile.findUnique({
    where: { id: companyProfileId },
    select: { fleetGpsEnabled: true },
  });
  if (!company?.fleetGpsEnabled || !machine.gpsEnabled) {
    return NextResponse.json({ ok: false, message: "Fleet GPS is not enabled for this machine." }, { status: 403 });
  }

  const recordedAt = data.recordedAt ? new Date(data.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    return NextResponse.json({ ok: false, message: "Invalid recordedAt." }, { status: 400 });
  }

  const point = { lat: data.lat, lng: data.lng };
  const baustelle = await nearestBaustelleForPoint(machine.companyProfileId, point);

  const createdPoint = await createGpsLocationPointSafe({
    companyProfileId: machine.companyProfileId,
    machineId: machine.id,
    baustelleId: baustelle?.id ?? null,
    source: "MACHINE",
    lat: data.lat,
    lng: data.lng,
    accuracyMeters: data.accuracyMeters,
    speedKmh: data.speedKmh,
    headingDeg: data.headingDeg,
    recordedAt,
  });
  if (!createdPoint) {
    return NextResponse.json({ ok: false, message: "Fleet GPS database is not ready." }, { status: 503 });
  }

  await prisma.machine.update({
    where: { id: machine.id },
    data: {
      lastGpsLat: data.lat,
      lastGpsLng: data.lng,
      lastGpsAt: recordedAt,
    },
  });

  await syncMachineBaustellePresence({
    companyProfileId: machine.companyProfileId,
    machineId: machine.id,
    baustelleId: baustelle?.id ?? null,
    recordedAt,
  });

  notifyRealtimeUpdate("fleet.gps.updated", ["fleet-gps", "machine-sidebar"]);
  return NextResponse.json({ ok: true, machineId: machine.id, baustelleId: baustelle?.id ?? null });
}
