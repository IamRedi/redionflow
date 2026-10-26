import type { OverheadSettings, PositionDirectCosts, PositionTotals } from "./types";
import { pctOf } from "./math";

export function calculatePositionTotals(
  direct: PositionDirectCosts,
  overhead: OverheadSettings,
  options?: { applyVat?: boolean },
): PositionTotals {
  const manual = direct.manualAdjustmentCents ?? 0;
  const ek =
    direct.laborCents + direct.machineCents + direct.materialCents + direct.externalCents + manual;

  const bgkBase = overhead.bgkBase === "LABOR_ONLY" ? direct.laborCents : ek;
  const bgk = pctOf(bgkBase, overhead.bgkPct);
  const hk = ek + bgk;

  const agk = pctOf(hk, overhead.agkPct);
  const sk = hk + agk;

  const combinedRiskProfit = overhead.riskProfitMode === "COMBINED";
  const risk = pctOf(sk, overhead.riskPct);
  const profit = pctOf(sk, overhead.profitPct);
  const rpCombined = combinedRiskProfit ? pctOf(sk, overhead.riskPct + overhead.profitPct) : 0;

  const net = combinedRiskProfit ? sk + rpCombined : sk + risk + profit;

  const applyVat = options?.applyVat ?? overhead.applyVatByDefault;
  const vat = applyVat ? pctOf(net, overhead.vatPct) : 0;
  const gross = net + vat;

  return {
    direct: {
      ...direct,
      manualAdjustmentCents: manual,
      ekCents: ek,
    },
    overhead: {
      bgkBaseCents: bgkBase,
      bgkCents: bgk,
      hkCents: hk,
      agkCents: agk,
      skCents: sk,
      riskCents: risk,
      profitCents: profit,
    },
    offer: {
      netCents: net,
      vatCents: vat,
      grossCents: gross,
    },
  };
}

