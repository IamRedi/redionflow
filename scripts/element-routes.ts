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
    console.log(total ? `[element-routes] gave ${total} untouched elements their default processes.` : "[element-routes] nothing to fill.");
  } finally {
    await prisma.$disconnect();
  }
}
