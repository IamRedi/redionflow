export function decimalToNumber(d: Decimal | null | undefined): number {
  if (!d) return 0;
  // Decimal in Prisma v7 is decimal.js compatible
  if (typeof d === "object" && "toNumber" in d && typeof d.toNumber === "function") return d.toNumber();
  return Number(d);
}

// Prisma v7 Decimal types are generated; keep this helper type-local to avoid brittle import paths.
export type Decimal = number | string | { toNumber: () => number };

