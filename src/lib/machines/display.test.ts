import { describe, expect, it } from "vitest";

import { MACHINE_CATEGORY_OPTIONS, machineCategoryOptions } from "./display";

describe("machineCategoryOptions", () => {
  it("offers every category in BaumdienstFlow", () => {
    expect(machineCategoryOptions("baumdienst")).toEqual(MACHINE_CATEGORY_OPTIONS);
  });

  it("hides the wood chipper category in BauFlow", () => {
    expect(machineCategoryOptions("bau").map((option) => option.value)).not.toContain("CHIPPER");
  });

  it("keeps a machine's current category selectable", () => {
    expect(machineCategoryOptions("bau", "CHIPPER").map((option) => option.value)).toContain("CHIPPER");
  });
});
