"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/ui/cn";

type AdminNavLinkProps = {
  href: string;
  label: string;
  activePrefixes?: string[];
  inset?: boolean;
  onNavigate?: () => void;
};

export function AdminNavLink({ href, label, activePrefixes = [], inset = false, onNavigate }: AdminNavLinkProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href ||
    activePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    (href !== "/app/admin" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "block rounded-xl border bg-background/80 px-3 py-2 text-[13px] leading-5 font-medium text-foreground/90 shadow-sm backdrop-blur transition hover:bg-muted hover:text-foreground",
        inset ? "ml-2" : "",
        isActive ? "border-foreground/20 bg-foreground text-background shadow-none hover:bg-foreground hover:text-background" : "",
      )}
    >
      {label}
    </Link>
  );
}
