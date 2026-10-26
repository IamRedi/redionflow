import { effectiveLaborHourlyCost } from "./labor";
import type { Cents } from "./types";

/** Prisma Decimal-like */
function decToNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number") return d;
  if (typeof d === "object" && d !== null && "toNumber" in d && typeof (d as { toNumber: () => number }).toNumber === "function") {
    return (d as { toNumber: () => number }).toNumber();
  }
  return Number(d);
}

export type LaborRoleForCalc = {
  wageType: "HOURLY" | "MONTHLY";
  grossHourlyCents: number | null;
  grossMonthlyCents: number | null;
  employerOverheadPct: unknown;
  productivityPct: unknown;
  absencePct: unknown;
};

export type LaborRowForCalc = {
  workers: number;
  hours: unknown;
  hourlyRateOverrideCents: number | null;
  laborRole: LaborRoleForCalc | null;
};

export function laborRowDirectCents(row: LaborRowForCalc): Cents {
  const hours = decToNum(row.hours);
  const workers = Math.max(0, row.workers || 0);
  if (hours <= 0 || workers <= 0) return 0;

  if (row.hourlyRateOverrideCents != null) {
    return Math.round((workers * hours * row.hourlyRateOverrideCents) as number);
  }

  const role = row.laborRole;
  if (!role) return 0;

  const eo = decToNum(role.employerOverheadPct);
  const prod = decToNum(role.productivityPct);
  const abs = decToNum(role.absencePct);

  if (role.wageType === "HOURLY" && role.grossHourlyCents != null) {
    const eff = effectiveLaborHourlyCost(
      { wageType: "HOURLY", grossHourlyCents: role.grossHourlyCents },
      { employerOverheadPct: eo, productivityPct: prod, absencePct: abs },
    );
    return Math.round(workers * hours * eff.effectiveHourlyCents);
  }

  if (role.wageType === "MONTHLY" && role.grossMonthlyCents != null) {
    const eff = effectiveLaborHourlyCost(
      {
        wageType: "MONTHLY",
        grossMonthlyCents: role.grossMonthlyCents,
        monthlyHours: 173.33,
      },
      { employerOverheadPct: eo, productivityPct: prod, absencePct: abs },
    );
    return Math.round(workers * hours * eff.effectiveHourlyCents);
  }

  return 0;
}

export type MachineForCalc = {
  hourlyRateCents: number;
  dayRateCents: number | null;
};

export type MachineRowForCalc = {
  timeUnit: "HOURS" | "DAYS";
  quantity: unknown;
  rateOverrideCents: number | null;
  machine: MachineForCalc | null;
};

export function machineRowDirectCents(row: MachineRowForCalc): Cents {
  const qty = decToNum(row.quantity);
  if (qty <= 0) return 0;

  const override = row.rateOverrideCents;
  if (override != null) {
    return Math.round(qty * override);
  }

  const m = row.machine;
  if (!m) return 0;

  if (row.timeUnit === "HOURS") {
    return Math.round(qty * m.hourlyRateCents);
  }

  const dayRate = m.dayRateCents ?? m.hourlyRateCents * 8;
  return Math.round(qty * dayRate);
}

export type MaterialRowForCalc = {
  quantity: unknown;
  unitPriceCents: number;
};

export function materialRowDirectCents(row: MaterialRowForCalc): Cents {
  const q = decToNum(row.quantity);
  if (q <= 0) return 0;
  return Math.round(q * row.unitPriceCents);
}

export type ExternalRowForCalc = {
  amountCents: number;
};

export function externalRowDirectCents(row: ExternalRowForCalc): Cents {
  return Math.max(0, row.amountCents ?? 0);
}
