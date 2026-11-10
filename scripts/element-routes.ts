/**
 * Every boot: elements imported before default processes existed (both routes
 * empty, never edited, no confirmed work) get the company's default processes.
 * Idempotent; touches nothing an engineer has saved.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";
import { fillDefaultElementRoutes } from "../src/lib/elements/default-routes";
import { maySeePrivateVehicles } from "../src/lib/fleet/private-vehicles-rule";
import { mayDeleteElementList } from "../src/lib/elements/list-delete";

export async function runElementRoutes() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true } });
    let total = 0;
    for (const { id } of companies) {
      total += await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, id);
        return fillDefaultElementRoutes(tx, id);
      }, { timeout: 60_000 });
    }
    if ((process.env.LIST_DELETE_ONLY ?? "").trim()) {
      // Who LIST_DELETE_ONLY lets delete element lists, so a misspelt name shows in the boot log.
      const [admins, workers] = await Promise.all([
        prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true, name: true, email: true } }),
        prisma.worker.findMany({ where: { status: "active" }, select: { id: true, firstName: true, lastName: true } }),
      ]);
      const allowed = [...admins.map(a => ({ kind: "admin", id: a.id, name: (a.name ?? a.email).trim() })), ...workers.map(w => ({ kind: "worker", id: w.id, name: `${w.firstName} ${w.lastName}`.trim() }))]
        .filter(p => mayDeleteElementList(p.name, false));
      console.log(`[list-delete] ${allowed.length} people may delete element lists: ${allowed.map(p => `${p.kind} ${p.name.split(" ")[0]}`).join(", ") || "nobody"}.`);
    }
    if ((process.env.PRIVATE_VEHICLES_ONLY ?? "").trim()) {
      // Who sees private vehicles, so a misspelt name shows in the boot log.
      const [admins, workers] = await Promise.all([
        prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { name: true, email: true } }),
        prisma.worker.findMany({ where: { status: "active" }, select: { firstName: true, lastName: true } }),
      ]);
      const allowed = [...admins.map(a => ({ kind: "admin", name: (a.name ?? a.email).trim(), isAdmin: true })), ...workers.map(w => ({ kind: "worker", name: `${w.firstName} ${w.lastName}`.trim(), isAdmin: false }))]
        .filter(p => maySeePrivateVehicles(p));
      console.log(`[private-vehicles] ${allowed.length} people see private vehicles: ${allowed.map(p => `${p.kind} ${p.name.split(" ")[0]}`).join(", ") || "nobody"}.`);
    }
    console.log(total ? `[element-routes] gave ${total} untouched elements their default processes.` : "[element-routes] nothing to fill.");
  } finally {
    await prisma.$disconnect();
  }
}
