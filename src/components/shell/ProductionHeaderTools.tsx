'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ProductionHeaderActionsSlot, useProductionHeaderToolsTarget } from './ProductionHeaderActions';
import styles from './ProductionHeaderTools.module.css';

/** One transparent group: compact fleet actions join navigation and alerts. */
export function ProductionHeaderTools({ navigation, alerts, book }: { navigation: ReactNode; alerts: ReactNode; book: ReactNode }) {
  const path = usePathname();
  const target = useProductionHeaderToolsTarget();
  if (!target || !path || !(path === '/workzone' || path.startsWith('/workzone/') || path === '/app' || path.startsWith('/app/'))) return null;
  return createPortal(<div data-testid="flow-global-tools" className={`${styles.tools} print:hidden`}>
    <div data-testid="flow-mobile-tools" className={styles.navigation}>{navigation}</div>
    <ProductionHeaderActionsSlot className={styles.assets} />
    {alerts && <div data-testid="flow-header-alerts" className={styles.alerts}>{alerts}</div>}
    {book && <div className={styles.book}>{book}</div>}
  </div>, target);
}
