'use client';

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export type MapFleetName = { id: string; name: string; plate: string | null };
const MapFleet = createContext<{ vehicles: MapFleetName[]; mapMode: boolean; setMapMode: Dispatch<SetStateAction<boolean>> } | null>(null);

/** Reuse the scoped fleet already loaded by the layout; pass names only. */
export function WorkzoneMapFleet({ vehicles, children }: { vehicles: MapFleetName[]; children: ReactNode }) {
  const [mapMode, setMapMode] = useState(false);
  return <MapFleet.Provider value={{ vehicles, mapMode, setMapMode }}>{children}</MapFleet.Provider>;
}
export const useMapFleet = () => useContext(MapFleet)?.vehicles ?? null;
export const useWorkzoneMapMode = () => useContext(MapFleet)?.mapMode ?? false;
export const useSetWorkzoneMapMode = () => useContext(MapFleet)?.setMapMode;
