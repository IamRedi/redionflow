"use client";

import { PlanNoteButton } from "./plan/plan-note-button";
import { motion } from "framer-motion";
import { LayoutDashboard, Map, MapPin, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { HubsteigerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SteelSiteArt } from "@/components/steel/steel-art";
import { SteelSiteScene } from "@/components/steel/steel-site-scene";
import { AssetPhoto } from "@/components/asset-photo";
import { t } from "@/lib/i18n";
import type { FleetLocation } from "@/lib/fleet/location";
import { WorkzoneMapIndex, type MissionMapFocus } from "./workzone-map-index";
import mapStyles from "./workzone-map-index.module.css";
import { useMapFleet, useSetWorkzoneMapMode } from "./workzone-map-fleet";
import { isSteelSiteType, type SteelSiteShape } from "@/lib/workzone/steel-phases";
import { WorkingControls } from "./baustellen/[baustelleId]/working-controls";
import { LiveWorkerNames } from "./live-worker-names";
import { orderWorkzoneSites } from "@/lib/workzone/site-order";

type MissionItem = {
  id: string;
  name: string;
  status: string;
  type: string;
  pct: number;
  done: number;
  total: number;
  workers: string[];
  haltCount: number;
  equipmentIndicators: Array<{ key: string; label: string; icon: string; qty: number }>;
  activeLiveCount: number;
  coordinates: { lat: number; lng: number } | null;
  canvasX: number | null;
  canvasY: number | null;
  canvasMobileX: number | null;
  canvasMobileY: number | null;
  liveSince: string | null;
  standortAddress: string;
  shape?: SteelSiteShape;
  photoUrl?: string | null;
  canEditPhoto?:boolean;
  material?: { ready: number; total: number };
  pendingSiteTask?: string | null;
  /** Today's note from the saved daily plan. */
  planNote?: string | null;
  /** False for Bazë workers without access here: no "Open", start/stop on the card instead. */
  canOpen?: boolean;
};

type CardWork = {
  worker: { id: string; firstName: string; lastName: string; isTemporary: boolean; level: string; companyProfileId: string };
  activeSession: { startTime: string; baustelleId: string | null } | null;
};

type CanvasViewport = "desktop" | "mobile";
type CanvasPositions = Record<string, { x: number; y: number }>;
type SavedCanvasLayout = {
  signature: string;
  positionsByViewport: Record<CanvasViewport, CanvasPositions>;
};

const CANVAS_LAYOUT_STORAGE_KEY = "workzone:mission-control-canvas:v4";

const WorkzoneMissionMap = dynamic(
  () => import("./workzone-mission-map").then((module) => module.WorkzoneMissionMap),
  { ssr: false },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function canvasSignature(items: MissionItem[]) {
  return orderedCanvasItems(items)
    .map((item) => `${item.id}:${item.liveSince ?? "idle"}`)
    .join("|");
}

function orderedCanvasItems(items: MissionItem[]) {
  return orderWorkzoneSites(items);
}

function canvasMetrics(viewport: CanvasViewport, items: MissionItem[]) {
  const count = items.length;
  const mobile = viewport === "mobile";
  // Steel site cards carry a small drawing and a material chip, so they are a bit taller.
  const tall = items.some((item) => isSteelSiteType(item.type)||Boolean(item.photoUrl));
  const columns = mobile ? 2 : count > 9 ? 4 : 3;
  const left = mobile ? 10 : 40;
  const top = mobile ? 58 : 58;
  const columnGap = mobile ? 166 : count > 9 ? 226 : 256;
  // Cards carry badges and a note, so rows need room to avoid overlap.
  const rowGap = tall ? (mobile ? 236 : 232) : mobile ? 252 : 224;
  const cardHeight = tall ? (mobile ? 222 : 216) : mobile ? 236 : 204;
  const rows = Math.max(1, Math.ceil(Math.max(count, 1) / columns));

  return {
    columns,
    left,
    top,
    columnGap,
    rowGap,
    height: top + (rows - 1) * rowGap + cardHeight + 42,
    maxX: left + (columns - 1) * columnGap,
    maxY: top + (rows - 1) * rowGap,
  };
}

function softOffset(index: number, viewport: CanvasViewport) {
  const desktopOffsets = [
    { x: 0, y: 0 },
    { x: 12, y: 14 },
    { x: -10, y: 5 },
    { x: 8, y: 22 },
    { x: -6, y: 12 },
    { x: 14, y: 2 },
  ];
  const mobileOffsets = [
    { x: 0, y: 0 },
    { x: 6, y: 12 },
    { x: -4, y: 8 },
    { x: 5, y: 18 },
  ];
  return viewport === "mobile" ? mobileOffsets[index % mobileOffsets.length] : desktopOffsets[index % desktopOffsets.length];
}

function autoCanvasLayout(items: MissionItem[], viewport: CanvasViewport): CanvasPositions {
  const metrics = canvasMetrics(viewport, items);
  return Object.fromEntries(
    orderedCanvasItems(items).map((item, index) => {
      const column = index % metrics.columns;
      const row = Math.floor(index / metrics.columns);
      const offset = softOffset(index, viewport);
      return [
        item.id,
        {
          x: clamp(metrics.left + column * metrics.columnGap + offset.x, 10, metrics.maxX),
          y: clamp(metrics.top + row * metrics.rowGap + offset.y, 10, metrics.maxY),
        },
      ];
    }),
  );
}

function autoLayouts(items: MissionItem[]): Record<CanvasViewport, CanvasPositions> {
  return {
    desktop: autoCanvasLayout(items, "desktop"),
    mobile: autoCanvasLayout(items, "mobile"),
  };
}

function sameCanvasPositions(a: CanvasPositions, b: CanvasPositions) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key]?.x === b[key]?.x && a[key]?.y === b[key]?.y);
}

