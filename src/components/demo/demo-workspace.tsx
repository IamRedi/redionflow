"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./demo-workspace.module.css";

function ScrollWorkspace({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const officeScene = pathname === "/demo/offices" || pathname.startsWith("/demo/offices/");
  const workshop = pathname === "/demo/workshop" || pathname === "/demo/wood" || pathname === "/demo/workzone" || pathname.startsWith("/demo/baustellen/");
  const query = useSearchParams().toString();
  const location = `${pathname}?${query}`;
  // Deliberate navigation starts at the top; small saves/refreshes keep position.
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [location]);
  return <main ref={ref} className={`${styles.workspace} ${officeScene ? styles.officeWorkspace : ""} ${workshop ? styles.workshopWorkspace : ""}`} tabIndex={0} data-testid="demo-workspace">{officeScene ? <div className={styles.officeContent}>{children}</div> : workshop ? <div className={styles.workshopContent}>{children}</div> : <div className="flex min-h-full min-w-0 flex-col"><div className="min-w-0 flex-1 px-5 pb-6 pt-4 lg:pr-20 print:max-w-none print:px-0 print:py-0">{children}</div>{footer}</div>}</main>;
}
export function DemoWorkspace({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  // Demo routes already render dynamically (cookies/company data). Rendering the
  // full children as a Suspense fallback duplicated forms during stream handoff.
  return <ScrollWorkspace footer={footer}>{children}</ScrollWorkspace>;
}
