"use client";

import { useEffect, useRef } from "react";
import { divIcon, type LatLngTuple } from "leaflet";
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { workshopCopy } from "@/lib/workshop/copy";
import { siteCardCopy } from "@/lib/workshop/site-card-copy";

export type MusterTreePoint = { id: string; treeId: string; status: string; lat: number; lng: number };
function FitTrees({ points }: { points: MusterTreePoint[] }) {
  const map = useMap(), last = useRef("");
  useEffect(() => {
    const key = points.map(point => `${point.id}:${point.lat}:${point.lng}`).join("|");
    if (key === last.current || !points.length) return;
    last.current = key;
    map.fitBounds(points.map(point => [point.lat, point.lng] as LatLngTuple), { padding: [36, 36], maxZoom: 19 });
  }, [map, points]);
  return null;
}
function TreePopupAction({ treeId, onOpenTree, label }: { treeId: string; onOpenTree: (treeId: string) => void; label: string }) {
  const map = useMap();
  return <Button variant="outline" className="min-h-11" onClick={() => { map.closePopup(); onOpenTree(treeId); }}>{label}</Button>;
}
export function MusterTreeMap({ points, onOpenTree }: { points: MusterTreePoint[]; onOpenTree: (treeId: string) => void }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), copy = siteCardCopy(currentLang);
  if (!points.length) return <p role="status" className="baum-site-empty">{copy.noCoordinates}</p>;
  return <div className="baum-tree-map" data-testid="muster-tree-map">
    <MapContainer center={[points[0].lat, points[0].lng]} zoom={16} style={{ height: "100%", width: "100%" }}>
      <LayersControl position="topright"><LayersControl.BaseLayer checked name={t("workzone.streets", currentLang)}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer><LayersControl.BaseLayer name={t("workzone.satellite", currentLang)}><TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer></LayersControl>
      <FitTrees points={points} />
      {points.map(point => <Marker key={point.id} position={[point.lat, point.lng]} title={point.treeId} alt={point.treeId} icon={divIcon({ className: `baum-tree-pin baum-tree-pin--${point.status === "done" ? "done" : point.status === "blocked" ? "blocked" : "todo"}`, html: '<span aria-hidden="true"></span>', iconSize: [28, 28], iconAnchor: [14, 14] })}>
        <Popup><div className="grid gap-2"><strong>{point.treeId}</strong><TreePopupAction treeId={point.treeId} onOpenTree={onOpenTree} label={c.treeDetails} /></div></Popup>
      </Marker>)}
    </MapContainer>
  </div>;
}
