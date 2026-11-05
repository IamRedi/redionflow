"use client";

import { forwardRef } from 'react';
import { Truck, Wrench } from 'lucide-react';

const dockButton = 'flex min-h-[56px] w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-border/70 bg-background/75 px-1 py-2 text-[10px] font-bold tracking-wide text-foreground transition hover:border-orange-500/60 hover:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const FleetDock = forwardRef<HTMLButtonElement, {
  fleetLabel: string; workshopLabel: string; onFleet: () => void; onWorkshop: () => void;
}>(({ fleetLabel, workshopLabel, onFleet, onWorkshop }, fleetRef) => <>
  <button ref={fleetRef} type="button" onClick={onFleet} className={dockButton} data-testid="fleet-dock-open" aria-haspopup="dialog">
    <Truck className="size-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
    <span className="max-w-full break-words text-center">{fleetLabel.toLocaleUpperCase()}</span>
  </button>
  <button type="button" onClick={onWorkshop} className={dockButton} data-testid="workshop-dock-open" aria-haspopup="dialog">
    <Wrench className="size-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
    <span className="max-w-full break-words text-center">{workshopLabel.toLocaleUpperCase()}</span>
  </button>
</>);
FleetDock.displayName = 'FleetDock';
