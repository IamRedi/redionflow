import type {
  EffectiveHourlyCostBreakdown,
  LaborCostAssumptions,
  LaborWageInput,
} from "./types";
import { clampPercent, roundCents } from "./math";

const DEFAULT_MONTHLY_HOURS = 173.33; // typical DE full-time approximation (40h/week)

export function deriveGrossHourlyCents(input: LaborWageInput): number {
  if (input.wageType === "HOURLY") return input.grossHourlyCents;
  const hours = input.monthlyHours > 0 ? input.monthlyHours : DEFAULT_MONTHLY_HOURS;
  return input.grossMonthlyCents / hours;
}

export function effectiveLaborHourlyCost(
  wage: LaborWageInput,
  assumptions: LaborCostAssumptions,
): EffectiveHourlyCostBreakdown {
  const grossHourly = deriveGrossHourlyCents(wage);
  const employerOverheadPct = clampPercent(assumptions.employerOverheadPct);
  const productivityPct = clampPercent(assumptions.productivityPct);
  const absencePct = clampPercent(assumptions.absencePct ?? 0);

  const grossPlusOverheadHourly = grossHourly * (1 + employerOverheadPct);

  // productiveShare is the share of paid time that becomes productive work time
  // (absence reduces available time; productivity reduces effective output).
  const productiveShare = Math.max(0.0001, (1 - absencePct) * productivityPct);

  const effective = grossPlusOverheadHourly / productiveShare;

  const breakdown: EffectiveHourlyCostBreakdown = {
    grossHourlyCents: roundCents(grossHourly),
    employerOverheadPct,
    grossPlusOverheadHourlyCents: roundCents(grossPlusOverheadHourly),
    productivityPct,
    absencePct,
    productiveShare,
    effectiveHourlyCents: roundCents(effective),
  };

  return breakdown;
}

