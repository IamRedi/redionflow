import { describe, expect, it } from "vitest";
import { isWeightUnit, maySeeWeights } from "./weight-visibility-rule";

describe("maySeeWeights", () => {
  it("without the list everyone sees weights", () => {
    expect(maySeeWeights({ name: "Ana Test" }, "")).toBe(true);
    expect(maySeeWeights(null, undefined)).toBe(true);
  });
  it("with the list only matching full or first names", () => {
    const raw = "Ana,Beni Shembull";
    expect(maySeeWeights({ name: "ana test" }, raw)).toBe(true);
    expect(maySeeWeights({ name: "Beni Shembull" }, raw)).toBe(true);
    expect(maySeeWeights({ name: "Beni Tjeter" }, raw)).toBe(false);
    expect(maySeeWeights({ name: "" }, raw)).toBe(false);
    expect(maySeeWeights(null, raw)).toBe(false);
  });
  it("kg and t are weight units, pieces are not", () => {
    expect(isWeightUnit("kg")).toBe(true);
    expect(isWeightUnit("t")).toBe(true);
    expect(isWeightUnit("pcs")).toBe(false);
  });
});
