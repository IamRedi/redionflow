'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const HeaderActions = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

/** Keep fleet/dialog state in its workspace while presenting its triggers in the header. */
export function ProductionHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <HeaderActions.Provider value={{ target, setTarget }}>{children}</HeaderActions.Provider>;
}

export function ProductionHeaderActionsSlot({ className }: { className: string }) {
  const slot = useContext(HeaderActions);
  return <div ref={slot?.setTarget} className={className} data-testid="flow-header-fleet-actions" />;
}

export function ProductionHeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderActions);
  return slot?.target ? createPortal(children, slot.target) : null;
}
