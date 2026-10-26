import { describe, expect, it } from "vitest";
import { calculatePositionTotals } from "./position";
import type { OverheadSettings } from "./types";

const overhead: OverheadSettings = {
  bgkPct: 0.1,
  agkPct: 0.1,
  riskPct: 0.03,
  profitPct: 0.05,
  vatPct: 0.19,
  bgkBase: "EK_TOTAL",
  riskProfitMode: "SEPARATE",
  applyVatByDefault: true,
};

describe("position totals", () => {
  it("calculates EK/HK/SK and offer totals (separate risk/profit)", () => {
    const t = calculatePositionTotals(
      { laborCents: 10000, machineCents: 5000, materialCents: 0, externalCents: 0 },
      overhead,
    );

    expect(t.direct.ekCents).toBe(15000);
    expect(t.overhead.bgkCents).toBe(1500);
    expect(t.overhead.hkCents).toBe(16500);
    expect(t.overhead.agkCents).toBe(1650);
    expect(t.overhead.skCents).toBe(18150);
    expect(t.overhead.riskCents).toBe(545);
    expect(t.overhead.profitCents).toBe(908);
    expect(t.offer.netCents).toBe(19603);
    expect(t.offer.vatCents).toBe(3725);
    expect(t.offer.grossCents).toBe(23328);
  });

  it("supports BGK base on labor only", () => {
    const t = calculatePositionTotals(
      { laborCents: 10000, machineCents: 5000, materialCents: 0, externalCents: 0 },
      { ...overhead, bgkBase: "LABOR_ONLY" },
    );
    expect(t.overhead.bgkBaseCents).toBe(10000);
    expect(t.overhead.bgkCents).toBe(1000);
  });

  it("supports combined risk+profit mode", () => {
    const t = calculatePositionTotals(
      { laborCents: 10000, machineCents: 0, materialCents: 0, externalCents: 0 },
      { ...overhead, riskProfitMode: "COMBINED" },
    );
    expect(t.offer.netCents).toBeGreaterThan(t.overhead.skCents);
  });

  it("can disable VAT via options", () => {
    const t = calculatePositionTotals(
      { laborCents: 10000, machineCents: 0, materialCents: 0, externalCents: 0 },
      overhead,
      { applyVat: false },
    );
    expect(t.offer.vatCents).toBe(0);
    expect(t.offer.grossCents).toBe(t.offer.netCents);
  });
});

