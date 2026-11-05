"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./demo-workspace.module.css";

const workspaceClass = `${styles.workspace} px-5 pb-6 pt-4 lg:pr-20 print:max-w-none print:px-0 print:py-0`;
function ScrollWorkspace({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const location = `${pathname}?${query}`;
  // Deliberate navigation starts at the top; small saves/refreshes keep position.
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [location]);
  return <main ref={ref} className={workspaceClass} tabIndex={0} data-testid="demo-workspace">{children}</main>;
}
export function DemoWorkspace({ children }: { children: ReactNode }) {
  // Demo routes already render dynamically (cookies/company data). Rendering the
  // full children as a Suspense fallback duplicated forms during stream handoff.
  return <ScrollWorkspace>{children}</ScrollWorkspace>;
}
