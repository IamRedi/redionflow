'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import styles from './ProductionHeaderTools.module.css';

/** One transparent group; desktop alerts sit directly beneath the book. */
export function ProductionHeaderTools({ navigation, alerts, book }: { navigation: ReactNode; alerts: ReactNode; book: ReactNode }) {
  const path = usePathname();
  if (!path || !(path === '/workzone' || path.startsWith('/workzone/') || path === '/app' || path.startsWith('/app/'))) return null;
  return <div data-testid="flow-global-tools" className={`${styles.tools} print:hidden`}>
    <div data-testid="flow-mobile-tools" className={styles.navigation}>{navigation}</div>
    {alerts && <div data-testid="flow-header-alerts" className={styles.alerts}>{alerts}</div>}
    {book && <div className={styles.book}>{book}</div>}
  </div>;
}
