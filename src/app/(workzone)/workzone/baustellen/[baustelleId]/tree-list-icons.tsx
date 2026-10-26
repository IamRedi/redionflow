"use client";

import { type ReactNode } from "react";

import { t } from "@/lib/i18n";

export function BauzaunIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M5 25V7M27 25V7M11 25V9M17 25V9M23 25V9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 10H28M4 16H28M4 22H28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 22L12 16L6 10M12 22L18 16L12 10M18 22L24 16L18 10M24 22L28 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function HaltverbotIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="white" stroke="#dc2626" strokeWidth="4" />
      <path d="M10 10L22 22M22 10L10 22" stroke="#dc2626" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function ConeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 4L7 26H25L16 4Z" fill="#f97316" stroke="#c2410c" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.2 13H19.8M10.2 18H21.8M8.6 23H23.4" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 26H27" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function EquipmentIndicator({
  label,
  active,
  requested,
  children,
  lang,
}: {
  label: string;
  active: number;
  requested?: boolean;
  children: ReactNode;
  lang: string;
}) {
  if (active <= 0 && !requested) return null;
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border px-1.5 text-[11px] font-semibold ${
        active > 0
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-200"
      }`}
      title={active > 0 ? `${label}: ${active} ${t("workzone.onSite", lang)}` : `${label}: ${t("workzone.requested", lang)}`}
    >
      {children}
      {active > 0 ? <span>{active}</span> : <span>?</span>}
    </span>
  );
}
