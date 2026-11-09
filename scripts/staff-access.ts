/**
 * One-time setup at boot: apply a company's staff table to the access model.
 *
 *   STAFF_ACCESS_PLAN   see src/lib/access/staff-plan.ts, e.g.
 *                       "Ana=FULL_VIEW,new_project; Ben=BASE,warehouse; *=BASE"
 *
 * Runs only with exactly one company. It touches only workers whose level is
 * still empty, so once applied it does nothing on later boots and never undoes
 * what the boss changes with the key button. Names that match no single
 * worker are skipped and logged, and then the "*" default is not applied.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { applyAccessLevel } from "../src/lib/access/apply";
import { ACCESS_PLACES } from "../src/lib/access/rules";
import { parseStaffPlan } from "../src/lib/access/staff-plan";
import { matchAccessNames, type GrantPerson } from "../src/lib/assistant/access-grant";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";

export async function runStaffAccess() {
  const plan = parseStaffPlan(process.env.STAFF_ACCESS_PLAN);
  if (!plan.entries.length && !plan.everyoneElse) {
    console.log("[staff-access] STAFF_ACCESS_PLAN not set, nothing to do.");
    return;
  }
  for (const error of plan.errors) console.log(`[staff-access] skipped: ${error}`);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) {
      console.log(`[staff-access] expected exactly one company, found ${companies.length}; nothing changed.`);
      return;
    }
    const companyId = companies[0].id;
    const workers = await prisma.worker.findMany({ where: { companyProfileId: companyId, status: "active" }, select: { id: true, firstName: true, lastName: true, accessLevel: true } });
    const people: GrantPerson[] = workers.map(w => ({ kind: "worker" as const, id: w.id, fullName: `${w.firstName} ${w.lastName}`.trim(), firstName: w.firstName }));
    const open = new Set(workers.filter(w => w.accessLevel === null).map(w => w.id));
    if (!open.size) { console.log("[staff-access] every worker already has a level; nothing changed."); return; }
    const named = new Set<string>();
    let applied = 0;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      const results = matchAccessNames(plan.entries.map(e => e.name), people);
      for (const [index, { name, matches }] of results.entries()) {
        if (matches.length !== 1) { console.log(`[staff-access] "${name}" matched ${matches.length} workers; skipped.`); continue; }
        const workerId = matches[0].id;
        named.add(workerId);
        if (!open.has(workerId)) continue;
        const entry = plan.entries[index];
        await applyAccessLevel(tx, companyId, workerId, entry.level, null);
        for (const grant of entry.grants) {
          await tx.accessGrant.upsert({
            where: { companyProfileId_place_scopeId_workerId: { companyProfileId: companyId, place: grant.place, scopeId: "", workerId } },
            create: { companyProfileId: companyId, place: grant.place, scopeId: "", workerId, level: grant.level },
            update: { level: grant.level },
          });
        }
        applied += 1;
      }
      // A missed name must not fall into the default level by accident.
      const missed = results.filter(r => r.matches.length !== 1).length;
      if (missed && plan.everyoneElse) console.log(`[staff-access] ${missed} names not matched; the default for everyone else was NOT applied.`);
      if (plan.everyoneElse && !missed) {
        for (const workerId of open) {
          if (named.has(workerId)) continue;
          await applyAccessLevel(tx, companyId, workerId, plan.everyoneElse, null);
          applied += 1;
        }
      }
    }, { timeout: 60_000 });
    console.log(`[staff-access] applied the staff table to ${applied} workers.`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * ACCESS_ACT_ALL   comma list of names, e.g. "Megi,Almet": these workers get
 * Vepron on every place (all sites), also where an earlier choice said
 * Shikon or Hiq. Remove the variable after one boot so later key-button edits
 * stay. Names matching no single worker are skipped and logged.
 */
export async function runActAll() {
  const names = (process.env.ACCESS_ACT_ALL ?? "").split(",").map(n => n.trim()).filter(Boolean);
  if (!names.length) return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[act-all] expected exactly one company, found ${companies.length}; nothing changed.`); return; }
    const companyId = companies[0].id;
    const workers = await prisma.worker.findMany({ where: { companyProfileId: companyId, status: "active" }, select: { id: true, firstName: true, lastName: true, accessLevel: true } });
    const people: GrantPerson[] = workers.map(w => ({ kind: "worker" as const, id: w.id, fullName: `${w.firstName} ${w.lastName}`.trim(), firstName: w.firstName }));
    let created = 0;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      for (const { name, matches } of matchAccessNames(names, people)) {
        if (matches.length !== 1) { console.log(`[act-all] "${name}" matched ${matches.length} workers; skipped.`); continue; }
        const workerId = matches[0].id;
        if (workers.find(w => w.id === workerId)?.accessLevel === null) await applyAccessLevel(tx, companyId, workerId, "FULL_VIEW", null);
        for (const place of ACCESS_PLACES) {
          const key = { companyProfileId_place_scopeId_workerId: { companyProfileId: companyId, place, scopeId: "", workerId } };
          const existing = await tx.accessGrant.findUnique({ where: key, select: { level: true } });
          if (existing?.level === "act") continue;
          await tx.accessGrant.upsert({ where: key, create: { companyProfileId: companyId, place, scopeId: "", workerId, level: "act" }, update: { level: "act" } });
          created += 1;
        }
      }
    }, { timeout: 60_000 });
    console.log(`[act-all] set ${created} Vepron choices for ${names.join(", ")}.`);
  } finally {
    await prisma.$disconnect();
  }
}
