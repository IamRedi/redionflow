"use client";

import { divIcon } from "leaflet";
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";

type MissionItem = {
  id: string;
  name: string;
  type: string;
  pct: number;
  done: number;
  total: number;
  activeLiveCount: number;
  equipmentIndicators: Array<{ key: string; label: string; icon: string; qty: number }>;
  coordinates: { lat: number; lng: number } | null;
};

const MapAny: any = MapContainer;
const TileAny: any = TileLayer;
const MarkerAny: any = Marker;
const PopupAny: any = Popup;
const LayersAny: any = LayersControl;
const BaseLayerAny: any = LayersControl.BaseLayer;

function typeIcon(type: string) {
  if (type === "WATERING") return "🐘";
  if (type === "EXCAVATOR") return "🚜";
  if (type === "TRUCK_CRANE") return "🏗️";
  if (type === "TRUCK_PLATFORM") return "🚚";
  return "🌳";
}

function treeIcon(pct: number) {
  if (pct >= 70) return "🌳";
  if (pct >= 30) return "🌿";
  return "🪵";
}

function missionMarker(item: MissionItem) {
  const icon = item.type === "CLIMBING" ? treeIcon(item.pct) : typeIcon(item.type);
  const status = item.activeLiveCount > 0 ? "#22c55e" : "#9ca3af";
  const materialDot = item.equipmentIndicators.length > 0
    ? '<span style="position:absolute;right:-5px;top:-5px;min-width:15px;height:15px;border-radius:9999px;background:#f59e0b;border:2px solid #fff;color:#111827;font-size:9px;font-weight:700;line-height:11px;text-align:center;">!</span>'
    : "";
  return divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    html: `<span style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#fff;border:2px solid ${status};box-shadow:0 4px 10px rgba(15,23,42,.25);font-size:16px;">${icon}${materialDot}</span>`,
  });
}

function MapFocusController({
  items,
  focusId,
}: {
  items: MissionItem[];
  focusId: string | null;
}) {
  const map = useMap();
  const withCoords = items.filter((item) => item.coordinates);

  if (withCoords.length > 0) {
    const bounds = withCoords.map((item) => [item.coordinates!.lat, item.coordinates!.lng]);
    map.fitBounds(bounds as any, { padding: [36, 36], maxZoom: 14 });
  }

  if (focusId) {
    const item = items.find((entry) => entry.id === focusId);
    if (item?.coordinates) {
      map.flyTo([item.coordinates.lat, item.coordinates.lng] as any, Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }

  return null;
}

export function WorkzoneMissionMap({
  items,
  focusId,
  onFocusChange,
}: {
  items: MissionItem[];
  focusId: string | null;
  onFocusChange: (id: string | null) => void;
}) {
  const { currentLang } = useLanguage();
  if (items.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("workzone.noMissionMapCoordinates", currentLang)}</div>;
  }

  return (
    <MapAny center={[51.45, 7.0] as any} zoom={10} style={{ width: "100%", height: "100%" }}>
      <LayersAny position="topright">
        <BaseLayerAny checked name={t("workzone.streets", currentLang)}>
          <TileAny attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </BaseLayerAny>
        <BaseLayerAny name={t("workzone.satellite", currentLang)}>
          <TileAny attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        </BaseLayerAny>
      </LayersAny>
      <MapFocusController items={items} focusId={focusId} />
      {items.map((item) => (
        <MarkerAny
          key={item.id}
          position={[item.coordinates!.lat, item.coordinates!.lng] as any}
          icon={missionMarker(item)}
          eventHandlers={{ click: () => onFocusChange(item.id) }}
        >
          <PopupAny>
            <div className="space-y-2 text-xs">
              <p className="font-semibold">{item.name}</p>
              <p>
                {item.done}/{item.total} ({item.pct}%)
              </p>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onFocusChange(item.id)}>
                  {t("workzone.focus", currentLang)}
                </Button>
              </div>
            </div>
          </PopupAny>
        </MarkerAny>
      ))}
    </MapAny>
  );
}
