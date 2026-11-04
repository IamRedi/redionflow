import Link from 'next/link';
import { Fuel, MapPin, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOrCreateDefaultCompany } from '@/lib/db/company';
import { t } from '@/lib/i18n';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import {
  findFleetGpsMachines,
  findOpenMachinePresences,
  isFleetGpsStoreReady,
} from '@/lib/workzone/fleet-gps';
import { readFleet } from '@/lib/fleet/wanway/service';
import { readFleetLocations } from '@/lib/fleet/location';
import { mapsLink } from '@/lib/fleet/location-link';
import { fleetTime } from '@/lib/fleet/format';
import { fleetCopy } from '@/lib/fleet/copy';
import { WanwayTelemetry } from '@/components/fleet/wanway-telemetry';

export default async function FleetGpsPage() {
  const lang = await resolveRequestLanguage(),
    c = fleetCopy(lang);
  const company = await getOrCreateDefaultCompany();
  const [machines, presences, devices, locations] = await Promise.all([
    findFleetGpsMachines(company.id),
    findOpenMachinePresences(company.id),
    readFleet(),
    readFleetLocations(),
  ]);
  const presenceById = new Map(presences.map((p) => [p.machineId, p]));
  const devicesById = new Map(devices.map((d) => [d.machineId, d]));
  const locationsById = new Map(locations.map((p) => [p.id, p]));
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{c.fleet} · {c.gps}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.fleetGpsSubtitle', lang)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/workzone?view=map">
              <MapPin className="size-4" />
              {c.workzoneMap}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/workzone/fuel">
              <Fuel className="size-4" />
              {c.fuel}
            </Link>
          </Button>
        </div>
      </header>
      {!company.fleetGpsEnabled && !devices.length && (
        <p className="rounded-xl border bg-amber-500/10 p-3 text-sm">
          {t('admin.fleetGpsDisabled', lang)}
        </p>
      )}
      {!isFleetGpsStoreReady() && (
        <p className="rounded-xl border bg-muted p-3 text-sm">
          {t('admin.fleetGpsStoreNotReady', lang)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <span>
          <strong>
            {
              machines.filter((m) => m.gpsEnabled || devicesById.has(m.id))
                .length
            }
          </strong>{' '}
          {t('admin.fleetGpsMachines', lang)}
        </span>
        <span>
          <strong>{locations.filter((p) => p.online).length}</strong>{' '}
          {t('admin.fleetGpsWithSignal', lang)}
        </span>
        <span>
          <strong>{presences.length}</strong> {t('admin.fleetGpsOnSite', lang)}
        </span>
        <Link
          href="/app/settings/integrations/wanway"
          className="ml-auto py-2 underline underline-offset-4"
        >
          {c.settings}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {machines.map((machine) => {
          const device = devicesById.get(machine.id),
            point = locationsById.get(machine.id),
            presence = presenceById.get(machine.id);
          return (
            <article
              key={machine.id}
              className="min-w-0 rounded-2xl border bg-card p-4"
              data-testid="fleet-vehicle-card"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-muted p-3">
                  <Truck className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">
                    {machine.nickname || machine.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {machine.targe || '—'}
                  </p>
                </div>
              </div>
              {device ? (
                <div className="mt-3">
                  <WanwayTelemetry data={device} lang={lang} compact />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {point ? (point.stale ? c.stale : c.lastKnown) : c.noGps}
                </p>
              )}
              {point && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.lastReport}:{' '}
                  {fleetTime(point.reportedAt, 'Europe/Berlin', true)}
                </p>
              )}
              {presence && (
                <Link
                  href={`/app/baustellen/${presence.baustelle.id}`}
                  className="mt-3 block text-sm underline underline-offset-4"
                >
                  {c.sites}: {presence.baustelle.name}
                </Link>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {point && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={mapsLink(point.lat, point.lng)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="size-4" />
                      {c.maps}
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/workzone/fuel?machine=${machine.id}`}>
                    <Fuel className="size-4" />
                    {c.fuel}
                  </Link>
                </Button>
                <details className="ml-auto text-sm">
                  <summary className="cursor-pointer rounded-lg border px-3 py-2">
                    {c.details}
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app/fleet-gps/${machine.id}`}>
                        {t('admin.fleetGpsRoute', lang)}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app/machines/${machine.id}`}>
                        {t('common.edit', lang)}
                      </Link>
                    </Button>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>
      {!machines.length && (
        <p className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
          {t('admin.fleetGpsEmptyMachines', lang)}
        </p>
      )}
    </div>
  );
}
