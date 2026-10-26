import type { Cents, Percent } from "./types";

export function clampPercent(p: number): Percent {
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

export function roundCents(n: number): Cents {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function pctOf(baseCents: Cents, pct: Percent): Cents {
  return roundCents(baseCents * clampPercent(pct));
}

