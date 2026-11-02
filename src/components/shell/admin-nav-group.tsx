"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/ui/cn";
import { AdminNavLink } from "@/components/shell/admin-nav-link";

type AdminNavGroupItem = {
  href: string;
  label: string;
  activePrefixes?: string[];
};

type AdminNavGroupProps = {
  title: string;
  items: AdminNavGroupItem[];
};

function itemIsActive(pathname: string, item: AdminNavGroupItem) {
  return (
    pathname === item.href ||
    (item.activePrefixes ?? []).some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith(`${item.href}/`)
  );
}

export function AdminNavGroup({ title, items }: AdminNavGroupProps) {
  const pathname = usePathname();
  const hasActiveItem = items.some((item) => itemIsActive(pathname, item));
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const open = hasActiveItem || manuallyOpen;

  return (
    <div>
      <button
        type="button"
        onClick={() => setManuallyOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-[13px] font-medium text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <span>{title}</span>
        <ChevronDown className={cn("size-4 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <AdminNavLink
                href={item.href}
                label={item.label}
                activePrefixes={item.activePrefixes}
                onNavigate={() => setManuallyOpen(false)}
                inset
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
