import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { BAUFLOW_MUSTER_COMPANY_ID as companyId } from '../src/lib/demo/bauflow-muster';
import { assertMusterFleetTarget, BAUFLOW_MUSTER_FLEET, musterFleetPhoto } from '../src/lib/demo/bauflow-muster-fleet';
import { assertE2ETestDatabase } from './lib/e2e-target';

// Explicit one-time additive command. Never installed in app startup or reset.
async function main() {
  const target = assertMusterFleetTarget(process.env);
  if (target === 'local') assertE2ETestDatabase(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
      const companies = await tx.companyProfile.findMany({ select: { id: true, legalName: true } });
      if (companies.length !== 1 || companies[0].id !== companyId
        || companies[0].legalName !== 'BauFlow Musterbau GmbH · Fiktive Demofirma') {
        throw new Error('Wrong Muster company; no fleet changes applied.');
      }
      let added = 0, photographed = 0, preserved = 0;
      for (const [index, item] of BAUFLOW_MUSTER_FLEET.entries()) {
        const fixedId = `bauflow-muster-fleet-${item.key}`;
        const matches = await tx.machine.findMany({ where: { companyProfileId: companyId, OR: [{ id: fixedId }, { name: item.name }] } });
        if (matches.length > 1 || (index < 4 && !matches.length)) throw new Error('Muster fleet identity changed; refusing duplicates.');
        let machine = matches[0];
        if (!machine) {
          machine = await tx.machine.create({ data: {
            id: fixedId, companyProfileId: companyId, name: item.name, category: item.category,
            targe: item.plate, hourlyRateCents: item.hourlyRateCents, imageUrl: musterFleetPhoto(item.key),
          } });
          const asset = await tx.companyOperationalAsset.create({ data: { companyProfileId: companyId, machineId: machine.id } });
          await tx.companyAssetEvent.create({ data: { companyProfileId: companyId, assetId: asset.id, type: 'registered',
            actorKey: 'muster-fleet-v1', actorName: 'Musterfirma', note: 'Fiktives Musterfahrzeug mit illustrativer Katalogaufnahme.' } });
          added++; photographed++; continue;
        }
        const upload = await tx.assetPhoto.findFirst({ where: { companyProfileId: companyId, machineId: machine.id }, select: { id: true } });
        const cover = await tx.companyAssetFile.findFirst({ where: { companyProfileId: companyId, kind: 'cover', asset: { machineId: machine.id } }, select: { id: true } });
        if (machine.imageUrl || machine.coverPhotoAt || upload || cover) { preserved++; continue; }
        const changed = await tx.machine.updateMany({ where: { id: machine.id, companyProfileId: companyId, imageUrl: null, coverPhotoAt: null }, data: { imageUrl: musterFleetPhoto(item.key) } });
        if (changed.count) {
          const asset = await tx.companyOperationalAsset.findFirstOrThrow({ where: { companyProfileId: companyId, machineId: machine.id } });
          await tx.companyAssetEvent.create({ data: { companyProfileId: companyId, assetId: asset.id, type: 'cover-added',
            actorKey: 'muster-fleet-v1', actorName: 'Musterfirma', note: 'Illustrative Musteraufnahme ergänzt; hochgeladene Fotos bleiben vorrangig.' } });
          photographed++;
        }
      }
      return { added, photographed, preserved };
    }, { timeout: 30_000 });
    console.log(JSON.stringify({ status: 'MUSTER_FLEET_APPLIED', ...result }));
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Muster fleet update refused or rolled back; check the isolated target.'); process.exitCode = 1; });
