import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { dayRange } from "../src/lib/workzone/date-utils";

/**
 * One-shot clean start for real attendance (Redi 2026-11-09: test hours go, real work starts
 * the next morning). ATTENDANCE_RESET_BEFORE=YYYY-MM-DD deletes every work session (pauses
 * cascade) that started before that day's business-timezone midnight, plus the daily/monthly
 * report notes of those days (they hold the admin "KOHE|" time copies). Blank the variable after.
 */
export async function runAttendanceReset() {
  const before = (process.env.ATTENDANCE_RESET_BEFORE ?? "").trim();
  if (!before) return;
  const cutoff = dayRange(before).start;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before) || Number.isNaN(cutoff.getTime())) { console.log(`[attendance-reset] "${before}" is not a date; nothing changed.`); return; }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[attendance-reset] expected exactly one company, found ${companies.length}; nothing changed.`); return; }
    const companyId = companies[0].id;
    const month = before.slice(0, 7);
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      const worker = { companyProfileId: companyId };
      const sessions = await tx.workSession.deleteMany({ where: { worker, startTime: { lt: cutoff } } });
      const daily = await tx.workReportNote.deleteMany({ where: { worker, type: "DAILY", periodKey: { lt: before } } });
      // Monthly notes up to the reset month: they only hold test-day messages and time copies.
      const monthly = await tx.workReportNote.deleteMany({ where: { worker, type: "MONTHLY", periodKey: { lte: month } } });
      return { sessions: sessions.count, notes: daily.count + monthly.count };
    }, { timeout: 60_000 });
    console.log(`[attendance-reset] deleted ${result.sessions} work sessions and ${result.notes} report notes before ${before}.`);
  } finally {
    await prisma.$disconnect();
  }
}
