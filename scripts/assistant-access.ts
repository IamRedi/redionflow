/**
 * One-time setup at boot: limit the AI assistant to named people.
 *
 *   ASSISTANT_ACCESS_ONLY   comma list of names, e.g. "Megi,Almet"
 *
 * Runs only when the installation holds exactly one company (a single-company
 * pilot). It switches the company to "selected people only" and enables each
 * name that matches one person (an admin login and/or a worker record of the
 * same person, see grantTargets). Ambiguous or unknown
 * names enable nobody. Everyone else (admins and workers) loses access on
 * every boot, so the list is the whole truth. The boot log names everyone who
 * keeps access.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { grantTargets, matchAccessNames, parseAccessNames, type GrantPerson } from "../src/lib/assistant/access-grant";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";

export async function runAssistantAccess() {
  const names = parseAccessNames(process.env.ASSISTANT_ACCESS_ONLY);
  if (!names.length) {
    console.log("[assistant-access] ASSISTANT_ACCESS_ONLY not set, nothing to do.");
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) {
      console.log(`[assistant-access] expected exactly one company, found ${companies.length}; nothing changed.`);
      return;
    }
    const companyId = companies[0].id;
    const [admins, workers] = await Promise.all([
      prisma.user.findMany({ where: { companyProfileId: companyId, role: "ADMIN", isActive: true }, select: { id: true, name: true, email: true, isOwner: true } }),
      prisma.worker.findMany({ where: { companyProfileId: companyId, status: "active" }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const people: GrantPerson[] = [
      ...admins.map(a => { const fullName = (a.name ?? a.email).trim(); return { kind: "admin" as const, id: a.id, fullName, firstName: fullName.split(" ")[0] ?? "" }; }),
      ...workers.map(w => ({ kind: "worker" as const, id: w.id, fullName: `${w.firstName} ${w.lastName}`.trim(), firstName: w.firstName })),
    ];
    const results = matchAccessNames(names, people);
    const keep = new Set(results.flatMap(r => grantTargets(r.matches)).map(p => `${p.kind}:${p.id}`));
    const keepIds = (kind: GrantPerson["kind"]) => people.filter(p => p.kind === kind && keep.has(`${kind}:${p.id}`)).map(p => p.id);
    await prisma.$transaction(async tx => {
      await tx.companyProfile.update({ where: { id: companyId }, data: { assistantAccessSelected: true } });
      const offAdmins = await tx.user.updateMany({ where: { companyProfileId: companyId, assistantAccess: true, id: { notIn: keepIds("admin") } }, data: { assistantAccess: false } });
      const offWorkers = await tx.worker.updateMany({ where: { companyProfileId: companyId, assistantAccess: true, id: { notIn: keepIds("worker") } }, data: { assistantAccess: false } });
      console.log(`[assistant-access] switched off ${offAdmins.count} admin(s) and ${offWorkers.count} worker(s) not on the list.`);
      for (const { matches } of results) {
        for (const person of grantTargets(matches)) {
          if (person.kind === "admin") await tx.user.update({ where: { id: person.id }, data: { assistantAccess: true } });
          else await tx.worker.update({ where: { id: person.id }, data: { assistantAccess: true } });
        }
      }
    });
    for (const { name, matches } of results) {
      const targets = grantTargets(matches);
      if (targets.length) for (const t of targets) console.log(`[assistant-access] enabled ${t.kind} ${t.id} for "${name}".`);
      else console.log(`[assistant-access] "${name}" matched ${matches.length} records (${matches.map(m => m.kind).join(", ") || "none"}); nobody enabled for it.`);
    }
    const owner = admins.find(a => a.isOwner);
    const kept = people.filter(p => keep.has(`${p.kind}:${p.id}`)).map(p => `${p.kind} ${p.firstName}`);
    console.log(`[assistant-access] access now: ${kept.join(", ") || "nobody"}; owner ${owner ? (keep.has(`admin:${owner.id}`) ? "on the list" : "has no access") : "none"}.`);
    console.log("[assistant-access] company limited to selected people.");
  } finally {
    await prisma.$disconnect();
  }
}
