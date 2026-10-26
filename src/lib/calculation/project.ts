import type { OverheadSettings, PositionDirectCosts, ProjectTotals } from "./types";
import { calculatePositionTotals } from "./position";

export function calculateProjectTotals(
  positionsDirect: PositionDirectCosts[],
  overhead: OverheadSettings,
  options?: { applyVat?: boolean },
): ProjectTotals {
  const positions = positionsDirect.map((p) => calculatePositionTotals(p, overhead, options));

  const sum = positions.reduce<ProjectTotals["sum"]>(
    (acc, p) => {
      acc.laborCents += p.direct.laborCents;
      acc.machineCents += p.direct.machineCents;
      acc.materialCents += p.direct.materialCents;
      acc.externalCents += p.direct.externalCents;
      acc.manualAdjustmentCents += p.direct.manualAdjustmentCents ?? 0;
      acc.ekCents += p.direct.ekCents;

      acc.bgkCents += p.overhead.bgkCents;
      acc.hkCents += p.overhead.hkCents;
      acc.agkCents += p.overhead.agkCents;
      acc.skCents += p.overhead.skCents;
      acc.riskCents += p.overhead.riskCents;
      acc.profitCents += p.overhead.profitCents;

      acc.netCents += p.offer.netCents;
      acc.vatCents += p.offer.vatCents;
      acc.grossCents += p.offer.grossCents;
      return acc;
    },
    {
      laborCents: 0,
      machineCents: 0,
      materialCents: 0,
      externalCents: 0,
      manualAdjustmentCents: 0,
      ekCents: 0,

      bgkCents: 0,
      hkCents: 0,
      agkCents: 0,
      skCents: 0,
      riskCents: 0,
      profitCents: 0,

      netCents: 0,
      vatCents: 0,
      grossCents: 0,
    },
  );

  return { positions, sum };
}

