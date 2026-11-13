import { describe, expect, it } from "vitest";
import { createWorkshopDemo } from "./demo-data";
import { sectionAssets, workshopSection } from "./section-navigation";

describe("section folders reuse the existing company records", () => {
  it("keeps the primary section authoritative and rejects invalid context", () => {
    expect(workshopSection("fleet", "tools")).toBe("fleet");
    expect(workshopSection("documents", "fleet")).toBe("fleet");
    expect(workshopSection("parts", "tools")).toBe("tools");
    expect(workshopSection("history", "unknown")).toBe("orders");
  });
  it("preserves every record on legacy URLs and in the company inventory", () => {
    const state = createWorkshopDemo();
    for (const section of ["orders", "fleet", "tools"] as const) expect(sectionAssets(state, section, false)).toBe(state.assets);
    expect(sectionAssets(state, "tools", true)).toBe(state.assets);
  });
  it("shows fleet and repair records by existing identity without changing data", () => {
    const state = createWorkshopDemo(), before = structuredClone(state);
    const fleet = sectionAssets(state, "fleet", true), repairs = sectionAssets(state, "orders", true);
    expect(fleet.length).toBeGreaterThan(0); expect(fleet.every(a => a.kind === "fleet")).toBe(true);
    expect(repairs.map(a => a.id).sort()).toEqual([...new Set(state.jobs.map(j => j.assetId))].sort());
    expect([...fleet, ...repairs].every(a => state.assets.includes(a))).toBe(true);
    expect(state).toEqual(before);
  });
});
