import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { t, type Language } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { findFleetGpsMachine, findMachineGpsPoints, findMachinePresences, isFleetGpsStoreReady } from "@/lib/workzone/fleet-gps";

function localeForLanguage(lang: Language) {
  if (lang === "en") return "en-US";
  if (lang === "it") return "it-IT";
  if (lang === "sq") return "sq-AL";
  if (lang === "ro") return "ro-RO";
  if (lang === "pl") return "pl-PL";
  return "de-DE";
}

function formatTime(value: Date | null, lang: Language) {
  return value ? value.toLocaleString(localeForLanguage(lang), { dateStyle: "short", timeStyle: "medium" }) : "-";
}

function mapsHref(lat: unknown, lng: unknown) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default async function FleetGpsMachinePage({ params }: { params: Promise<{ machineId: string }> }) {
  const currentLang = await resolveRequestLanguage();
  const company = await getOrCreateDefaultCompany();
  const { machineId } = await params;
  const machine = await findFleetGpsMachine(company.id, machineId);
  if (!machine) notFound();
  const storeReady = isFleetGpsStoreReady();

  const [points, presences] = await Promise.all([
    findMachineGpsPoints(machine.id),
    findMachinePresences(machine.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/app/fleet-gps">
              <ArrowLeft className="size-4" />
              {t("admin.fleetGpsBack", currentLang)}
            </Link>
          </Button>
          <h1 className="mt-2 text-xl font-semibold">{machine.nickname ?? machine.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {machine.targe ?? machine.category} - {t("admin.fleetGpsLastSignal", currentLang)} {formatTime(machine.lastGpsAt, currentLang)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/machines/${machine.id}`}>{t("admin.fleetGpsConfigure", currentLang)}</Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        {!storeReady ? (
          <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground lg:col-span-2">
            {t("admin.fleetGpsStoreNotReady", currentLang)}
          </div>
        ) : null}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t("admin.fleetGpsPresence", currentLang)}</h2>
          </div>
          <div className="divide-y">
            {presences.map((presence) => (
              <div key={presence.id} className="px-4 py-3 text-sm">
                <div className="font-medium">
                  <Link href={`/app/baustellen/${presence.baustelle.id}`} className="hover:underline">
                    {presence.baustelle.name}
                  </Link>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatTime(presence.enteredAt, currentLang)} - {presence.leftAt ? formatTime(presence.leftAt, currentLang) : t("admin.fleetGpsLive", currentLang)}
                  {presence.durationMinutes != null ? ` - ${presence.durationMinutes} min` : ""}
                  {` - ${presence.routePointCount} ${t("admin.fleetGpsPoints", currentLang)}`}
                </div>
              </div>
            ))}
            {presences.length === 0 ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("admin.fleetGpsNoPresence", currentLang)}</div> : null}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t("admin.fleetGpsRecentPoints", currentLang)}</h2>
          </div>
          <div className="divide-y">
            {points.map((point) => {
              const href = mapsHref(point.lat, point.lng);
              return (
                <div key={point.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{formatTime(point.recordedAt, currentLang)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {point.lat.toString()}, {point.lng.toString()}
                      {point.baustelle ? ` - ${point.baustelle.name}` : ""}
                      {point.accuracyMeters != null ? ` - +/-${point.accuracyMeters.toString()} m` : ""}
                    </div>
                  </div>
                  {href ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={href} target="_blank" rel="noreferrer">
                        <MapPin className="size-4" />
                        {t("admin.fleetGpsMap", currentLang)}
                      </a>
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {points.length === 0 ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("admin.fleetGpsNoPoints", currentLang)}</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
