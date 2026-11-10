import { parseAccessNames } from "@/lib/assistant/access-grant";

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Who sees weights (kg, t) of material and elements. With WEIGHT_VIEW_ONLY set
 * (e.g. "Megi,Almet"), only people whose full or first name matches; everyone
 * else sees pieces and counts only (Redi 10.11.2026). Without it, everyone.
 */
export function maySeeWeights(person: { name: string | null | undefined } | null, raw = process.env.WEIGHT_VIEW_ONLY): boolean {
  const names = parseAccessNames(raw).map(fold);
  if (!names.length) return true;
  if (!person) return false;
  const full = fold(person.name ?? "");
  if (!full) return false;
  const first = full.split(" ")[0];
  return names.some(name => name === full || name === first);
}

/** Order units that are a weight; their amounts are hidden like element kg. */
export const isWeightUnit = (unit: string | null | undefined) => unit === "kg" || unit === "t";
