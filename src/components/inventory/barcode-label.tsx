import { buildCode39Bars, normalizeBarcodeInput } from "@/lib/inventory/barcode";

export function BarcodeLabel({
  value,
  title,
  shortCode,
  compact = false,
}: {
  value: string;
  title: string;
  shortCode?: string | null;
  compact?: boolean;
}) {
  const normalized = normalizeBarcodeInput(value);
  const bars = buildCode39Bars(normalized);
  const width = Math.max(180, bars.reduce((max, bar) => Math.max(max, bar.x + bar.width), 0) + 16);
  const height = compact ? 50 : 64;

  return (
    <div className="rounded-xl border border-black/15 bg-white p-3 text-black">
      <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-black/65">{shortCode || "Inventory"}</div>
      <div className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{title}</div>
      <div className="mt-2 rounded-md border border-black/10 bg-white px-2 py-2">
        {bars.length > 0 ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
            <rect x="0" y="0" width={width} height={height} fill="white" />
            {bars.map((bar, index) => (
              <rect key={`${bar.x}-${index}`} x={bar.x + 8} y="0" width={bar.width} height={height - 14} fill="black" />
            ))}
            <text
              x={width / 2}
              y={height - 2}
              textAnchor="middle"
              fontSize="11"
              letterSpacing="2"
              style={{ fontFamily: "monospace" }}
            >
              {normalized}
            </text>
          </svg>
        ) : (
          <div className="rounded-md border border-dashed border-black/20 px-3 py-5 text-center text-xs">
            {normalized}
          </div>
        )}
      </div>
    </div>
  );
}
