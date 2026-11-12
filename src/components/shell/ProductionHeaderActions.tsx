'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const HeaderActions = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
  toolsTarget: HTMLDivElement | null;
  setToolsTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

/** Keep fleet/dialog state in its workspace while presenting its triggers in the header. */
export function ProductionHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [toolsTarget, setToolsTarget] = useState<HTMLDivElement | null>(null);
  return <HeaderActions.Provider value={{ target, setTarget, toolsTarget, setToolsTarget }}>{children}</HeaderActions.Provider>;
}

/** Normal-flow destination below the team, without a floating hit area over it. */
export function ProductionHeaderToolsSlot() {
  const slot = useContext(HeaderActions);
  return <div ref={slot?.setToolsTarget} data-testid="flow-tools-row" className="pointer-events-none col-span-2 row-start-2 -mx-3 flex min-h-11 min-w-0 justify-end lg:col-span-1 lg:col-start-2 lg:mx-0" />;
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
