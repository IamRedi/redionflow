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

export const ACCESS_PLACES = ["site", "field", "factory", "new_project", "fleet_gps", "workshop", "warehouse", "daily_plan", "costs", "staff"] as const;
export type AccessPlace = (typeof ACCESS_PLACES)[number];
export type AccessLevel = "BASE" | "FULL_VIEW";
/** "none" takes away what the level or the whole place would give (Hiq). */
export type GrantLevel = "view" | "act" | "none";

/**
 * Every action belongs to one place. `<place>.view` is the place's view action.
 * field.steps = the field (assembly) list and site phases; site.plan =
 * plan/check elements and the steel catalog; site.documents = upload
 * documents; site.details = address, invoices, office-only files;
 * factory.steps = the factory list and moving material in the factory.
 * field and factory grants can be for one site (scopeId) or all sites ("").
 */
export const ACCESS_ACTIONS = {
  "site.view": "site", "site.plan": "site", "site.documents": "site", "site.missing_material": "site", "site.details": "site",
  "field.view": "field", "field.steps": "field",
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
const FULL_VIEW_PLACES: ReadonlySet<AccessPlace> = new Set(["site", "field", "factory", "new_project", "fleet_gps", "workshop", "warehouse", "daily_plan"]);
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
      return [...all(["field.steps", "site.plan", "site.missing_material"]), ...[...legacySiteGrants].map(scopeId => ({ action: "site.documents" as const, scopeId }))];
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

/**
 * The single decision. `scopeId` is the site id for site actions, "" for
 * company-wide places. A key-button choice (act / view / none) at the site
 * beats one for the whole place, which beats the level.
 */
export function can(subject: AccessSubject, action: AccessAction, scopeId = "", options: { legacy?: boolean } = {}): boolean {
  if (subject.kind === "admin") return true;
  if (!subject.active) return false;
  const place = placeOf(action);
  const view = isViewAction(action);
  // The most specific key-button choice decides: this site, then the whole place.
  const own = (scopeId ? subject.grants.find(g => g.place === place && g.scopeId === scopeId) : undefined)
    ?? subject.grants.find(g => g.place === place && g.scopeId === "");
  // A key-button choice is final: "view" also stops acting that a crew role gave.
  if (own) return own.level === "act" || (own.level === "view" && view);
  if (view && EVERYONE_VIEWS.has(place)) return true;
  if (view && effectiveLevel(subject) === "FULL_VIEW" && FULL_VIEW_PLACES.has(place)) return true;
  // Crew roles count only until the boss sets the level; then the role's
  // rights live on as explicit grants (see setWorkerAccessLevel).
  if (options.legacy ?? subject.accessLevel === null) {
    for (const legacy of legacyActions(subject.crewRole, subject.legacySiteGrants)) {
      if (placeOf(legacy.action) !== place || (legacy.scopeId !== "" && legacy.scopeId !== scopeId)) continue;
      if (view || legacy.action === action) return true;
    }
  }
  return false;
}

/**
 * The grants that keep a crew role's rights when the boss first sets the
 * level: one "act" per place the role works in (document-engineer sites
 * become site grants). Visible and editable with the key button afterwards.
 */
export function legacyGrantRows(crewRole: string | null, legacySiteGrants: ReadonlySet<string> = new Set()): AccessGrantRow[] {
  const rows = new Map<string, AccessGrantRow>();
  for (const { action, scopeId } of legacyActions(crewRole, legacySiteGrants)) {
    const place = placeOf(action);
    rows.set(`${place}:${scopeId}`, { place, scopeId, level: "act" });
  }
  // A whole-place grant already covers single sites.
  return [...rows.values()].filter(row => !row.scopeId || !rows.has(`${row.place}:`));
}

