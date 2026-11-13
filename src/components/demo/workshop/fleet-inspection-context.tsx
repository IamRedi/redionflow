"use client";
import { createContext, useContext, type ReactNode } from "react";
import { fleetInspectionFor, type FleetInspectionRow } from "@/lib/workshop/fleet-inspections";

const FleetInspectionContext = createContext<readonly FleetInspectionRow[]>([]);
/** No store, fetch or mutation: the Muster layout already reads these machines. */
export function FleetInspectionProvider({ rows, children }: { rows: FleetInspectionRow[]; children: ReactNode }) {
  return <FleetInspectionContext.Provider value={rows}>{children}</FleetInspectionContext.Provider>;
}
export function useFleetInspection(plate?: string) {
  return fleetInspectionFor(useContext(FleetInspectionContext), plate);
}
