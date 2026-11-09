import { describe, expect, it } from "vitest";

import { canManageSteelCatalog } from "@/lib/steel-work/types";
import { CREW_ROLES, crewPermissions } from "@/lib/workzone/crew-roles";
import { ACCESS_ACTIONS, can, effectiveLevel, type AccessAction, type AccessGrantRow, type AccessSubject } from "./rules";

const worker = (crewRole: string | null, extra: Partial<Extract<AccessSubject, { kind: "worker" }>> = {}): Extract<AccessSubject, { kind: "worker" }> => ({
  kind: "worker", active: true, accessLevel: null, crewRole, grants: [], ...extra,
});
const actions = Object.keys(ACCESS_ACTIONS) as AccessAction[];

describe("access rules", () => {
  it("admin may do everything", () => {
    for (const action of actions) expect(can({ kind: "admin" }, action, "s1")).toBe(true);
  });

  it("an inactive worker may do nothing", () => {
    for (const action of actions) expect(can(worker("OFFICE", { active: false, grants: [{ place: "site", scopeId: "", level: "act" }] }), action, "s1")).toBe(false);
  });

  it("derives the level from the crew role until the boss sets it", () => {
    expect(effectiveLevel(worker(null))).toBe("BASE");
    expect(effectiveLevel(worker("FIELD_WORKER"))).toBe("BASE");
    expect(effectiveLevel(worker("FACTORY_WORKER"))).toBe("BASE");
    for (const role of ["FIELD_ENGINEER", "FACTORY_ENGINEER", "OFFICE", "MECHANIC"]) expect(effectiveLevel(worker(role))).toBe("FULL_VIEW");
    expect(effectiveLevel(worker("OFFICE", { accessLevel: "BASE" }))).toBe("BASE");
    expect(effectiveLevel(worker(null, { accessLevel: "FULL_VIEW" }))).toBe("FULL_VIEW");
  });

  it("a base worker sees only the daily plan and may act nowhere", () => {
    const base = worker("FIELD_WORKER");
    for (const action of actions) expect(can(base, action, "s1")).toBe(action === "daily_plan.view");
  });

  it("full view sees every place except costs and staff, and acts nowhere without a grant", () => {
    const full = worker(null, { accessLevel: "FULL_VIEW" });
    for (const action of actions) {
      const expected = action.endsWith(".view") && !action.startsWith("costs.") && !action.startsWith("staff.");
      expect(can(full, action, "s1"), action).toBe(expected);
    }
  });

  it("act on one site allows every site action there and nowhere else", () => {
    const grants: AccessGrantRow[] = [{ place: "site", scopeId: "s1", level: "act" }];
    const person = worker(null, { grants });
    for (const action of actions.filter(a => a.startsWith("site."))) {
      expect(can(person, action, "s1")).toBe(true);
      expect(can(person, action, "s2")).toBe(false);
    }
    expect(can(person, "factory.steps")).toBe(false);
  });

  it("view grants only the view action; an all-sites grant covers every site", () => {
    const person = worker(null, { grants: [{ place: "costs", scopeId: "", level: "view" }, { place: "site", scopeId: "", level: "view" }] });
    expect(can(person, "costs.view")).toBe(true);
    expect(can(person, "costs.manage")).toBe(false);
    expect(can(person, "site.view", "any")).toBe(true);
    expect(can(person, "site.field_steps", "any")).toBe(false);
  });

  it("legacy roles keep exactly today's rights", () => {
    for (const role of CREW_ROLES) {
      const old = crewPermissions({ isAdmin: false, crewRole: role });
      const person = worker(role);
      expect(can(person, "site.field_steps", "s1"), role).toBe(old.siteSteps);
      expect(can(person, "factory.steps"), role).toBe(old.factorySteps);
      expect(can(person, "site.details", "s1"), role).toBe(old.office);
      expect(can(person, "new_project.create"), role).toBe(old.office);
      expect(can(person, "costs.manage"), role).toBe(old.office);
      expect(can(person, "site.missing_material", "s1"), role).toBe(old.reportMissing);
      expect(can(person, "site.plan", "s1"), role).toBe(canManageSteelCatalog(old));
      // Asset rules: manage = office, repair = office or mechanic.
      expect(can(person, "warehouse.manage"), role).toBe(role === "OFFICE");
      expect(can(person, "workshop.repair"), role).toBe(role === "OFFICE" || role === "MECHANIC");
      expect(can(person, "daily_plan.edit"), role).toBe(false);
      expect(can(person, "staff.manage"), role).toBe(false);
    }
  });

  it("legacy document upload: office everywhere, engineers only on their granted sites", () => {
    expect(can(worker("OFFICE"), "site.documents", "s1")).toBe(true);
    const engineer = worker("FIELD_ENGINEER", { legacySiteGrants: new Set(["s1"]) });
    expect(can(engineer, "site.documents", "s1")).toBe(true);
    expect(can(engineer, "site.documents", "s2")).toBe(false);
    expect(can(worker("FACTORY_ENGINEER"), "site.documents", "s1")).toBe(false);
    expect(can(worker("MECHANIC", { legacySiteGrants: new Set(["s1"]) }), "site.documents", "s1")).toBe(false);
  });

  it("without legacy, roles alone give no actions", () => {
    for (const role of CREW_ROLES) for (const action of actions.filter(a => !a.endsWith(".view"))) {
      expect(can(worker(role), action, "s1", { legacy: false }), `${role} ${action}`).toBe(false);
    }
  });

  it("once the level is set, the crew role alone gives no actions", () => {
    expect(can(worker("OFFICE", { accessLevel: "FULL_VIEW" }), "costs.manage")).toBe(false);
    expect(can(worker("OFFICE", { accessLevel: "FULL_VIEW", grants: [{ place: "costs", scopeId: "", level: "act" }] }), "costs.manage")).toBe(true);
  });
});
