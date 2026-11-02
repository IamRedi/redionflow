/**
 * Roles in a metal construction company (AL-Steel pilot). The office admin
 * (a User) can do everything. Workers sign in with name + code and carry one
 * of these roles, which decides what they may change:
 *
 *   FIELD_ENGINEER    team leader on site: moves the site work phases
 *   FACTORY_ENGINEER  moves the factory steps of material groups
 *   OFFICE            orders, invoices, costs, site details
 *   FIELD_WORKER      sees, reads, reports missing material
 *   FACTORY_WORKER    sees, reads, reports missing material
 */

export const CREW_ROLES = ["FIELD_ENGINEER", "FACTORY_ENGINEER", "OFFICE", "FIELD_WORKER", "FACTORY_WORKER"] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export function readCrewRole(value: unknown): CrewRole | null {
  return typeof value === "string" && (CREW_ROLES as readonly string[]).includes(value) ? (value as CrewRole) : null;
}

export type CrewActor = { isAdmin: boolean; crewRole?: string | null; level?: string | null } | null;

function roleOf(actor: CrewActor) {
  if (!actor) return null;
  const role = readCrewRole(actor.crewRole);
  if (role) return role;
  // Workers without a role yet: a master or foreman counts as engineer.
  if (actor.level === "MEISTER" || actor.level === "VORARBEITER") return "ENGINEER_LEGACY" as const;
  return null;
}

export type CrewPermissions = {
  /** Finish, reopen, note the site work phases; add own tasks. */
  siteSteps: boolean;
  /** Move material groups through the factory. */
  factorySteps: boolean;
  /** Orders, invoices, costs, site address and details, new material groups. */
  office: boolean;
  /** Report missing material on a phase (everyone signed in). */
  reportMissing: boolean;
};

export function crewPermissions(actor: CrewActor): CrewPermissions {
  if (!actor) return { siteSteps: false, factorySteps: false, office: false, reportMissing: false };
  if (actor.isAdmin) return { siteSteps: true, factorySteps: true, office: true, reportMissing: true };
  const role = roleOf(actor);
  return {
    siteSteps: role === "FIELD_ENGINEER" || role === "ENGINEER_LEGACY",
    factorySteps: role === "FACTORY_ENGINEER" || role === "ENGINEER_LEGACY",
    office: role === "OFFICE",
    reportMissing: true,
  };
}
