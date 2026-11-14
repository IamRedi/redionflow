import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { BAUFLOW_MUSTER_COMPANY_ID as companyId } from '../src/lib/demo/bauflow-muster';
import { assertMusterInventoryTarget } from '../src/lib/demo/bauflow-muster-inventory';
import { assertE2ETestDatabase } from './lib/e2e-target';
import { addMusterInventoryCovers } from './lib/muster-inventory-photos';

// Explicit additive maintenance only; never called by startup/reset.
async function main() {
  const target = assertMusterInventoryTarget(process.env);
  if (target === 'local') assertE2ETestDatabase(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
      const companies = await tx.companyProfile.findMany({ select: { id: true, legalName: true } });
      if (companies.length !== 1 || companies[0].id !== companyId
        || companies[0].legalName !== 'BauFlow Musterbau GmbH · Fiktive Demofirma') throw new Error('Wrong Muster company.');
      return addMusterInventoryCovers(tx);
    }, { timeout: 30_000 });
    console.log(JSON.stringify({ status: 'MUSTER_INVENTORY_APPLIED', ...result }));
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Muster inventory update refused or rolled back; check the isolated target.'); process.exitCode = 1; });
