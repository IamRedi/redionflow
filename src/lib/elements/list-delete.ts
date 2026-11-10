import { parseAccessNames } from "@/lib/assistant/access-grant";

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Who may delete an imported element list file. With LIST_DELETE_ONLY set
 * (e.g. "Megi,Silvi"), only people whose full or first name matches may
 * delete, nobody else (Redi 10.11.2026). Without it, the default rule applies.
 */
export function mayDeleteElementList(actorName: string | null | undefined, defaultRule: boolean, raw = process.env.LIST_DELETE_ONLY): boolean {
  const names = parseAccessNames(raw).map(fold);
  if (!names.length) return defaultRule;
  const full = fold(actorName ?? "");
  if (!full) return false;
  const first = full.split(" ")[0];
  return names.some(name => name === full || name === first);
}
