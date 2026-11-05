import { describe, expect, it } from "vitest";

import { crewPermissions } from "./crew-roles";

describe("crew permissions", () => {
  it("admin may do everything", () => {
    expect(crewPermissions({ isAdmin: true })).toEqual({ siteSteps: true, factorySteps: true, office: true, reportMissing: true });
  });
  it("engineers move only their own steps", () => {
    expect(crewPermissions({ isAdmin: false, crewRole: "FIELD_ENGINEER" })).toMatchObject({ siteSteps: true, factorySteps: false, office: false });
    expect(crewPermissions({ isAdmin: false, crewRole: "FACTORY_ENGINEER" })).toMatchObject({ siteSteps: false, factorySteps: true, office: false });
  });
  it("workers only see and report missing material", () => {
    for (const crewRole of ["FIELD_WORKER", "FACTORY_WORKER", null]) {
      expect(crewPermissions({ isAdmin: false, crewRole, level: "WORKER" })).toEqual({ siteSteps: false, factorySteps: false, office: false, reportMissing: true });
    }
  });
  it("office handles orders and costs but no steps", () => {
    expect(crewPermissions({ isAdmin: false, crewRole: "OFFICE" })).toMatchObject({ siteSteps: false, factorySteps: false, office: true });
  });
  it("a mechanic is not implicitly a production engineer, even with a legacy foreman level", () => {
    expect(crewPermissions({ isAdmin: false, crewRole: "MECHANIC", level: "MEISTER" })).toEqual({ siteSteps: false, factorySteps: false, office: false, reportMissing: true });
  });
  it("nobody signed in may do nothing", () => {
    expect(crewPermissions(null).reportMissing).toBe(false);
  });
});
