"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, Map, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { HubsteigerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

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
  pendingSiteTask?: string | null;
};

type CanvasViewport = "desktop" | "mobile";
type CanvasPositions = Record<string, { x: number; y: number }>;
type SavedCanvasLayout = {
  signature: string;
  positionsByViewport: Record<CanvasViewport, CanvasPositions>;
};

const CANVAS_LAYOUT_STORAGE_KEY = "workzone:mission-control-canvas:v2";

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
  return [...items].sort((a, b) => {
    const aLiveTime = a.liveSince ? Date.parse(a.liveSince) : 0;
    const bLiveTime = b.liveSince ? Date.parse(b.liveSince) : 0;
    const liveTimeDelta = bLiveTime - aLiveTime;
    if (liveTimeDelta !== 0) return liveTimeDelta;
    const activeDelta = Number(b.status === "active") - Number(a.status === "active");
    if (activeDelta !== 0) return activeDelta;
    const liveDelta = b.activeLiveCount - a.activeLiveCount;
    if (liveDelta !== 0) return liveDelta;
    return a.name.localeCompare(b.name, "de");
  });
}

function canvasMetrics(viewport: CanvasViewport, count: number) {
  const mobile = viewport === "mobile";
  const columns = mobile ? 2 : count > 9 ? 4 : 3;
  const left = mobile ? 10 : 40;
  const top = mobile ? 58 : 58;
  const columnGap = mobile ? 166 : count > 9 ? 250 : 285;
  const rowGap = mobile ? 206 : 192;
  const cardHeight = mobile ? 188 : 172;
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
  const metrics = canvasMetrics(viewport, items.length);
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
  const metrics = canvasMetrics(viewport, items.length);
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
}: {
  items: MissionItem[];
  archive: MissionItem[];
  defaultAddress: string;
  toolbar?: ReactNode;
  detailHrefBase?: string;
  readOnly?: boolean;
  allowCanvasDrag?: boolean;
  allowDetailNavigation?: boolean;
  mode?: import("@/lib/mode-config").CompanyMode;
}) {
  const { currentLang } = useLanguage();
  const [isMapMode, setIsMapMode] = useState(false);
  const [isCompactCanvas, setIsCompactCanvas] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [focusBaustelleId, setFocusBaustelleId] = useState<string | null>(null);
  const [addressCoords, setAddressCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const canvasLayoutSignature = useMemo(() => canvasSignature(items), [items]);
  const [positionsByViewport, setPositionsByViewport] = useState<Record<CanvasViewport, CanvasPositions>>(() => readSavedCanvasLayout(canvasSignature(items)) ?? autoLayouts(items));
  const canvasViewport: CanvasViewport = isCompactCanvas ? "mobile" : "desktop";
  const positions = positionsByViewport[canvasViewport];
  const canvasHeight = canvasMetrics(canvasViewport, items.length).height;
  const isBauMode = mode !== "baumdienst";
  const canvasBackground = isDarkTheme
    ? isBauMode
      ? [
          // Neutral concrete grey with a subtle safety-orange top-left tint
          "radial-gradient(circle at 18% 18%, rgba(255, 132, 40, 0.10), transparent 28%)",
          "radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.03), transparent 26%)",
          "linear-gradient(135deg, rgba(28, 28, 30, 0.96), rgba(38, 38, 40, 0.88) 46%, rgba(46, 46, 48, 0.94))",
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        ].join(", ")
      : [
          "radial-gradient(circle at 18% 18%, rgba(70, 119, 91, 0.32), transparent 28%)",
          "radial-gradient(circle at 82% 16%, rgba(166, 145, 93, 0.18), transparent 26%)",
          "linear-gradient(135deg, rgba(15, 40, 31, 0.95), rgba(22, 56, 43, 0.86) 46%, rgba(32, 47, 38, 0.94))",
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        ].join(", ")
    : isBauMode
      ? [
          // Light concrete grey with safety orange highlight
          "radial-gradient(circle at 16% 18%, rgba(255, 132, 40, 0.10), transparent 30%)",
          "radial-gradient(circle at 84% 14%, rgba(100, 100, 105, 0.10), transparent 28%)",
          "radial-gradient(circle at 52% 92%, rgba(120, 120, 125, 0.08), transparent 34%)",
          "linear-gradient(135deg, rgba(240, 240, 242, 0.98), rgba(228, 228, 232, 0.92) 48%, rgba(220, 220, 224, 0.88))",
          "linear-gradient(rgba(80, 80, 85, 0.045) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(80, 80, 85, 0.04) 1px, transparent 1px)",
        ].join(", ")
      : [
          "radial-gradient(circle at 16% 18%, rgba(73, 135, 96, 0.16), transparent 30%)",
          "radial-gradient(circle at 84% 14%, rgba(217, 184, 112, 0.22), transparent 28%)",
          "radial-gradient(circle at 52% 92%, rgba(116, 148, 126, 0.12), transparent 34%)",
          "linear-gradient(135deg, rgba(251, 247, 236, 0.98), rgba(238, 232, 214, 0.92) 48%, rgba(226, 235, 224, 0.88))",
          "linear-gradient(rgba(53, 83, 65, 0.045) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(53, 83, 65, 0.04) 1px, transparent 1px)",
        ].join(", ");
  const canvasBackgroundSize = isDarkTheme ? "auto, auto, auto, 34px 34px, 34px 34px" : "auto, auto, auto, auto, 34px 34px, 34px 34px";
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
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="relative h-[680px] overflow-hidden rounded-xl border">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-14 top-3 z-[500] h-8 w-8 border-background/80 bg-background/88 shadow-sm backdrop-blur hover:bg-background"
              onClick={() => setIsMapMode(false)}
              title={t("workzone.planMode", currentLang)}
              aria-label={t("workzone.planMode", currentLang)}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
            </Button>
            {toolbar ? <div className="absolute right-3 top-3 z-[500] flex items-center gap-1.5">{toolbar}</div> : null}
            <WorkzoneMissionMap items={mapItems} focusId={focusBaustelleId} onFocusChange={setFocusBaustelleId} />
          </div>

          <div className="rounded-xl border bg-card p-3">
            <h3 className="text-sm font-semibold">{t("workzone.jumpToSite", currentLang)}</h3>
            <div className="mt-2 space-y-2">
              {items.map((item) => {
                const standort = item.standortAddress || defaultAddress;
                const resolvedCoords = item.coordinates ?? addressCoords[item.id] ?? null;
                return (
                  <div key={item.id} className="rounded-md border p-2">
                    <p className="truncate text-xs font-semibold">{item.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{resolvedCoords ? t("workzone.gpsOk", currentLang) : t("workzone.noGps", currentLang)}</p>
                    <div className="mt-1 flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        disabled={!resolvedCoords}
                        onClick={() => setFocusBaustelleId(item.id)}
                      >
                        {t("workzone.zoom", currentLang)}
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                        <a href={fallbackAddressUrl(standort)} target="_blank" rel="noreferrer">
                          {t("common.location", currentLang)}
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-xl border border-border bg-muted/40 dark:border-emerald-950/20 dark:bg-[#183428]"
          style={{
            minHeight: canvasHeight,
            backgroundImage: canvasBackground,
            backgroundSize: canvasBackgroundSize,
            contain: "layout paint",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.34),transparent_34%,rgba(31,72,50,0.06)_64%,transparent),radial-gradient(ellipse_at_center,transparent_42%,rgba(87,69,40,0.10))] dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_34%,rgba(82,135,97,0.08)_64%,transparent),radial-gradient(ellipse_at_center,transparent_44%,rgba(0,0,0,0.24))]" />
          <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(30deg,transparent_0_47%,rgba(67,100,78,0.09)_48%_52%,transparent_53%_100%)] [background-size:180px_180px] dark:opacity-35 dark:[background-image:linear-gradient(30deg,transparent_0_47%,rgba(190,210,179,0.08)_48%_52%,transparent_53%_100%)]" />
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
          {items.map((item) => {
            const target = positions[item.id] ?? { x: 20, y: 20 };
            const standort = item.standortAddress || defaultAddress;
            return (
              <motion.div
                key={item.id}
                drag={!readOnly || allowCanvasDrag}
                dragMomentum={false}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  if (readOnly && !allowCanvasDrag) return;
                  const current = positions[item.id] ?? { x: 20, y: 20 };
                  const { maxX, maxY } = canvasMetrics(canvasViewport, items.length);
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
                  y: item.activeLiveCount > 0 ? [target.y, target.y - 5, target.y] : target.y,
                }}
                transition={{
                  x: { duration: 0.25, ease: "easeOut" },
                  y: item.activeLiveCount > 0 ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25, ease: "easeOut" },
                }}
                className={`absolute rounded-xl border bg-card/95 p-3 shadow-md ${isCompactCanvas ? "w-[148px]" : "w-[210px]"}`}
              >
                <div className="flex items-center justify-between gap-2">
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
                {item.workers.length > 0 ? <p className="truncate text-[11px] text-green-600">{item.workers.join(", ")}</p> : <p className="text-[11px] text-muted-foreground">{t("workzone.noLiveWorkers", currentLang)}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.done}/{item.total} ({item.pct}%)
                </p>
                {item.haltCount > 0 ? <p className="text-[11px] font-semibold text-red-500">🅿️🚫 {item.haltCount}</p> : null}
                {item.pendingSiteTask ? (
                  <p className="mt-1 line-clamp-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-200">
                    {t("common.note", currentLang)}: {item.pendingSiteTask}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-1">
                  {allowDetailNavigation ? (
                    <Button asChild size="sm" variant="outline" className={`text-[11px] ${isCompactCanvas ? "h-6 px-1.5" : "h-7 px-2"}`}>
                      <Link href={`${detailHrefBase}/${item.id}`}>{t("common.open", currentLang)}</Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="outline" className={`text-[11px] ${isCompactCanvas ? "h-6 px-1.5" : "h-7 px-2"}`}>
                    <a href={fallbackAddressUrl(standort)} target="_blank" rel="noreferrer">
                      {t("common.location", currentLang)}
                    </a>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="rounded-md border bg-card p-3 [content-visibility:auto] [contain-intrinsic-size:320px]">
        <h3 className="text-sm font-semibold">{t("workzone.dailyArchive", currentLang)}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse border text-xs">
            <thead>
              <tr className="bg-muted/30">
                <th className="border px-2 py-1 text-left">{t("workzone.newSite", currentLang)}</th>
                <th className="border px-2 py-1 text-left">{t("common.progress", currentLang)}</th>
                <th className="border px-2 py-1 text-left">{t("common.type", currentLang)}</th>
              </tr>
            </thead>
            <tbody>
              {archive.map((item) => (
                <tr key={item.id}>
                  <td className="border px-2 py-1">{item.name}</td>
                  <td className="border px-2 py-1">{`${item.done}/${item.total} (100%)`}</td>
                  <td className="border px-2 py-1">{typeLabel(item.type, currentLang)}</td>
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
