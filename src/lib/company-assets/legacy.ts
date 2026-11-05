import { assetActor, assetFail } from './access';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Finish an existing two-party legacy confirmation before adopting its custody.
 * Uses the same lock order as the new engine; never changes an initialized asset. */
export async function confirmLegacyAssetAssignment(itemId: string) {
  const actor = await assetActor();
  return withTenantContext(actor.companyId, async tx => {
    const prior = await tx.workerAssetItem.findFirst({ where: { id: itemId, worker: { companyProfileId: actor.companyId }, companyInventoryItemId: { not: null }, isPrivate: false }, select: { companyInventoryItemId: true } });
    if (!prior?.companyInventoryItemId) return assetFail('NOT_FOUND');
    const assetId = prior.companyInventoryItemId;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-asset:${actor.companyId}:inventory:${assetId}`}))`;
    const [base] = await tx.$queryRaw<Array<{ isActive: boolean }>>`SELECT "isActive" FROM "CompanyInventoryItem" WHERE "id"=${assetId} AND "companyProfileId"=${actor.companyId} FOR UPDATE`;
    if (!base) return assetFail('NOT_FOUND');
    if (await tx.companyOperationalAsset.findFirst({ where: { companyProfileId: actor.companyId, inventoryItemId: assetId }, select: { id: true } })) return assetFail('USE_REPAIR_WORKFLOW');
    const item = await tx.workerAssetItem.findFirst({ where: { id: itemId, companyInventoryItemId: assetId, worker: { companyProfileId: actor.companyId } } });
    if (!item) return assetFail('NOT_FOUND');
    const adminConfirm = item.status === 'PENDING_ADMIN_CONFIRMATION' || item.status === 'PENDING_ADMIN_DELETE_CONFIRMATION';
    const workerConfirm = item.status === 'PENDING_WORKER_CONFIRMATION' || item.status === 'PENDING_WORKER_DELETE_CONFIRMATION';
    if (!(adminConfirm && actor.canManage) && !(workerConfirm && actor.workerId === item.workerId)) return assetFail('DENIED');
    const returning = item.status.endsWith('DELETE_CONFIRMATION');
    if (!returning && (!base.isActive || await tx.workerAssetItem.findFirst({ where: { id: { not: item.id }, companyInventoryItemId: assetId, isPrivate: false, status: { not: 'DELETED' }, worker: { companyProfileId: actor.companyId } }, select: { id: true } }))) return assetFail('AMBIGUOUS_CUSTODY');
    await tx.workerAssetItem.update({ where: { id: item.id }, data: { status: returning ? 'DELETED' : 'ACTIVE', ...(returning ? { deletedAt: new Date() } : {}), confirmedAt: new Date(), confirmedByRole: actor.canManage ? 'ADMIN' : 'WORKER', confirmedByName: actor.name } });
    await tx.inventoryAssetMovement.create({ data: { companyProfileId: actor.companyId, itemId: assetId, workerId: item.workerId, actorAdminId: actor.userId, action: returning ? 'RETURN' : 'TAKE', actorRole: actor.canManage ? 'ADMIN' : 'WORKER', actorName: actor.name, note: 'Legacy confirmation', isPrivate: false, barcode: item.barcode } });
  });
}
