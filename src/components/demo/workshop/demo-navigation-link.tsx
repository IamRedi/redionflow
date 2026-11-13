"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/** Active location comes from the existing route, never a second navigation store. */
export function DemoNavigationLink({ href, label, children, className, preserveWorkshopScope = false }: { href: string; label: string; children: ReactNode; className: string; preserveWorkshopScope?: boolean }) {
  const pathname = usePathname(), params = useSearchParams();
  const [path, query] = href.split("?");
  const tab = new URLSearchParams(query).get("tab");
  const active = pathname === path && (tab ? params.get("tab") === tab : path !== "/demo/workshop" || !params.get("tab") || params.get("tab") === "orders");
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const item = link.current, nav = item?.closest<HTMLElement>("[data-demo-navigation]");
    if (!active || !item || !nav) return;
    const a = item.getBoundingClientRect(), b = nav.getBoundingClientRect();
    if (a.left < b.left || a.right > b.right) nav.scrollBy({ left: a.left - b.left - (b.width - a.width) / 2 });
  }, [active]);
  const target = new URLSearchParams(query);
  if (preserveWorkshopScope && pathname === "/demo/workshop") for (const key of ["asset", "site", "worker"]) { const value = params.get(key); if (value) target.set(key, value); }
  const scopedHref = target.size ? `${path}?${target}` : path;
  return <Link ref={link} href={scopedHref} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={className}>{children}</Link>;
}
