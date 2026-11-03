'use client';

import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';

export default function WanwayMap({
  lat,
  lng,
  points,
}: {
  lat: number;
  lng: number;
  points: [number, number][];
}) {
  return (
    <div
      className="h-72 overflow-hidden rounded-lg border"
      aria-label="GPS map"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={[lat, lng]} radius={8} />
        {points.length > 1 && <Polyline positions={points} />}
      </MapContainer>
    </div>
  );
}
