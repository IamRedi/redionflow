"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { workshopSection } from "@/lib/workshop/section-navigation";
import { workshopTabs, type WorkshopTab } from "@/lib/workshop/demo-model";

/** Active location comes from the existing route, never a second navigation store. */
export function DemoNavigationLink({ href, label, children, className, preserveWorkshopScope = false }: { href: string; label: string; children: ReactNode; className: string; preserveWorkshopScope?: boolean }) {
  const pathname = usePathname(), params = useSearchParams();
  const [path, query] = href.split("?");
  const tab = new URLSearchParams(query).get("tab");
  const currentTab = workshopTabs.includes(params.get("tab") as WorkshopTab) ? params.get("tab") as WorkshopTab : "orders";
  const section = workshopSection(currentTab, params.get("section"));
  const active = pathname === path && (path === "/demo/workshop" ? section === (tab || "orders") : true);
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
