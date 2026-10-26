"use client";

import { divIcon } from "leaflet";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { LocateFixed } from "lucide-react";
import { Circle, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/lib/i18n";
import { checkTreeItemAction } from "../../actions";

const MapAny: any = MapContainer;
const TileAny: any = TileLayer;
const MarkerAny: any = Marker;
const PopupAny: any = Popup;
const CircleAny: any = Circle;
const LayersAny: any = LayersControl;
const BaseLayerAny: any = LayersControl.BaseLayer;

type TreePoint = {
  id: string;
  treeId: string;
  status: "todo" | "done" | "blocked";
  lat: number;
  lng: number;
};

type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
};

function color(status: TreePoint["status"]) {
  if (status === "done") return "#22c55e";
  if (status === "blocked") return "#ef4444";
  return "#eab308";
}

function pinIcon(status: TreePoint["status"], isActive: boolean) {
  const pinColor = isActive ? "#7dd3fc" : color(status);
  const borderColor = isActive ? "#0284c7" : "#ffffff";

  return divIcon({
    className: "",
    iconSize: [24, 30],
    iconAnchor: [12, 28],
    popupAnchor: [0, -28],
    html: `
      <span style="position:relative;display:block;width:24px;height:30px;">
        ${
          isActive
            ? `<span style="
                position:absolute;
                left:1px;
                top:5px;
                width:22px;
                height:22px;
                border-radius:9999px;
                border:2px solid rgba(56,189,248,.65);
                animation:bk-map-pin-pulse 1.45s ease-out infinite;
              "></span>`
            : ""
        }
        <span style="
          position:absolute;
          left:5px;
          top:2px;
          display:block;
          width:15px;
          height:15px;
          border-radius:9999px 9999px 9999px 2px;
          background:${pinColor};
          border:2px solid ${borderColor};
          box-shadow:0 5px 10px rgba(15,23,42,.34),0 1px 2px rgba(15,23,42,.22);
          filter:drop-shadow(0 2px 2px rgba(0,0,0,.18));
          transform:rotate(-45deg);
        ">
          <span style="
            display:block;
            width:4px;
            height:4px;
            margin:3.5px;
            border-radius:9999px;
            background:rgba(255,255,255,.96);
          "></span>
        </span>
      </span>
    `,
  });
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function FitBounds({ points }: { points: TreePoint[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || points.length === 0) return;
    hasFit.current = true;
    const bounds = points.map((p) => [p.lat, p.lng]);
    map.fitBounds(bounds as any, { padding: [42, 42], maxZoom: 19 });
  }, [map, points]);

  return null;
}

function UserLocationLayer({
  location,
  worksiteCenter,
}: {
  location: UserLocation | null;
  worksiteCenter: { lat: number; lng: number };
}) {
  const map = useMap();
  const [pixel, setPixel] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const updatePixel = () => {
      if (!location) {
        setPixel(null);
        return;
      }
      const point = map.latLngToContainerPoint([location.lat, location.lng] as any);
      setPixel({ x: point.x, y: point.y });
    };

    const scheduleUpdate = () => {
      window.requestAnimationFrame(updatePixel);
    };

    scheduleUpdate();
    map.on("move zoom", scheduleUpdate);
    return () => {
      map.off("move zoom", scheduleUpdate);
    };
  }, [location, map]);

  if (!location) return null;

  const farFromSite = distanceMeters(location, worksiteCenter) > 5000;

  return (
    <>
      <CircleAny
        center={[location.lat, location.lng] as any}
        radius={Math.max(location.accuracy, 8)}
        pathOptions={{
          color: "#0284c7",
          fillColor: "#38bdf8",
          fillOpacity: 0.12,
          opacity: 0.3,
          weight: 1,
        }}
      />
      {pixel ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute z-[650]"
          style={{ left: pixel.x, top: pixel.y, translateX: "-50%", translateY: "-50%" }}
          animate={{ scale: [1, 1.28, 1], opacity: [0.95, 0.72, 0.95] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="size-5 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_0_5px_rgba(56,189,248,0.28),0_3px_10px_rgba(15,23,42,0.35)]" />
        </motion.div>
      ) : null}
      {farFromSite ? (
        <div className="absolute bottom-3 left-3 z-[650] rounded-md border bg-background/95 px-3 py-2 text-xs font-medium text-sky-900 shadow">
          {t("workzone.outsideWorkArea")}
        </div>
      ) : null}
    </>
  );
}

function FindMeControl({
  location,
  locationMessage,
}: {
  location: UserLocation | null;
  locationMessage: string | null;
}) {
  const { currentLang } = useLanguage();
  const map = useMap();

  return (
    <div className="absolute right-3 top-20 z-[650] flex max-w-[240px] flex-col items-end gap-2">
      <button
        type="button"
        className="flex size-10 items-center justify-center rounded-md border bg-background/95 text-foreground shadow transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!location}
        title={location ? t("workzone.toMyPosition", currentLang) : t("workzone.gpsNotReady", currentLang)}
        onClick={() => {
          if (location) map.flyTo([location.lat, location.lng] as any, Math.max(map.getZoom(), 18), { duration: 0.8 });
        }}
      >
        <LocateFixed className="size-5" />
      </button>
      {locationMessage ? (
        <div className="rounded-md border bg-background/95 px-3 py-2 text-right text-xs text-muted-foreground shadow">
          {locationMessage}
        </div>
      ) : null}
    </div>
  );
}

function TreeMarker({
  point,
  workerId,
  isActive,
  isLockedByOther,
  onActivate,
  onRelease,
}: {
  point: TreePoint;
  workerId: string;
  isActive: boolean;
  isLockedByOther: boolean;
  onActivate: () => void;
  onRelease: () => void;
}) {
  const markerRef = useRef<any>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isActive) markerRef.current?.openPopup();
  }, [isActive]);

  function closeTree(done: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await checkTreeItemAction({ treeItemId: point.id, workerId, done });
      if (result.ok) {
        onRelease();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <MarkerAny
      ref={markerRef}
      position={[point.lat, point.lng] as any}
      icon={pinIcon(point.status, isActive)}
      opacity={isLockedByOther ? 0.45 : 1}
      eventHandlers={{
        click: () => {
          if (!isLockedByOther) onActivate();
        },
      }}
    >
      {isActive ? (
        <PopupAny closeButton={false} closeOnClick={false} autoClose={false} closeOnEscapeKey={false}>
          <div className="w-56 space-y-3">
            <div>
              <div className="text-sm font-semibold text-sky-800">{t("workzone.editingTree")}</div>
              <div className="mt-1 text-xs text-slate-600">{t("workzone.treeShort")}: {point.treeId}</div>
              <div className="text-xs text-slate-500">{t("workzone.status")}: {point.status}</div>
            </div>
            {message ? <div className="text-xs text-red-600">{message}</div> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                disabled={isPending}
                onClick={() => closeTree(true)}
              >
                {t("workzone.done")}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
                disabled={isPending}
                onClick={() => closeTree(false)}
              >
                {t("workzone.notDone")}
              </button>
            </div>
          </div>
        </PopupAny>
      ) : null}
    </MarkerAny>
  );
}

export function BaustelleMap({
  points,
  userId,
}: {
  points: TreePoint[];
  userId: string;
}) {
  const { currentLang } = useLanguage();
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator ? t("workzone.gpsSearching", currentLang) : t("workzone.gpsUnsupported", currentLang),
  );
  const lastLocationUpdateRef = useRef(0);
  const center = useMemo(() => {
    const p = points[0];
    return p ? ([p.lat, p.lng] as const) : ([52.52, 13.405] as const);
  }, [points]);
  const worksiteCenter = useMemo(
    () => ({
      lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
      lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
    }),
    [points],
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastLocationUpdateRef.current < 8000) return;
        lastLocationUpdateRef.current = now;
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationMessage(null);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage(t("workzone.gpsDenied", currentLang));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationMessage(t("workzone.gpsUnavailable", currentLang));
        } else {
          setLocationMessage(t("workzone.gpsDelayed", currentLang));
        }
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentLang]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("workzone.noGpsCoordinates", currentLang)}</p>;
  }

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-md border">
      <MapAny center={center as any} zoom={16} preferCanvas={points.length > 100} style={{ height: "100%", width: "100%" }}>
        {/* eslint-disable-next-line i18n/no-hardcoded-jsx-text */}
        <style>{`
          @keyframes bk-map-pin-pulse {
            0% { transform: scale(.45); opacity: .72; }
            70% { transform: scale(1.55); opacity: 0; }
            100% { transform: scale(1.55); opacity: 0; }
          }
          .leaflet-control-layers {
            border-radius: 8px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, .16);
            overflow: hidden;
          }
        `}</style>
        <LayersAny position="topright">
          <BaseLayerAny checked name={t("workzone.streets", currentLang)}>
            <TileAny
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayerAny>
          <BaseLayerAny name={t("workzone.satellite", currentLang)}>
            <TileAny
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayerAny>
        </LayersAny>
        <FitBounds points={points} />
        <UserLocationLayer location={userLocation} worksiteCenter={worksiteCenter} />
        <FindMeControl location={userLocation} locationMessage={locationMessage} />
        {points.map((p) => (
          <TreeMarker
            key={p.id}
            point={p}
            workerId={userId}
            isActive={activeTreeId === p.id}
            isLockedByOther={activeTreeId !== null && activeTreeId !== p.id}
            onActivate={() => setActiveTreeId(p.id)}
            onRelease={() => setActiveTreeId(null)}
          />
        ))}
      </MapAny>
    </div>
  );
}
