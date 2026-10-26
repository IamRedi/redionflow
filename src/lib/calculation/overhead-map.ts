import type { OverheadSettings as EngineOverhead } from "./types";
import { decimalToNumber } from "@/lib/db/prisma-types";

type DbOverhead = {
  bgkPct: unknown;
  agkPct: unknown;
  riskPct: unknown;
  profitPct: unknown;
  vatPct: unknown;
  bgkBase: "EK_TOTAL" | "LABOR_ONLY";
  riskProfitMode: "SEPARATE" | "COMBINED";
  applyVatByDefault: boolean;
};

export function overheadSettingsToEngine(o: DbOverhead | null | undefined): EngineOverhead {
  if (!o) {
    return {
      bgkPct: 0.18,
      agkPct: 0.1,
      riskPct: 0.03,
      profitPct: 0.06,
      vatPct: 0.19,
      bgkBase: "EK_TOTAL",
      riskProfitMode: "SEPARATE",
      applyVatByDefault: true,
    };
  }
  return {
    bgkPct: decimalToNumber(o.bgkPct as never),
    agkPct: decimalToNumber(o.agkPct as never),
    riskPct: decimalToNumber(o.riskPct as never),
    profitPct: decimalToNumber(o.profitPct as never),
    vatPct: decimalToNumber(o.vatPct as never),
    bgkBase: o.bgkBase,
    riskProfitMode: o.riskProfitMode,
    applyVatByDefault: o.applyVatByDefault,
  };
}
