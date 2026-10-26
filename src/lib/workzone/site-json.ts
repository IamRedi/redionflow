/**
 * Typed readers for the free-form JSON columns on sites and tree items
 * (`coordinates`, `activeEquipmentStatus`, `siteEquipmentStatus`). Prisma
 * types these as `JsonValue`, so every read narrows from `unknown` here
 * instead of casting at the call site.
 */

export type EquipmentCategory = "SIGN" | "PLATE" | "FENCE";

export type LatLng = { lat: number; lng: number };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts `{ lat, lng }` as well as the legacy `{ latitude, longitude }` shape. */
export function readLatLng(value: unknown): LatLng | null {
  if (!isRecord(value)) return null;
  const lat = typeof value.lat === "number" ? value.lat : typeof value.latitude === "number" ? value.latitude : null;
  const lng = typeof value.lng === "number" ? value.lng : typeof value.longitude === "number" ? value.longitude : null;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function quantityOf(row: unknown): number {
  if (!isRecord(row)) return 0;
  const qty = Number(row.quantity ?? 0);
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}

export function equipmentQuantity(value: unknown, category: EquipmentCategory): number {
  if (!isRecord(value)) return 0;
  return quantityOf(value[category]);
}

/** True when any equipment entry in the status map has a positive quantity. */
export function hasEquipmentOnSite(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).some((row) => quantityOf(row) > 0);
}
