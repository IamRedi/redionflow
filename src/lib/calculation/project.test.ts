import { describe, expect, it } from "vitest";
import { calculateProjectTotals } from "./project";
import type { OverheadSettings } from "./types";

const overhead: OverheadSettings = {
  bgkPct: 0.15,
  agkPct: 0.1,
  riskPct: 0.03,
  profitPct: 0.06,
  vatPct: 0.19,
  bgkBase: "EK_TOTAL",
  riskProfitMode: "SEPARATE",
  applyVatByDefault: true,
};

describe("project totals", () => {
  it("aggregates multiple positions deterministically", () => {
    const r = calculateProjectTotals(
      [
        { laborCents: 10000, machineCents: 5000, materialCents: 0, externalCents: 0 },
        { laborCents: 2000, machineCents: 0, materialCents: 1000, externalCents: 3000 },
      ],
      overhead,
    );

    expect(r.positions).toHaveLength(2);
    expect(r.sum.ekCents).toBe(r.positions[0]!.direct.ekCents + r.positions[1]!.direct.ekCents);
    expect(r.sum.netCents).toBe(r.positions[0]!.offer.netCents + r.positions[1]!.offer.netCents);
    expect(r.sum.grossCents).toBe(
      r.positions[0]!.offer.grossCents + r.positions[1]!.offer.grossCents,
    );
  });
});

