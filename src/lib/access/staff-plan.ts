import { ACCESS_PLACES, type AccessLevel, type AccessPlace, type GrantLevel } from "./rules";

/**
 * A company's staff table as one line, e.g.
 *   "Ana=FULL_VIEW,new_project; Ben=BASE,warehouse; Cara=FULL_VIEW,costs:view; *=BASE"
 * Each entry: name = level, then whole-place grants (default "act").
 * "*" sets the level for everyone not named. Site grants are given with the
 * key button, not here.
 */
export type StaffPlanEntry = { name: string; level: AccessLevel; grants: { place: AccessPlace; level: GrantLevel }[] };
export type StaffPlan = { entries: StaffPlanEntry[]; everyoneElse: AccessLevel | null; errors: string[] };

export function parseStaffPlan(raw: string | undefined): StaffPlan {
  const plan: StaffPlan = { entries: [], everyoneElse: null, errors: [] };
  for (const part of (raw ?? "").split(";").map(p => p.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    const name = eq > 0 ? part.slice(0, eq).trim() : "";
    const [levelRaw, ...grantParts] = (eq > 0 ? part.slice(eq + 1) : "").split(",").map(p => p.trim()).filter(Boolean);
    const level = levelRaw === "BASE" || levelRaw === "FULL_VIEW" ? levelRaw : null;
    if (!name || !level) { plan.errors.push(`bad entry "${part}"`); continue; }
    if (name === "*") { plan.everyoneElse = level; continue; }
    const grants: StaffPlanEntry["grants"] = [];
    let ok = true;
    for (const g of grantParts) {
      const [placeRaw, grantRaw = "act"] = g.split(":").map(p => p.trim());
      if (!(ACCESS_PLACES as readonly string[]).includes(placeRaw) || (grantRaw !== "act" && grantRaw !== "view")) { plan.errors.push(`bad grant "${g}" for ${name}`); ok = false; continue; }
      grants.push({ place: placeRaw as AccessPlace, level: grantRaw });
    }
    if (ok) plan.entries.push({ name, level, grants });
  }
  return plan;
}
