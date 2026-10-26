import type { PositionDirectCosts } from "./types";
import {
  externalRowDirectCents,
  laborRowDirectCents,
  machineRowDirectCents,
  materialRowDirectCents,
  type LaborRowForCalc,
  type MachineRowForCalc,
  type MaterialRowForCalc,
  type ExternalRowForCalc,
} from "./compute-position-direct";

type LaborItemIn = {
  workers: number;
  hours: unknown;
  hourlyRateOverrideCents: number | null;
  laborRole: {
    wageType: "HOURLY" | "MONTHLY";
    grossHourlyCents: number | null;
    grossMonthlyCents: number | null;
    employerOverheadPct: unknown;
    productivityPct: unknown;
    absencePct: unknown;
  } | null;
};

type MachineItemIn = {
  timeUnit: "HOURS" | "DAYS";
  quantity: unknown;
  rateOverrideCents: number | null;
  machine: {
    hourlyRateCents: number;
    dayRateCents: number | null;
  } | null;
};

type MaterialItemIn = {
  quantity: unknown;
  unitPriceCents: number;
};

type ExternalItemIn = {
  amountCents: number;
};

type PositionIn = {
  manualAdjustmentCents: number | null;
  laborItems: LaborItemIn[];
  machineItems: MachineItemIn[];
  materialItems: MaterialItemIn[];
  externalServiceItems: ExternalItemIn[];
};

export function positionDirectCostsFromDb(position: PositionIn): PositionDirectCosts {
  let laborCents = 0;
  for (const li of position.laborItems) {
    const row: LaborRowForCalc = {
      workers: li.workers,
      hours: li.hours,
      hourlyRateOverrideCents: li.hourlyRateOverrideCents,
      laborRole: li.laborRole
        ? {
            wageType: li.laborRole.wageType,
            grossHourlyCents: li.laborRole.grossHourlyCents,
            grossMonthlyCents: li.laborRole.grossMonthlyCents,
            employerOverheadPct: li.laborRole.employerOverheadPct,
            productivityPct: li.laborRole.productivityPct,
            absencePct: li.laborRole.absencePct,
          }
        : null,
    };
    laborCents += laborRowDirectCents(row);
  }

  let machineCents = 0;
  for (const mi of position.machineItems) {
    const row: MachineRowForCalc = {
      timeUnit: mi.timeUnit,
      quantity: mi.quantity,
      rateOverrideCents: mi.rateOverrideCents,
      machine: mi.machine
        ? {
            hourlyRateCents: mi.machine.hourlyRateCents,
            dayRateCents: mi.machine.dayRateCents,
          }
        : null,
    };
    machineCents += machineRowDirectCents(row);
  }

  let materialCents = 0;
  for (const mat of position.materialItems) {
    const row: MaterialRowForCalc = {
      quantity: mat.quantity,
      unitPriceCents: mat.unitPriceCents,
    };
    materialCents += materialRowDirectCents(row);
  }

  let externalCents = 0;
  for (const ex of position.externalServiceItems) {
    const row: ExternalRowForCalc = { amountCents: ex.amountCents };
    externalCents += externalRowDirectCents(row);
  }

  return {
    laborCents,
    machineCents,
    materialCents,
    externalCents,
    manualAdjustmentCents: position.manualAdjustmentCents ?? undefined,
  };
}
