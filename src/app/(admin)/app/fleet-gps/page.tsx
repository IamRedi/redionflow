import Link from "next/link";
import { MapPin, Radio, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateDefaultCompany } from "@/lib/db/company";
import { t, type Language } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { findFleetGpsMachines, findOpenMachinePresences, isFleetGpsStoreReady } from "@/lib/workzone/fleet-gps";

function localeForLanguage(lang: Language) {
  if (lang === "en") return "en-US";
  if (lang === "it") return "it-IT";
  if (lang === "sq") return "sq-AL";
  if (lang === "ro") return "ro-RO";
  if (lang === "pl") return "pl-PL";
  return "de-DE";
}

function formatTime(value: Date | null, lang: Language) {
  return value ? value.toLocaleString(localeForLanguage(lang), { dateStyle: "short", timeStyle: "short" }) : "-";
}

function mapsHref(lat: unknown, lng: unknown) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default async function FleetGpsPage() {
  const currentLang = await resolveRequestLanguage();
  const company = await getOrCreateDefaultCompany();
  const storeReady = isFleetGpsStoreReady();
  const [machines, openPresences] = await Promise.all([
    findFleetGpsMachines(company.id),
    findOpenMachinePresences(company.id),
  ]);

  const presenceByMachineId = new Map(openPresences.map((presence) => [presence.machineId, presence]));
  const gpsMachines = machines.filter((machine) => machine.gpsEnabled);
  const liveMachines = gpsMachines.filter((machine) => machine.lastGpsAt);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("admin.fleetGpsHeading", currentLang)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.fleetGpsSubtitle", currentLang)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings">{t("admin.fleetGpsSettings", currentLang)}</Link>
        </Button>
      </div>

      {!company.fleetGpsEnabled ? (
        <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t("admin.fleetGpsDisabled", currentLang)}
        </div>
      ) : null}
      {!storeReady ? (
        <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("admin.fleetGpsStoreNotReady", currentLang)}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Radio className="size-4" />
              {t("admin.fleetGpsMachines", currentLang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{gpsMachines.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="size-4" />
              {t("admin.fleetGpsWithSignal", currentLang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{liveMachines.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Route className="size-4" />
              {t("admin.fleetGpsOnSite", currentLang)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{openPresences.length}</CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-3 border-b px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <div>{t("admin.fleetGpsMachine", currentLang)}</div>
          <div>{t("admin.fleetGpsSite", currentLang)}</div>
          <div>{t("admin.fleetGpsLastSignal", currentLang)}</div>
          <div>{t("admin.fleetGpsDevice", currentLang)}</div>
          <div />
        </div>
        <div className="divide-y">
          {machines.map((machine) => {
            const presence = presenceByMachineId.get(machine.id);
            const href = mapsHref(machine.lastGpsLat, machine.lastGpsLng);
            return (
              <div key={machine.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{machine.nickname ?? machine.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{machine.targe ?? machine.category}</div>
                </div>
                <div className="text-muted-foreground">
                  {presence ? (
                    <Link className="font-medium text-foreground hover:underline" href={`/app/baustellen/${presence.baustelle.id}`}>
                      {presence.baustelle.name}
                    </Link>
                  ) : (
                    "-"
                  )}
                </div>
                <div className="text-muted-foreground">{formatTime(machine.lastGpsAt, currentLang)}</div>
                <div className="truncate text-muted-foreground">{machine.gpsDeviceId ?? "-"}</div>
                <div className="flex justify-end gap-2">
                  {href ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={href} target="_blank" rel="noreferrer">
                        <MapPin className="size-4" />
                        {t("admin.fleetGpsMap", currentLang)}
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/fleet-gps/${machine.id}`}>{t("admin.fleetGpsRoute", currentLang)}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/machines/${machine.id}`}>{t("common.edit", currentLang)}</Link>
                  </Button>
                </div>
              </div>
            );
          })}
          {machines.length === 0 ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("admin.fleetGpsEmptyMachines", currentLang)}</div> : null}
        </div>
      </div>
    </div>
  );
}
