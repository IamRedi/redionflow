import { describe, expect, it } from "vitest";

import { getFeatures, modeConfig, productBranding, resolveMode } from "./mode-config";

describe("mode-config", () => {
  it("offers exactly the two products", () => {
    expect(Object.keys(modeConfig).sort()).toEqual(["bau", "baumdienst"]);
  });

  it.each([
    ["bau", "bau"],
    ["baumdienst", "baumdienst"],
    ["personal", "baumdienst"],
    ["", "baumdienst"],
    [null, "baumdienst"],
    [undefined, "baumdienst"],
  ] as const)("resolveMode(%s) -> %s", (raw, expected) => {
    expect(resolveMode(raw)).toBe(expected);
  });

  it("hides only tree modules in BauFlow", () => {
    const baumdienst = getFeatures("baumdienst");
    const bau = getFeatures("bau");
    expect(baumdienst.trees).toBe(true);
    expect(bau).toEqual({ ...baumdienst, trees: false });
  });

  it("brands each mode", () => {
    expect(productBranding("baumdienst").full).toBe("BaumdienstFlow²⁶");
    expect(productBranding("bau").full).toBe("BauFlow²⁶");
  });
});
