"use client";

import { forwardRef } from 'react';
import { Truck, Wrench } from 'lucide-react';

const dockButton = 'inline-flex size-[44px] shrink-0 items-center justify-center rounded-full border border-border/70 bg-transparent text-foreground transition hover:border-orange-500/60 hover:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const FleetDock = forwardRef<HTMLButtonElement, {
  fleetLabel: string; workshopLabel: string; onFleet: () => void; onWorkshop: () => void;
}>(({ fleetLabel, workshopLabel, onFleet, onWorkshop }, fleetRef) => <>
  <button ref={fleetRef} type="button" onClick={onFleet} className={dockButton} data-testid="fleet-dock-open" aria-haspopup="dialog" title={fleetLabel} aria-label={fleetLabel}>
    <Truck className="size-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
  </button>
  <button type="button" onClick={onWorkshop} className={dockButton} data-testid="workshop-dock-open" aria-haspopup="dialog" title={workshopLabel} aria-label={workshopLabel}>
    <Wrench className="size-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
  </button>
</>);
FleetDock.displayName = 'FleetDock';
