"use client";

import {
  Building2,
  Circle,
  FolderKanban,
  LayoutDashboard,
  type LucideIcon,
  Satellite,
  ScanBarcode,
  ScrollText,
  Settings,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createElement } from "react";

import { cn } from "@/lib/ui/cn";

/** Icons by route, so server layouts can pass plain hrefs. */
const ICONS: Array<[string, LucideIcon]> = [
  ["/app/dashboard", LayoutDashboard],
  ["/app/admin/inventory", ScanBarcode],
  ["/app/admin", UsersRound],
  ["/app/fleet-gps", Satellite],
  ["/app/safety", ShieldCheck],
  ["/app/baustellen", Building2],
  ["/app/projects", FolderKanban],
  ["/app/machines", Truck],
  ["/app/audit", ScrollText],
  ["/app/settings", Settings],
];

export function adminNavIcon(href: string): LucideIcon {
  return ICONS.find(([prefix]) => href === prefix || href.startsWith(`${prefix}/`))?.[1] ?? Circle;
}

export function adminNavIsActive(pathname: string, href: string, activePrefixes: string[] = []) {
  return (
    pathname === href ||
    activePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    (href !== "/app/admin" && pathname.startsWith(`${href}/`))
  );
}

type AdminNavLinkProps = {
  href: string;
  label: string;
  activePrefixes?: string[];
  inset?: boolean;
  onNavigate?: () => void;
};

export function AdminNavLink({ href, label, activePrefixes = [], inset = false, onNavigate }: AdminNavLinkProps) {
  const pathname = usePathname();
  const isActive = adminNavIsActive(pathname, href, activePrefixes);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 max-md:border max-md:bg-card/70 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground",
        inset ? "ml-3" : "",
        isActive ? "bg-primary/10 text-foreground hover:bg-primary/10" : "",
      )}
    >
      {isActive ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" aria-hidden /> : null}
      {createElement(adminNavIcon(href), {
        className: cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"),
        strokeWidth: 1.8,
        "aria-hidden": true,
      })}
      <span className="truncate">{label}</span>
    </Link>
  );
}
