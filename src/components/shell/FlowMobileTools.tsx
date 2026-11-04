"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Keep operational actions out of public presentations and demo pages. */
export function FlowMobileTools({ children }: { children: ReactNode }) {
  const path = usePathname();
  const operational = path === "/workzone" || path?.startsWith("/workzone/") || path === "/app" || path?.startsWith("/app/");
  return operational ? <div data-testid="flow-mobile-tools" className="flex items-center gap-1.5 lg:hidden">{children}</div> : null;
}
