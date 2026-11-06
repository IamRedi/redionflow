"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { studioMediaUrl, type StudioMediaId } from "@/lib/workshop/studio-media";
import { useLanguage } from "@/components/i18n/language-provider";
import { studioCopy } from "@/lib/workshop/studio-copy";

/** Decorative catalogue artwork is never an uploaded file or proof of condition. */
export function StudioArt({ id, className = "", children, fill = false }: { id: StudioMediaId; className?: string; children?: ReactNode; fill?: boolean }) {
  const [failed, setFailed] = useState(false);
  const { currentLang } = useLanguage(), s = studioCopy(currentLang);
  if (failed) return <>{children}</>;
  return <div className={`${fill ? "absolute inset-0" : "relative"} overflow-hidden rounded-xl bg-[#0c2b35] ${className}`} data-studio-art={id}>
    <Image src={studioMediaUrl(id)} alt="" fill unoptimized sizes="(max-width:640px) 100vw, 420px" className={id.startsWith("equipment-") ? "object-contain" : "object-cover"} onError={() => setFailed(true)} />
    <span title={s.generated} className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-1 text-[10px] font-semibold text-white">{s.aiBadge}</span>
  </div>;
}

/** Original SVG family, using the existing forest palette and 1.7px rounded strokes. */
export function StudioIcon({ kind, className = "" }: { kind: "tree" | "leaf" | "bark" | "flower" | "fleet" | "tools" | "parts" | "documents" | "orders" | "history"; className?: string }) {
  const paths = {
    tree: <><path d="M12 21v-9m0 4-4-3m4 1 4-4" /><path d="M6 15a4 4 0 0 1-2-7 5 5 0 0 1 9-4 4 4 0 0 1 6 5 4 4 0 0 1-1 7" /></>,
    leaf: <><path d="M5 19C1 9 8 3 21 3c0 13-6 20-16 16Z" /><path d="m3 21 12-12m-7 7v-5m3 2h5" /></>,
    bark: <><path d="M6 3h12v18H6zM10 3l-2 6 3 4-2 8m6-18-2 7 3 6-2 5" /><path d="m6 7 3-1m6 12 3-1" /></>,
    flower: <><path d="M12 21v-6m0 4c3 0 5-2 5-4-3 0-5 2-5 4" /><path d="M12 5c-3-5-8 0-5 3-5 1-3 7 1 5 1 5 7 5 8 0 4 2 6-4 1-5 3-3-2-8-5-3Z" /><circle cx="12" cy="9" r="2" /></>,
    fleet: <><path d="M3 5h11v12H3zm11 5h4l3 4v3h-7M6 21v-1m12 1v-1" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M17 11v3h4" /></>,
    tools: <><path d="m5 20 8-8m2-9a5 5 0 0 0-5 7l-8 8 4 4 8-8a5 5 0 0 0 7-5l-4 2-3-3 1-5Z" /></>,
    parts: <><path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v11l9 4 9-4V7M12 11v11m-5-6 2 1m-1-12 9 4" /></>,
    documents: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h4" /><path d="m9 7 1 1" /></>,
    orders: <><path d="M7 5H4v17h16V5h-3M8 3h8v5H8zM8 13l2 2 5-5m-7 9h8" /></>,
    history: <><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6m3-4v6l4 3" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[kind]}</svg>;
}
