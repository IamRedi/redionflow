import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Prisma } from '../../src/generated/prisma/client';
import { BAUFLOW_MUSTER_COMPANY_ID as companyId, BAUFLOW_MUSTER_OWNER_ID as ownerId } from '../../src/lib/demo/bauflow-muster';
import { BAUFLOW_MUSTER_INVENTORY } from '../../src/lib/demo/bauflow-muster-inventory';

/** Add missing canonical covers under the same locks used by normal uploads. */
export async function addMusterInventoryCovers(tx: Prisma.TransactionClient) {
  // Canonical files require one real FK actor; this is the existing fictional
  // installation owner, never a new user or a customer identity.
  const owner = await tx.user.findFirstOrThrow({ where: { id: ownerId, companyProfileId: companyId }, select: { id: true } });
  let photographed = 0, preserved = 0;
  for (const item of BAUFLOW_MUSTER_INVENTORY) {
    const matches = await tx.companyInventoryItem.findMany({ where: { companyProfileId: companyId,
      OR: [{ itemCode: item.code }, { barcode: item.code }] } });
    if (matches.length !== 1 || matches[0].name !== item.name || matches[0].category !== 'WORK_TOOL') {
      throw new Error('Muster inventory identity changed; refusing mismatched photos.');
    }
    const inventory = matches[0];
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-asset:${companyId}:inventory:${inventory.id}`}))`;
    await tx.$queryRaw`SELECT id FROM "CompanyInventoryItem" WHERE id=${inventory.id} AND "companyProfileId"=${companyId} FOR UPDATE`;
    const fresh = await tx.companyInventoryItem.findFirstOrThrow({ where: { id: inventory.id, companyProfileId: companyId } });
    if (fresh.name !== item.name || fresh.category !== 'WORK_TOOL' || (fresh.itemCode !== item.code && fresh.barcode !== item.code)) {
      throw new Error('Muster inventory changed while waiting for its lock.');
    }
    const asset = await tx.companyOperationalAsset.findFirstOrThrow({ where: { companyProfileId: companyId, inventoryItemId: inventory.id } });
    const photo = await tx.companyAssetFile.findFirst({ where: { companyProfileId: companyId, assetId: asset.id, kind: { in: ['cover', 'photo'] } }, select: { id: true } });
    if (photo) { preserved++; continue; }
    const bytes = await readFile(join(process.cwd(), 'public/bauflow-muster-v1/inventory', `${item.key}.webp`));
    if (bytes.length > 500_000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error('Invalid bounded Muster inventory image.');
    }
    await tx.companyAssetFile.create({ data: {
      id: `bauflow-muster-inventory-cover-${item.key}`, companyProfileId: companyId, assetId: asset.id,
      kind: 'cover', mime: 'image/webp', name: `${item.key}-MUSTER.webp`, size: bytes.length,
      dataBytes: bytes, sha256: createHash('sha256').update(bytes).digest('hex'),
      uploadedByUserId: owner.id, uploadedByName: 'Musterfirma · illustrative Katalogaufnahme',
    } });
    await tx.companyOperationalAsset.update({ where: { id: asset.id, companyProfileId: companyId }, data: { revision: { increment: 1 } } });
    await tx.companyAssetEvent.create({ data: { companyProfileId: companyId, assetId: asset.id, type: 'cover-added',
      actorKey: 'muster-inventory-v1', actorName: 'Musterfirma', note: 'Illustrative Musteraufnahme ergänzt; vorhandene Fotos bleiben vorrangig.' } });
    photographed++;
  }
  return { photographed, preserved };
}
