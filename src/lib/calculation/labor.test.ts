import { describe, expect, it } from "vitest";
import { effectiveLaborHourlyCost } from "./labor";

describe("labor effective hourly cost", () => {
  it("derives effective hourly cost from hourly wage inputs", () => {
    const r = effectiveLaborHourlyCost(
      { wageType: "HOURLY", grossHourlyCents: 2000 },
      { employerOverheadPct: 0.3, productivityPct: 0.8, absencePct: 0.1 },
    );

    // grossPlusOverhead = 2000 * 1.3 = 2600
    expect(r.grossPlusOverheadHourlyCents).toBe(2600);
    // productiveShare = (1 - 0.1) * 0.8 = 0.72
    expect(r.productiveShare).toBeCloseTo(0.72, 6);
    // effective = 2600 / 0.72 = 3611.11...
    expect(r.effectiveHourlyCents).toBe(3611);
  });

  it("handles extreme assumptions without NaN/Infinity", () => {
    const r = effectiveLaborHourlyCost(
      { wageType: "HOURLY", grossHourlyCents: 2000 },
      { employerOverheadPct: 0.3, productivityPct: 0, absencePct: 1 },
    );
    expect(Number.isFinite(r.effectiveHourlyCents)).toBe(true);
    expect(r.effectiveHourlyCents).toBeGreaterThan(0);
  });
});

