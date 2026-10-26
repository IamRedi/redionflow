export type Cents = number;

export type Percent = number; // 0.18 = 18%

export type Money = {
  cents: Cents;
};

export type LaborWageInput =
  | {
      wageType: "HOURLY";
      grossHourlyCents: Cents;
    }
  | {
      wageType: "MONTHLY";
      grossMonthlyCents: Cents;
      monthlyHours: number; // e.g. 173.33
    };

export type LaborCostAssumptions = {
  employerOverheadPct: Percent; // employer-side overhead on gross wage
  productivityPct: Percent; // productive share of paid time
  absencePct?: Percent; // expected absence share of paid time
};

export type EffectiveHourlyCostBreakdown = {
  grossHourlyCents: Cents;
  employerOverheadPct: Percent;
  grossPlusOverheadHourlyCents: Cents;
  productivityPct: Percent;
  absencePct: Percent;
  productiveShare: number;
  effectiveHourlyCents: Cents;
};

export type OverheadSettings = {
  bgkPct: Percent;
  agkPct: Percent;
  riskPct: Percent;
  profitPct: Percent;
  vatPct: Percent;

  bgkBase: "EK_TOTAL" | "LABOR_ONLY";
  riskProfitMode: "SEPARATE" | "COMBINED";
  applyVatByDefault: boolean;
};

export type PositionDirectCosts = {
  laborCents: Cents;
  machineCents: Cents;
  materialCents: Cents;
  externalCents: Cents;
  manualAdjustmentCents?: Cents;
};

export type PositionTotals = {
  direct: PositionDirectCosts & { ekCents: Cents };
  overhead: {
    bgkBaseCents: Cents;
    bgkCents: Cents;
    hkCents: Cents;
    agkCents: Cents;
    skCents: Cents;
    riskCents: Cents;
    profitCents: Cents;
  };
  offer: {
    netCents: Cents;
    vatCents: Cents;
    grossCents: Cents;
  };
};

export type ProjectTotals = {
  positions: PositionTotals[];
  sum: {
    laborCents: Cents;
    machineCents: Cents;
    materialCents: Cents;
    externalCents: Cents;
    manualAdjustmentCents: Cents;
    ekCents: Cents;

    bgkCents: Cents;
    hkCents: Cents;
    agkCents: Cents;
    skCents: Cents;
    riskCents: Cents;
    profitCents: Cents;

    netCents: Cents;
    vatCents: Cents;
    grossCents: Cents;
  };
};

