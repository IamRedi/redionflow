/**
 * Who may see and do what in a steel company (docs/STEEL_ACCESS.md).
 *
 * Every person has a level: BASE (workers) or FULL_VIEW (engineers, office).
 * Admins (Users) may do everything. On top of the level, each place has a
 * key button where the boss grants "view" (Shikon) or "act" (Vepron) to a
 * person. "act" on a place allows every action of that place.
 *
 * This file is pure: no database, so the whole matrix is unit tested.
 */

export const ACCESS_PLACES = ["site", "factory", "new_project", "fleet_gps", "workshop", "warehouse", "daily_plan", "costs", "staff"] as const;
export type AccessPlace = (typeof ACCESS_PLACES)[number];
export type AccessLevel = "BASE" | "FULL_VIEW";
export type GrantLevel = "view" | "act";

/**
 * Every action belongs to one place. `<place>.view` is the place's view action.
 * site.field_steps = move site phases; site.plan = plan/check elements and the
 * steel catalog; site.documents = upload documents; site.details = address,
 * invoices, office-only files; factory.steps = move material in the factory.
 */
export const ACCESS_ACTIONS = {
  "site.view": "site", "site.field_steps": "site", "site.plan": "site", "site.documents": "site", "site.missing_material": "site", "site.details": "site",
  "factory.view": "factory", "factory.steps": "factory",
  "new_project.view": "new_project", "new_project.create": "new_project",
  "fleet_gps.view": "fleet_gps", "fleet_gps.manage": "fleet_gps",
  "workshop.view": "workshop", "workshop.repair": "workshop",
  "warehouse.view": "warehouse", "warehouse.manage": "warehouse",
  "daily_plan.view": "daily_plan", "daily_plan.edit": "daily_plan",
  "costs.view": "costs", "costs.manage": "costs",
  "staff.view": "staff", "staff.manage": "staff",
} as const satisfies Record<string, AccessPlace>;
export type AccessAction = keyof typeof ACCESS_ACTIONS;

export const isViewAction = (action: AccessAction) => action.endsWith(".view");
export const placeOf = (action: AccessAction): AccessPlace => ACCESS_ACTIONS[action];

/** Places a FULL_VIEW person sees without a grant. Costs and other people's data need a grant. */
const FULL_VIEW_PLACES: ReadonlySet<AccessPlace> = new Set(["site", "factory", "new_project", "fleet_gps", "workshop", "warehouse", "daily_plan"]);
/** Places everybody sees. */
const EVERYONE_VIEWS: ReadonlySet<AccessPlace> = new Set(["daily_plan"]);

export type AccessGrantRow = { place: AccessPlace; scopeId: string; level: GrantLevel };

export type AccessSubject =
  | { kind: "admin" }
  | {
      kind: "worker";
      active: boolean;
      /** Stored level; null until the boss sets it (then derived from the crew role). */
      accessLevel: AccessLevel | null;
      crewRole: string | null;
      grants: AccessGrantRow[];
      /** Sites where today's document-engineer grant exists (legacy, kept until migration). */
      legacySiteGrants?: ReadonlySet<string>;
    };

export function effectiveLevel(subject: Extract<AccessSubject, { kind: "worker" }>): AccessLevel {
  if (subject.accessLevel) return subject.accessLevel;
  return subject.crewRole && subject.crewRole !== "FIELD_WORKER" && subject.crewRole !== "FACTORY_WORKER" ? "FULL_VIEW" : "BASE";
}

/**
 * Today's crew roles as grants, so switching to the new rules changes nothing
 * for anyone on day one. Mirrors crewPermissions(), the site document grants
 * and the asset rules exactly.
 */
export function legacyActions(crewRole: string | null, legacySiteGrants: ReadonlySet<string> = new Set()): { action: AccessAction; scopeId: string }[] {
  const all = (actions: AccessAction[]) => actions.map(action => ({ action, scopeId: "" }));
  switch (crewRole) {
    case "FIELD_ENGINEER":
      return [...all(["site.field_steps", "site.plan", "site.missing_material"]), ...[...legacySiteGrants].map(scopeId => ({ action: "site.documents" as const, scopeId }))];
    case "FACTORY_ENGINEER":
      return [...all(["factory.steps", "site.plan", "site.missing_material"]), ...[...legacySiteGrants].map(scopeId => ({ action: "site.documents" as const, scopeId }))];
    case "OFFICE":
      return all(["site.plan", "site.documents", "site.missing_material", "site.details", "new_project.create", "warehouse.manage", "workshop.repair", "costs.view", "costs.manage"]);
    case "MECHANIC":
      return all(["workshop.repair"]);
    default:
      return [];
  }
}

const covers = (grant: AccessGrantRow, place: AccessPlace, scopeId: string) => grant.place === place && (grant.scopeId === "" || grant.scopeId === scopeId);

/**
 * The single decision. `scopeId` is the site id for site actions, "" for
 * company-wide places. Grants are additive; nothing takes away the level.
 */
export function can(subject: AccessSubject, action: AccessAction, scopeId = "", options: { legacy?: boolean } = {}): boolean {
  if (subject.kind === "admin") return true;
  if (!subject.active) return false;
  const place = placeOf(action);
  const view = isViewAction(action);
  if (view && EVERYONE_VIEWS.has(place)) return true;
  if (view && effectiveLevel(subject) === "FULL_VIEW" && FULL_VIEW_PLACES.has(place)) return true;
  for (const grant of subject.grants) {
    if (!covers(grant, place, scopeId)) continue;
    if (view || grant.level === "act") return true;
  }
  if (options.legacy !== false) {
    for (const legacy of legacyActions(subject.crewRole, subject.legacySiteGrants)) {
      if (placeOf(legacy.action) !== place || (legacy.scopeId !== "" && legacy.scopeId !== scopeId)) continue;
      if (view || legacy.action === action) return true;
    }
  }
  return false;
}