function sameViewportLayouts(a: Record<CanvasViewport, CanvasPositions>, b: Record<CanvasViewport, CanvasPositions>) {
  return sameCanvasPositions(a.desktop, b.desktop) && sameCanvasPositions(a.mobile, b.mobile);
}

function clampCanvasLayout(items: MissionItem[], positions: CanvasPositions, viewport: CanvasViewport, fallbackPositions = autoCanvasLayout(items, viewport)) {
  const metrics = canvasMetrics(viewport, items);
  return Object.fromEntries(
    items.map((item) => {
      const position = positions[item.id] ?? fallbackPositions[item.id] ?? { x: metrics.left, y: metrics.top };
      return [
        item.id,
        {
          x: clamp(position.x, 10, metrics.maxX),
          y: clamp(position.y, 10, metrics.maxY),
        },
      ];
    }),
  );
}

function readSavedCanvasLayout(signature: string): Record<CanvasViewport, CanvasPositions> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CANVAS_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedCanvasLayout>;
    if (parsed.signature !== signature || !parsed.positionsByViewport?.desktop || !parsed.positionsByViewport.mobile) return null;
    return parsed.positionsByViewport;
  } catch {
    return null;
  }
}

function saveCanvasLayout(signature: string, positionsByViewport: Record<CanvasViewport, CanvasPositions>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CANVAS_LAYOUT_STORAGE_KEY, JSON.stringify({ signature, positionsByViewport }));
  } catch {
    // Layout persistence is a convenience; the canvas still works if storage is blocked.
  }
}

