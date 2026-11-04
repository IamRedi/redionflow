'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { divIcon, type LatLngTuple } from 'leaflet';
import {
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import { RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/i18n/language-provider';
import { t } from '@/lib/i18n';
import { fleetCopy } from '@/lib/fleet/copy';
import { fleetTime } from '@/lib/fleet/format';
import type { FleetLocation } from '@/lib/fleet/location';
import { mapsLink } from '@/lib/fleet/location-link';
import { siteMapSymbol } from '@/lib/fleet/map-symbol';
import { wanwayError } from '@/lib/fleet/wanway/copy';
import { refreshFleetAction } from './fleet-actions';

type MissionItem = {
  id: string;
  name: string;
  type: string;
  pct: number;
  done: number;
  total: number;
  activeLiveCount: number;
  equipmentIndicators: Array<{
    key: string;
    label: string;
    icon: string;
    qty: number;
  }>;
  coordinates: { lat: number; lng: number } | null;
};
function marker(symbol: string, color: string) {
  return divIcon({
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
    html: `<span style="display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:#fff;border:3px solid ${color};box-shadow:0 3px 10px #0003;font-size:20px">${symbol}</span>`,
  });
}
function Focus({
  points,
  focus,
}: {
  points: LatLngTuple[];
  focus: LatLngTuple | null;
}) {
  const map = useMap();
  const key = JSON.stringify(points),
    focusKey = JSON.stringify(focus);
  useEffect(() => {
    const coords = JSON.parse(key) as LatLngTuple[];
    if (coords.length)
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 });
  }, [key, map]);
  useEffect(() => {
    const point = JSON.parse(focusKey) as LatLngTuple | null;
    if (point) map.flyTo(point, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [focusKey, map]);
  return null;
}
export function WorkzoneMissionMap({
  items,
  vehicles = [],
  focusId,
  onFocusChange,
  isBau = false,
  canRefresh = false,
}: {
  items: MissionItem[];
  vehicles?: FleetLocation[];
  focusId: string | null;
  onFocusChange: (id: string | null) => void;
  isBau?: boolean;
  canRefresh?: boolean;
}) {
  const { currentLang } = useLanguage();
  const c = fleetCopy(currentLang);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();
  const sites = items.filter((i) => i.coordinates);
  const points: LatLngTuple[] = [
    ...sites.map(
      (i) => [i.coordinates!.lat, i.coordinates!.lng] as LatLngTuple,
    ),
    ...vehicles.map((v) => [v.lat, v.lng] as LatLngTuple),
  ];
  const focused = sites.find((i) => i.id === focusId)?.coordinates;
  return (
    <div className="relative h-full w-full" data-testid="workzone-fleet-map">
      <div className="absolute inset-x-3 top-14 z-[500] flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm">
        <span className="text-xs font-semibold">
          🏗️ {c.sites} {sites.length}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold">
          <Truck className="size-3.5" />
          {c.vehicles} {vehicles.length}
        </span>
        {canRefresh && (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await refreshFleetAction();
                setMessage(
                  result.ok ? '' : wanwayError(result.code, currentLang),
                );
                if (result.ok) router.refresh();
              })
            }
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${pending ? 'animate-spin' : ''}`}
            />
            {c.refresh} {c.gps}
          </button>
        )}
        {message && (
          <p role="status" className="basis-full text-xs text-destructive">
            {message}
          </p>
        )}
      </div>
      <MapContainer
        zoomControl={false}
        center={points[0] ?? [51.45, 7.0]}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomControl position="bottomleft" />
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer
            checked
            name={t('workzone.streets', currentLang)}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={t('workzone.satellite', currentLang)}>
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <Focus
          points={points}
          focus={focused ? [focused.lat, focused.lng] : null}
        />
        {sites.map((item) => (
          <Marker
            key={item.id}
            title={`${c.sites}: ${item.name}`}
            position={[item.coordinates!.lat, item.coordinates!.lng]}
            icon={marker(
              siteMapSymbol(item.type, isBau, item.pct),
              item.activeLiveCount ? '#16a34a' : '#64748b',
            )}
            eventHandlers={{ click: () => onFocusChange(item.id) }}
          >
            <Popup>
              <div className="space-y-2 text-xs">
                <p className="font-semibold">{item.name}</p>
                <p>
                  {item.done}/{item.total} ({item.pct}%)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onFocusChange(item.id)}
                >
                  {t('workzone.focus', currentLang)}
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
        {vehicles.map((v) => (
          <Marker
            key={`vehicle-${v.id}`}
            title={`${c.vehicles}: ${v.plate ?? v.name}`}
            position={[v.lat, v.lng]}
            icon={marker(
              '🚚',
              v.online ? '#16a34a' : v.stale ? '#d97706' : '#64748b',
            )}
          >
            <Popup>
              <div className="min-w-44 space-y-2 text-xs">
                <p className="font-semibold">{v.plate ?? v.name}</p>
                <p>{v.name}</p>
                <p>{v.online ? c.online : v.stale ? c.stale : c.unknown}</p>
                <p>
                  {c.lastReport}:{' '}
                  {fleetTime(v.reportedAt, 'Europe/Berlin', true)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="rounded-lg border px-3 py-2"
                    href={mapsLink(v.lat, v.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {c.maps}
                  </a>
                  <button
                    className="rounded-lg border px-3 py-2"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('fleet:open-machine', {
                          detail: { id: v.id },
                        }),
                      )
                    }
                  >
                    {c.fleet}
                  </button>
                  <Link
                    className="rounded-lg border px-3 py-2"
                    href={`/workzone/fuel?machine=${v.id}`}
                  >
                    {c.fuel}
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!points.length && (
        <p className="absolute bottom-12 left-3 right-3 z-[500] rounded-xl bg-background/95 p-3 text-xs text-muted-foreground">
          {t('workzone.noMissionMapCoordinates', currentLang)}
        </p>
      )}
    </div>
  );
}
