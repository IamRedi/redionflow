import { workshopDay } from "./demo-model";

/** Read-only projection of the existing tenant Machine inspection dates. */
export type FleetInspectionRow = { machineId?: string; plate: string; hu: string | null; sp: string | null; uvv: string | null };
export type FleetInspectionState = "ok" | "due" | "expired" | "unknown";
export function fleetInspectionState(date: string | null | undefined, now: string): FleetInspectionState {
  if (!date || !Number.isFinite(Date.parse(date))) return "unknown";
  const due = workshopDay(date), today = workshopDay(now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && due !== date) return "unknown";
  // Compare Berlin calendar days, including today, without DST/hour rounding.
  const days = (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return days < 0 ? "expired" : days <= 30 ? "due" : "ok";
}
export function fleetInspectionFor(rows: readonly FleetInspectionRow[], plate?: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
  if (!plate?.trim()) return undefined;
  const matches = rows.filter(row => normalize(row.plate) === normalize(plate));
  return matches.length === 1 ? matches[0] : undefined;
}
