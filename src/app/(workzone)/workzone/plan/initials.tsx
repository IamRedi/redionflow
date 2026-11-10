import { Truck } from "lucide-react";

/** Initials in a soft coloured circle, so a site card reads like a team, not a spreadsheet row. */
const AVATAR_TONES = ["bg-orange-500/15 text-orange-800 dark:text-orange-200", "bg-sky-500/15 text-sky-800 dark:text-sky-200", "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200", "bg-violet-500/15 text-violet-800 dark:text-violet-200", "bg-rose-500/15 text-rose-800 dark:text-rose-200", "bg-amber-500/15 text-amber-800 dark:text-amber-200"];
export function Initials({ name, machine = false }: { name: string; machine?: boolean }) {
  if (machine) return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300" aria-hidden><Truck className="size-4" /></span>;
  const parts = name.trim().split(/\s+/);
  const letters = `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  let hash = 0; for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${AVATAR_TONES[hash % AVATAR_TONES.length]}`} aria-hidden>{letters || "?"}</span>;
}


/** "Arben Demo" → "Arben D.": fits two per row on a phone; the full name stays in the title. */
export const shortName = (name: string) => { const parts = name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name.trim(); };
