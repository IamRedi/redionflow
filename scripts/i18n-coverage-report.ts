/**
 * BDF-P8-007 — i18n coverage report.
 *
 *   npm run i18n:coverage
 */

import { measureAllCoverage } from "../src/lib/i18n/coverage";

const report = measureAllCoverage();
const rows = Object.entries(report).map(([lang, r]) => ({
  lang,
  totalLeaves: r.totalLeaves,
  translated: r.totalLeaves - r.germanFallbackCount,
  falling_back_to_de: r.germanFallbackCount,
  coverage: `${(r.coverage * 100).toFixed(1)}%`,
}));

console.log("BDF-P8-007 — i18n coverage vs de (source)");
console.table(rows);
