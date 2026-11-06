'use client';

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { AssetOperationalStatus } from '@/lib/company-assets/types';
import { useMachineOperationalStatuses } from '@/components/company-assets/shared';

export type MapFleetName = { id: string; name: string; plate: string | null; operationalStatus?: AssetOperationalStatus | null };
type OperationalStatuses = ReturnType<typeof useMachineOperationalStatuses> & { enabled: boolean };
const MapFleet = createContext<{ vehicles: MapFleetName[]; mapMode: boolean; setMapMode: Dispatch<SetStateAction<boolean>>; operationalStatuses: OperationalStatuses } | null>(null);

/** One scoped batch supplies both the map and the fleet sheet. */
export function WorkzoneMapFleet({ vehicles, statusMachines, enhancedOperations = false, children }: { vehicles: MapFleetName[]; statusMachines?: { id: string; operationalStatus?: AssetOperationalStatus | null }[]; enhancedOperations?: boolean; children: ReactNode }) {
  const [mapMode, setMapMode] = useState(false);
  const statuses = useMachineOperationalStatuses(statusMachines ?? vehicles, enhancedOperations);
  const { reload } = statuses;
  const previousMapMode = useRef(false);
  useEffect(() => {
    const enteringMap = mapMode && !previousMapMode.current;
    previousMapMode.current = mapMode;
    if (enteringMap && enhancedOperations) void reload();
  }, [mapMode, enhancedOperations, reload]);
  return <MapFleet.Provider value={{ vehicles, mapMode, setMapMode, operationalStatuses: { ...statuses, enabled: enhancedOperations } }}>{children}</MapFleet.Provider>;
}
export const useMapFleet = () => useContext(MapFleet)?.vehicles ?? null;
export const useWorkzoneMapMode = () => useContext(MapFleet)?.mapMode ?? false;
export const useSetWorkzoneMapMode = () => useContext(MapFleet)?.setMapMode;
export const useMapOperationalStatuses = () => useContext(MapFleet)?.operationalStatuses ?? null;
