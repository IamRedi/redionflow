"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/** Active location comes from the existing route, never a second navigation store. */
export function DemoNavigationLink({ href, label, children, className }: { href: string; label: string; children: ReactNode; className: string }) {
  const pathname = usePathname(), params = useSearchParams();
  const [path, query] = href.split("?");
  const tab = new URLSearchParams(query).get("tab");
  const active = pathname === path && (tab ? params.get("tab") === tab : path !== "/demo/workshop" || !params.get("tab") || params.get("tab") === "orders");
  return <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={className}>{children}</Link>;
}