function typeIcon(type: string) {
  if (type === "SIGNAGE") return "🚧";
  if (type === "DRAINAGE") return "▤";
  if (type === "WALL") return "▧";
  if (type === "PAVING") return "▦";
  if (type === "PAINTING") return "▰";
  if (type === "RENOVATION") return "◫";
  if (type === "FIBER_TRENCH") return "〰";
  if (type === "FIBER_DRILLING") return "⤳";
  if (type === "FIBER_HOUSE_CONNECTION") return "⌂";
  if (type === "STEEL_WORKSHOP") return "⚒";
  if (type === "STEEL_ASSEMBLY") return "🏗️";
  if (type === "OTHER") return "⬛";
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

function ItemTypeIcon({ type, pct }: { type: string; pct: number }) {
  if (type === "TRUCK_PLATFORM") return <HubsteigerIcon size={24} />;
  return <span className="text-xl">{type === "CLIMBING" ? treeIcon(pct) : typeIcon(type)}</span>;
}

function fallbackAddressUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function typeLabel(type: string, lang: string) {
  if (type === "TRUCK_PLATFORM") return t("workzone.truckPlatformShort", lang);
  if (type === "TRUCK_CRANE") return t("workzone.truckCraneShort", lang);
  if (type === "WATERING") return t("workzone.wateringShort", lang);
  if (type === "EXCAVATOR") return t("workzone.excavatorShort", lang);
  if (type === "SIGNAGE") return t("workzone.signage", lang, "bau");
  if (type === "DRAINAGE") return t("workzone.drainage", lang, "bau");
  if (type === "WALL") return t("workzone.wall", lang, "bau");
  if (type === "PAVING") return t("workzone.paving", lang, "bau");
  if (type === "PAINTING") return t("workzone.painting", lang, "bau");
  if (type === "RENOVATION") return t("workzone.renovation", lang, "bau");
  if (type === "FIBER_TRENCH") return t("workzone.fiberTrench", lang, "bau");
  if (type === "FIBER_DRILLING") return t("workzone.fiberDrilling", lang, "bau");
  if (type === "FIBER_HOUSE_CONNECTION") return t("workzone.fiberHouseConnection", lang, "bau");
  if (type === "STEEL_WORKSHOP") return t("workzone.steelWorkshop", lang, "bau");
  if (type === "STEEL_ASSEMBLY") return t("workzone.steelAssembly", lang, "bau");
  if (type === "OTHER") return t("workzone.otherType", lang, "bau");
  return t("workzone.climbingShort", lang);
}

export function WorkzoneMissionControl({
  items,
  archive,
  defaultAddress,
  toolbar,
  detailHrefBase = "/workzone/baustellen",
  readOnly = false,
  allowCanvasDrag = true,
  allowDetailNavigation = true,
  mode = "baumdienst",
  fleetLocations = [],
  gpsSyncAvailable = false,
  initialMap = false,
  canEditPhotos = false,
  cardWork = null,
  realistic = false,
}: {
  realistic?: boolean;
  cardWork?: CardWork | null;
  items: MissionItem[];
  archive: MissionItem[];
  defaultAddress: string;
  toolbar?: ReactNode;
  detailHrefBase?: string;
  readOnly?: boolean;
  allowCanvasDrag?: boolean;
  allowDetailNavigation?: boolean;
  mode?: import("@/lib/mode-config").CompanyMode;
  fleetLocations?: FleetLocation[];
  gpsSyncAvailable?: boolean;
  initialMap?: boolean;
  canEditPhotos?: boolean;
}) {
  const { currentLang } = useLanguage();
  const mapFleet = useMapFleet();
  const indexVehicles = (mapFleet ?? fleetLocations).map(v => {
    const location = fleetLocations.find(p => p.id === v.id);
    return { id: v.id, name: v.name, plate: v.plate, coordinates: location ? { lat: location.lat, lng: location.lng } : null };
  });
  const [isMapMode, setIsMapMode] = useState(initialMap);
  const setSharedMapMode = useSetWorkzoneMapMode();
  useEffect(() => {
    setSharedMapMode?.(isMapMode);
    return () => setSharedMapMode?.(false);
  }, [isMapMode, setSharedMapMode]);
  const [isCompactCanvas, setIsCompactCanvas] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [mapFocus, setMapFocus] = useState<MissionMapFocus | null>(null);
  const mapFrameRef = useRef<HTMLDivElement>(null);
  function focusOnMap(kind: MissionMapFocus['kind'], id: string) {
    setMapFocus(current => ({ kind, id, request: (current?.request ?? 0) + 1 }));
    if (window.innerWidth < 1024) mapFrameRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  const [addressCoords, setAddressCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const canvasLayoutSignature = useMemo(() => canvasSignature(items), [items]);
  // Restore browser-only saved positions in the effect below, after hydration.
  const [positionsByViewport, setPositionsByViewport] = useState<Record<CanvasViewport, CanvasPositions>>(() => autoLayouts(items));
  const canvasViewport: CanvasViewport = isCompactCanvas ? "mobile" : "desktop";
  const positions = positionsByViewport[canvasViewport];
  const siteListRef = useRef<HTMLDivElement>(null);
  const [cardSizes, setCardSizes] = useState<Record<string, { width: number; height: number }>>({});
  // Presentation only: keep saved positions, but give taller glass cards room.
  // Notes, material badges and worker controls can change a card's real height.
  const displayPositions = useMemo(() => {
    if (!realistic || isCompactCanvas) return positions;
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    const result: CanvasPositions = {};
    const ordered = [...items].sort((a, b) => (positions[a.id]?.y ?? 0) - (positions[b.id]?.y ?? 0) || (positions[a.id]?.x ?? 0) - (positions[b.id]?.x ?? 0));
    for (const item of ordered) {
      const target = positions[item.id] ?? { x: 20, y: 20 };
      const size = cardSizes[item.id] ?? { width: 196, height: 240 };
      let y = target.y;
      // Recheck after moving below a card: a taller card can span several rows.
      for (let pass = 0; pass < placed.length; pass++) {
        const hit = placed.find(card => target.x < card.x + card.width + 12 && target.x + size.width + 12 > card.x && y < card.y + card.height + 14 && y + size.height + 14 > card.y);
        if (!hit) break;
        y = hit.y + hit.height + 14;
      }
      result[item.id] = { x: target.x, y };
      placed.push({ x: target.x, y, ...size });
    }
    return result;
  }, [realistic, isCompactCanvas, positions, items, cardSizes]);
  const canvasHeight = Math.max(canvasMetrics(canvasViewport, items).height, ...(!realistic || isCompactCanvas ? [] : items.map(item => (displayPositions[item.id]?.y ?? 20) + (cardSizes[item.id]?.height ?? 240) + 32)));
  const isBauMode = mode !== "baumdienst";
  // Steel firms get the site panorama (SteelSiteScene) on a plain yard colour; Baumdienst keeps its green field.
  const canvasBackground = isBauMode
    ? isDarkTheme
      ? "linear-gradient(#14171d, #14171d)"
      : "linear-gradient(#e4e1db, #e4e1db)"
    : isDarkTheme
      ? [
          "radial-gradient(circle at 18% 18%, rgba(70, 119, 91, 0.32), transparent 28%)",
          "radial-gradient(circle at 82% 16%, rgba(166, 145, 93, 0.18), transparent 26%)",
          "linear-gradient(135deg, rgba(15, 40, 31, 0.95), rgba(22, 56, 43, 0.86) 46%, rgba(32, 47, 38, 0.94))",
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        ].join(", ")
      : [
          "radial-gradient(circle at 16% 18%, rgba(73, 135, 96, 0.16), transparent 30%)",
          "radial-gradient(circle at 84% 14%, rgba(217, 184, 112, 0.22), transparent 28%)",
          "radial-gradient(circle at 52% 92%, rgba(116, 148, 126, 0.12), transparent 34%)",
          "linear-gradient(135deg, rgba(251, 247, 236, 0.98), rgba(238, 232, 214, 0.92) 48%, rgba(226, 235, 224, 0.88))",
          "linear-gradient(rgba(53, 83, 65, 0.045) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(53, 83, 65, 0.04) 1px, transparent 1px)",
        ].join(", ");
  const canvasBackgroundSize = isBauMode ? "auto" : isDarkTheme ? "auto, auto, auto, 34px 34px, 34px 34px" : "auto, auto, auto, auto, 34px 34px, 34px 34px";
  const mapItems = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          coordinates: item.coordinates ?? addressCoords[item.id] ?? null,
        }))
        .filter((item) => item.coordinates),
    [items, addressCoords],
  );

  useEffect(() => {
    const syncViewportMode = () => {
      const next = window.innerWidth < 1024;
      setIsCompactCanvas((current) => (current === next ? current : next));
    };
    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!realistic || isCompactCanvas || isMapMode || !siteListRef.current) return;
    const cards = Array.from(siteListRef.current.querySelectorAll<HTMLElement>('[data-studio-card-id]'));
    const measure = () => {
      const next = Object.fromEntries(cards.map(card => [card.dataset.studioCardId!, { width: card.offsetWidth, height: card.offsetHeight }]));
      setCardSizes(current => Object.keys(current).length === cards.length && cards.every(card => current[card.dataset.studioCardId!]?.width === card.offsetWidth && current[card.dataset.studioCardId!]?.height === card.offsetHeight) ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [realistic, isCompactCanvas, isMapMode, canvasLayoutSignature]);

  useEffect(() => {
    const saved = readSavedCanvasLayout(canvasLayoutSignature);
    const fallback = autoLayouts(items);
    const next = saved
      ? {
          desktop: clampCanvasLayout(items, saved.desktop, "desktop", fallback.desktop),
          mobile: clampCanvasLayout(items, saved.mobile, "mobile", fallback.mobile),
        }
      : fallback;
    saveCanvasLayout(canvasLayoutSignature, next);
    queueMicrotask(() => {
      setPositionsByViewport((current) => (sameViewportLayouts(current, next) ? current : next));
    });
  }, [canvasLayoutSignature, items]);

  function resetCurrentCanvasLayout() {
    const nextViewportPositions = autoCanvasLayout(items, canvasViewport);
    setPositionsByViewport((prev) => {
      const next = {
        ...prev,
        [canvasViewport]: nextViewportPositions,
      };
      saveCanvasLayout(canvasLayoutSignature, next);
      return next;
    });
  }

  useEffect(() => {
    if (!isMapMode) return;
    const unresolved = items.filter((item) => !item.coordinates && item.standortAddress?.trim() && !addressCoords[item.id]);
    if (unresolved.length === 0) return;

    let active = true;
    const controller = new AbortController();

    async function geocodeOne(item: MissionItem) {
      const query = encodeURIComponent(item.standortAddress.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
        const first = data?.[0];
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (!active) return;
        setAddressCoords((prev) => ({ ...prev, [item.id]: { lat, lng } }));
      } catch {
        // Silent fallback: item stays "No GPS" if geocoding fails.
      }
    }

    void Promise.all(unresolved.map((item) => geocodeOne(item)));
    return () => {
      active = false;
      controller.abort();
    };
  }, [isMapMode, items, addressCoords]);

  return (
    <div className="w-full min-w-0 space-y-4">
      {isMapMode ? (
        <div className={mapStyles.layout} data-testid="workzone-map-layout">
          <div ref={mapFrameRef} className={mapStyles.frame} data-testid="workzone-map-frame">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-14 top-3 z-[500] h-8 w-8 border-border bg-card text-foreground shadow-sm hover:bg-muted"
              onClick={() => setIsMapMode(false)}
              title={t("workzone.planMode", currentLang)}
              aria-label={t("workzone.planMode", currentLang)}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
            </Button>
            {toolbar ? <div className={`${mapStyles.toolbar} absolute right-3 top-3 z-[500] flex items-center gap-1.5`}>{toolbar}</div> : null}
            <WorkzoneMissionMap items={mapItems} vehicles={fleetLocations} isBau={isBauMode} canRefresh={gpsSyncAvailable} focus={mapFocus} onFocusChange={focusOnMap} />
          </div>

          <WorkzoneMapIndex items={items.map(item => ({ id: item.id, name: item.name, standortAddress: item.standortAddress, coordinates: item.coordinates ?? addressCoords[item.id] ?? null }))} vehicles={indexVehicles} focus={mapFocus} onFocus={focusOnMap} />
        </div>
      ) : (
        <div
          data-studio-board={realistic || undefined} className="relative overflow-hidden rounded-xl border border-border bg-muted/40 dark:border-emerald-950/20 dark:bg-[#183428]"
          style={{
            minHeight: canvasHeight,
            backgroundImage: canvasBackground,
            backgroundSize: canvasBackgroundSize,
            contain: "layout paint",
          }}
        >
          {isBauMode ? (
            <>
              {/* A steel site at dusk (dark) or morning (light) along the top, fading into the yard. */}
              <SteelSiteScene dark={isDarkTheme} className="pointer-events-none absolute inset-x-0 top-0 h-[520px] w-full opacity-60 dark:opacity-80 lg:h-[600px]" />
              <div data-studio-legacy-fade className="pointer-events-none absolute inset-x-0 top-[360px] h-[240px] bg-gradient-to-b from-transparent to-[#e4e1db] dark:to-[#14171d] lg:top-[420px]" />
            </>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.34),transparent_34%,rgba(31,72,50,0.06)_64%,transparent),radial-gradient(ellipse_at_center,transparent_42%,rgba(87,69,40,0.10))] dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_34%,rgba(82,135,97,0.08)_64%,transparent),radial-gradient(ellipse_at_center,transparent_44%,rgba(0,0,0,0.24))]" />
              <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(30deg,transparent_0_47%,rgba(67,100,78,0.09)_48%_52%,transparent_53%_100%)] [background-size:180px_180px] dark:opacity-35 dark:[background-image:linear-gradient(30deg,transparent_0_47%,rgba(190,210,179,0.08)_48%_52%,transparent_53%_100%)]" />
            </>
          )}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
            {!readOnly || allowCanvasDrag ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/25 bg-black/25 text-white shadow-sm hover:bg-black/35 hover:text-white"
                onClick={resetCurrentCanvasLayout}
                title={t("workzone.reflowPlayground", currentLang)}
                aria-label={t("workzone.reflowPlayground", currentLang)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 border-white/25 bg-black/25 text-white shadow-sm hover:bg-black/35 hover:text-white"
              onClick={() => setIsMapMode(true)}
              title={t("workzone.mapMode", currentLang)}
              aria-label={t("workzone.mapMode", currentLang)}
            >
              <Map className="h-3.5 w-3.5" />
            </Button>
          </div>
          {toolbar ? <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">{toolbar}</div> : null}
          <div ref={siteListRef} data-studio-site-list={realistic || undefined}>{orderedCanvasItems(items).map((item) => {
            const hasCover=isSteelSiteType(item.type)||Boolean(item.photoUrl);
            const target = displayPositions[item.id] ?? { x: 20, y: 20 };
            const standort = item.standortAddress || defaultAddress;
            return (
              <motion.div
                key={item.id}
                initial={realistic ? false : undefined}
                data-studio-site-card={realistic || undefined}
                data-studio-card-id={realistic ? item.id : undefined}
                drag={(!realistic || !isCompactCanvas) && (!readOnly || allowCanvasDrag)}
                dragMomentum={false}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  if (readOnly && !allowCanvasDrag) return;
                  const current = positions[item.id] ?? { x: 20, y: 20 };
                  const { maxX, maxY } = canvasMetrics(canvasViewport, items);
                  const next = {
                    x: clamp(Math.round(current.x + info.offset.x), 10, maxX),
                    y: clamp(Math.round(current.y + info.offset.y), 10, maxY),
                  };
                  setPositionsByViewport((prev) => {
                    const nextPositions = {
                      ...prev,
                      [canvasViewport]: {
                        ...prev[canvasViewport],
                        [item.id]: next,
                      },
                    };
                    saveCanvasLayout(canvasLayoutSignature, nextPositions);
                    return nextPositions;
                  });
                }}
                animate={{
                  x: target.x,
                  y: !realistic && item.activeLiveCount > 0 ? [target.y, target.y - 5, target.y] : target.y,
                }}
                transition={{
                  x: { duration: 0.25, ease: "easeOut" },
                  y: !realistic && item.activeLiveCount > 0 ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25, ease: "easeOut" },
                }}
                className={`absolute rounded-xl border bg-card/95 p-2.5 shadow-md ${isCompactCanvas ? "w-[148px]" : "w-[196px]"} ${hasCover ? "overflow-hidden pt-0" : ""}`}
              >
                {hasCover ? (
                  <div data-studio-card-media className={`relative -mx-2.5 mb-2 border-b ${isCompactCanvas ? "h-14" : "h-20"}`}>
                    <AssetPhoto key={`${item.id}:${item.photoUrl}`} kind="site" id={item.id} src={item.photoUrl} alt={item.name} canEdit={(item.canEditPhoto??canEditPhotos)&&!readOnly}>
                    {isSteelSiteType(item.type)?<SteelSiteArt type={item.type} shape={item.shape} pct={item.pct} live={item.activeLiveCount > 0} className="absolute inset-0 h-full w-full" />:<span/>}
                    </AssetPhoto>
                    <span className="absolute bottom-1.5 left-2 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {typeLabel(item.type, currentLang)}
                    </span>
                  </div>
                ) : null}
                {!hasCover&&(item.canEditPhoto??canEditPhotos)&&!readOnly&&<AssetPhoto kind="site" id={item.id} alt={item.name} canEdit className="absolute right-1 top-1 h-10 w-10"><span/></AssetPhoto>}
                <div className={`flex items-center justify-between gap-2 ${hasCover ? "hidden" : ""}`}>
                  <ItemTypeIcon type={item.type} pct={item.pct} />
                  <div className={`flex flex-wrap items-center justify-end gap-1 ${isCompactCanvas ? "max-w-[88px]" : "max-w-[150px]"}`}>
                    {item.equipmentIndicators.slice(0, 3).map((indicator) => (
                      <span
                        key={indicator.key}
                        className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200"
                        title={`${indicator.label}: ${indicator.qty} ${t("common.location", currentLang)}`}
                      >
                        {indicator.icon} {indicator.qty}
                      </span>
                    ))}
                    <span className={`h-2.5 w-2.5 rounded-full ${item.activeLiveCount > 0 ? "animate-pulse bg-green-500" : "bg-zinc-400"}`} />
                  </div>
                </div>
                <p className={`mt-1 ${isCompactCanvas ? "line-clamp-2 text-[12px] leading-4" : "truncate text-sm"} font-semibold`}>{item.name}</p>
                {item.workers.length > 0 ? <LiveWorkerNames names={item.workers} max={isCompactCanvas ? 2 : 3} /> : <p className="text-[11px] text-muted-foreground">{t("workzone.noLiveWorkers", currentLang)}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.done}/{item.total} ({item.pct}%)
                </p>
                {isSteelSiteType(item.type) ? (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ${item.pct >= 100 ? "bg-emerald-500" : "bg-orange-500"}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                ) : null}
                {item.material && item.material.total > 0 ? (
                  <p
                    className={`mt-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                      item.material.ready === item.material.total
                        ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300"
                        : "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                    }`}
                  >
                    ⚒ {t("factory.cardMaterial", currentLang).replace("{ready}", String(item.material.ready)).replace("{total}", String(item.material.total))}
                  </p>
                ) : null}
                {item.haltCount > 0 ? <p className="text-[11px] font-semibold text-red-500">🅿️🚫 {item.haltCount}</p> : null}
                {item.pendingSiteTask ? (
                  <p className="mt-1 line-clamp-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-200">
                    {t("common.note", currentLang)}: {item.pendingSiteTask}
                  </p>
                ) : null}
                {item.canOpen === false && cardWork && !isSteelSiteType(item.type) ? (
                  <div className="mt-2">
                    <WorkingControls compact baustelleId={item.id} currentWorker={cardWork.worker} activeWorkerIds={[]} activeSession={cardWork.activeSession} />
                  </div>
                ) : null}
                <div className="mt-2 flex items-center gap-1.5">
                  {allowDetailNavigation && item.canOpen !== false ? (
                    <Link href={`${detailHrefBase}/${item.id}`} data-testid="site-card-open"
                      className={`inline-flex flex-1 items-center justify-center rounded-lg bg-orange-600 font-semibold text-white shadow-sm transition hover:bg-orange-700 dark:bg-orange-500 dark:text-slate-950 ${isCompactCanvas ? "h-7 text-[11px]" : "h-8 text-xs"}`}>
                      {t("common.open", currentLang)}
                    </Link>
                  ) : null}
                  <PlanNoteButton note={item.planNote} siteName={item.name} className={isCompactCanvas ? "size-7" : "size-8"} />
                  <a href={fallbackAddressUrl(standort)} target="_blank" rel="noreferrer" title={t("common.location", currentLang)} aria-label={t("common.location", currentLang)}
                    className={`grid shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground transition hover:border-orange-400 hover:text-orange-600 ${isCompactCanvas ? "size-7" : "size-8"} ${allowDetailNavigation && item.canOpen !== false ? "" : "ml-auto"}`}>
                    <MapPin className="size-3.5" aria-hidden />
                  </a>
                </div>
              </motion.div>
            );
          })}</div>
        </div>
      )}

      <div data-studio-surface className="min-w-0 rounded-md border bg-card p-3 [content-visibility:auto] [contain-intrinsic-size:320px]" data-testid="daily-archive">
        <h3 className="text-sm font-semibold">{t("workzone.dailyArchive", currentLang)}</h3>
        <div className="mt-2 min-w-0">
          <table className="w-full table-fixed border-collapse border text-xs">
            <thead>
              <tr className="bg-muted/30">
                <th className="w-[42%] break-words border px-2 py-1 text-left">{t("workzone.newSite", currentLang)}</th>
                <th className="w-[26%] break-words border px-2 py-1 text-left">{t("common.progress", currentLang)}</th>
                <th className="w-[32%] break-words border px-2 py-1 text-left">{t("common.type", currentLang)}</th>
              </tr>
            </thead>
            <tbody>
              {archive.map((item) => (
                <tr key={item.id}>
                  <td className="break-words border px-2 py-1 [overflow-wrap:anywhere]">{item.name}</td>
                  <td className="break-words border px-2 py-1 tabular-nums">{`${item.done}/${item.total} (100%)`}</td>
                  <td className="break-words border px-2 py-1 [overflow-wrap:anywhere]">{typeLabel(item.type, currentLang)}</td>
                </tr>
              ))}
              {archive.length === 0 ? (
                <tr>
                  <td className="border px-2 py-2 text-muted-foreground" colSpan={3}>
                    {t("workzone.noCompletedToday", currentLang)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
