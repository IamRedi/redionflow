/**
 * One-time setup at boot: who gets "X started / finished work" notices.
 *
 *   NOTIFY_WORK_EVENTS_ONLY   comma list of names, e.g. "Megi,Almet"
 *
 * Single-company installs only. Matching people (an admin login and/or the
 * worker record of the same person) get both notices on; every other admin
 * and worker gets them off. Remove the variable after one boot so later
 * profile switches stay.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { grantTargets, matchAccessNames, parseAccessNames, type GrantPerson } from "../src/lib/assistant/access-grant";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";

export async function runWorkNotifyOnly() {
  const names = parseAccessNames(process.env.NOTIFY_WORK_EVENTS_ONLY);
  if (!names.length) return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[work-notify] expected exactly one company, found ${companies.length}; nothing changed.`); return; }
    const companyId = companies[0].id;
    const [admins, workers] = await Promise.all([
      prisma.user.findMany({ where: { companyProfileId: companyId, role: "ADMIN" }, select: { id: true, name: true, email: true } }),
      prisma.worker.findMany({ where: { companyProfileId: companyId }, select: { id: true, firstName: true, lastName: true, status: true } }),
    ]);
    const people: GrantPerson[] = [
      ...admins.map(a => { const fullName = (a.name ?? a.email).trim(); return { kind: "admin" as const, id: a.id, fullName, firstName: fullName.split(" ")[0] ?? "" }; }),
      ...workers.filter(w => w.status === "active").map(w => ({ kind: "worker" as const, id: w.id, fullName: `${w.firstName} ${w.lastName}`.trim(), firstName: w.firstName })),
    ];
    const results = matchAccessNames(names, people);
    const on = new Set(results.flatMap(r => grantTargets(r.matches).map(p => p.id)));
    const ids = [...admins.map(a => a.id), ...workers.map(w => w.id)];
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      for (const userId of ids) {
        const value = on.has(userId);
        await tx.notificationSettings.upsert({ where: { userId }, create: { userId, workStart: value, workEnd: value }, update: { workStart: value, workEnd: value } });
      }
    }, { timeout: 60_000 });
    for (const { name, matches } of results) {
      const targets = grantTargets(matches);
      console.log(targets.length ? `[work-notify] "${name}" → ${targets.map(t => t.kind).join(" + ")}` : `[work-notify] "${name}" matched ${matches.length} records; nobody switched on for it.`);
    }
    console.log(`[work-notify] work start/end on for ${on.size} records, off for ${ids.length - on.size}.`);
  } finally {
    await prisma.$disconnect();
  }
}
