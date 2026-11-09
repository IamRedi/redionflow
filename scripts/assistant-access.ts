/**
 * One-time setup at boot: limit the AI assistant to named people.
 *
 *   ASSISTANT_ACCESS_ONLY   comma list of names, e.g. "Megi,Almet"
 *
 * Runs only when the installation holds exactly one company (a single-company
 * pilot). It switches the company to "selected people only" and enables each
 * name that matches exactly one active admin or worker. Ambiguous or unknown
 * names enable nobody. It never removes access, so it is safe on every boot;
 * afterwards the boss turns access on/off on each person's profile.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { matchAccessNames, parseAccessNames, type GrantPerson } from "../src/lib/assistant/access-grant";
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
      prisma.user.findMany({ where: { companyProfileId: companyId, role: "ADMIN", isActive: true }, select: { id: true, name: true, email: true } }),
      prisma.worker.findMany({ where: { companyProfileId: companyId, status: "active" }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const people: GrantPerson[] = [
      ...admins.map(a => { const fullName = (a.name ?? a.email).trim(); return { kind: "admin" as const, id: a.id, fullName, firstName: fullName.split(" ")[0] ?? "" }; }),
      ...workers.map(w => ({ kind: "worker" as const, id: w.id, fullName: `${w.firstName} ${w.lastName}`.trim(), firstName: w.firstName })),
    ];
    const results = matchAccessNames(names, people);
    await prisma.$transaction(async tx => {
      await tx.companyProfile.update({ where: { id: companyId }, data: { assistantAccessSelected: true } });
      for (const { matches } of results) {
        if (matches.length !== 1) continue;
        const [person] = matches;
        if (person.kind === "admin") await tx.user.update({ where: { id: person.id }, data: { assistantAccess: true } });
        else await tx.worker.update({ where: { id: person.id }, data: { assistantAccess: true } });
      }
    });
    for (const { name, matches } of results) {
      if (matches.length === 1) console.log(`[assistant-access] enabled ${matches[0].kind} ${matches[0].id} for "${name}".`);
      else console.log(`[assistant-access] "${name}" matched ${matches.length} people; nobody enabled for it.`);
    }
    console.log("[assistant-access] company limited to selected people.");
  } finally {
    await prisma.$disconnect();
  }
}
