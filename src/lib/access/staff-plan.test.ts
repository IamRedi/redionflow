import { expect, it } from "vitest";

import { parseStaffPlan } from "./staff-plan";

it("reads levels, whole-place grants and the default for everyone else", () => {
  const plan = parseStaffPlan(" Ana=FULL_VIEW,new_project ; Ben=BASE,warehouse; Cara=FULL_VIEW,costs:view; *=BASE ");
  expect(plan.errors).toEqual([]);
  expect(plan.everyoneElse).toBe("BASE");
  expect(plan.entries).toEqual([
    { name: "Ana", level: "FULL_VIEW", grants: [{ place: "new_project", level: "act" }] },
    { name: "Ben", level: "BASE", grants: [{ place: "warehouse", level: "act" }] },
    { name: "Cara", level: "FULL_VIEW", grants: [{ place: "costs", level: "view" }] },
  ]);
});

it("skips a whole entry with a bad level, place or grant", () => {
  const plan = parseStaffPlan("Ana=BOSS; Ben=BASE,bank; Cara=FULL_VIEW,costs:own; Dan=BASE");
  expect(plan.entries.map(e => e.name)).toEqual(["Dan"]);
  expect(plan.errors).toHaveLength(3);
});
