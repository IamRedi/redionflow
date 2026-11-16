'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const HeaderActions = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
  toolsTarget: HTMLDivElement | null;
  setToolsTarget: (target: HTMLDivElement | null) => void;
  fleetWorkspaceTarget: HTMLDivElement | null;
  setFleetWorkspaceTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

/** Keep fleet/dialog state in its workspace while presenting its triggers in the header. */
export function ProductionHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [toolsTarget, setToolsTarget] = useState<HTMLDivElement | null>(null);
  const [fleetWorkspaceTarget, setFleetWorkspaceTarget] = useState<HTMLDivElement | null>(null);
  return <HeaderActions.Provider value={{ target, setTarget, toolsTarget, setToolsTarget, fleetWorkspaceTarget, setFleetWorkspaceTarget }}>{children}</HeaderActions.Provider>;
}

/** A route-mounted target, using the same controller as the established fleet. */
export function MusterFleetWorkspaceSlot({ loadingLabel }: { loadingLabel: string }) {
  const slot = useContext(HeaderActions);
  return <div ref={slot?.setFleetWorkspaceTarget} id="muster-fleet-workspace" data-testid="muster-fleet-workspace" className="flex min-h-0 min-w-0 flex-1 flex-col"><p data-fleet-mount-placeholder role="status" className="text-sm">{loadingLabel}</p></div>;
}

export function useFleetWorkspaceTarget() {
  return useContext(HeaderActions)?.fleetWorkspaceTarget ?? null;
}

/** Normal-flow destination below the team, without a floating hit area over it. */
export function ProductionHeaderToolsSlot({ inline = false }: { inline?: boolean } = {}) {
  const slot = useContext(HeaderActions);
  return <div ref={slot?.setToolsTarget} data-testid="flow-tools-row" className={inline ? "pointer-events-none ml-auto flex min-h-11 min-w-0 justify-end" : "pointer-events-none col-span-2 row-start-2 -mx-3 flex min-h-11 min-w-0 justify-end lg:col-span-1 lg:col-start-2 lg:mx-0"} />;
}

export function useProductionHeaderToolsTarget() {
  return useContext(HeaderActions)?.toolsTarget ?? null;
}

export function ProductionHeaderActionsSlot({ className }: { className: string }) {
  const slot = useContext(HeaderActions);
  return <div ref={slot?.setTarget} className={className} data-testid="flow-header-fleet-actions" />;
}

export function ProductionHeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderActions);
  return slot?.target ? createPortal(children, slot.target) : null;
}
