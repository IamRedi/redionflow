import { parseAccessNames } from "@/lib/assistant/access-grant";

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Who sees private vehicles in Flota and GPS and may mark a vehicle private.
 * With PRIVATE_VEHICLES_ONLY set (e.g. "Megi,Almet"), only people whose full
 * or first name matches (Redi 10.11.2026). Without it, office admins.
 */
export function maySeePrivateVehicles(person: { name: string | null | undefined; isAdmin: boolean } | null, raw = process.env.PRIVATE_VEHICLES_ONLY): boolean {
  if (!person) return false;
  const names = parseAccessNames(raw).map(fold);
  if (!names.length) return person.isAdmin;
  const full = fold(person.name ?? "");
  if (!full) return false;
  const first = full.split(" ")[0];
  return names.some(name => name === full || name === first);
}
