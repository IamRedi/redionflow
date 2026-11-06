import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { parseMachineNotes, serializeMachineNotes } from '@/lib/workzone/machine-notes';
import { assetActor, assetActorKey, assetFail, type AssetActor } from './access';
import { assertAssetUsable, lockOwnedAsset } from './service';
import { editableMachine, machineEditSelect } from './machine-edit-data';

/** Planning reads only status under the same lock as asset commands; it creates nothing. */
export async function assertPlanningMachineUsable(tx: Prisma.TransactionClient, actor: Pick<AssetActor, 'companyId'>, machineId: string) {
  const companyProfileId = actor.companyId;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-asset:${companyProfileId}:machine:${machineId}`}))`;
  const machine = await tx.machine.findFirst({ where: { id: machineId, companyProfileId }, select: { id: true, isActive: true } });
  if (!machine) return assetFail('NOT_FOUND');
  if (!machine.isActive) return assetFail('ASSET_UNAVAILABLE');
  const asset = await tx.companyOperationalAsset.findFirst({ where: { companyProfileId, machineId }, select: { id: true, disposition: true } });
  if (!asset) return;
  if (asset.disposition !== 'active') return assetFail('ASSET_UNAVAILABLE');
  // Explicit EXISTS avoids ORM-generated primary-key ordering, which would
  // require unrelated columns from the restricted planning role.
  const [state] = await tx.$queryRaw<Array<{ blocked: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM "CompanyAssetIncident" WHERE "companyProfileId"=${companyProfileId} AND "assetId"=${asset.id} AND status='pending')
      OR EXISTS (SELECT 1 FROM "CompanyAssetHandover" WHERE "companyProfileId"=${companyProfileId} AND "assetId"=${asset.id} AND status='pending')
      OR EXISTS (SELECT 1 FROM "CompanyAssetRepair" WHERE "companyProfileId"=${companyProfileId} AND "assetId"=${asset.id} AND phase IN ('reported','received','repairing')) AS blocked`;
  if (!state || state.blocked) return assetFail('ASSET_UNAVAILABLE');
}

/** Keep legacy forms, but an activation cannot clear a production asset block. */
export async function updateMachineWithAssetGuard(companyId: string, machineId: string, data: Prisma.MachineUpdateInput, expectedVersion?: string) {
  if (!await isSteelCompany(companyId)) return prisma.machine.update({ where: { id: machineId, companyProfileId: companyId }, data });
  const actor = await assetActor();
  if (actor.companyId !== companyId || !actor.canManage) return assetFail('DENIED');
  return withTenantContext(companyId, async tx => {
    const ref = { kind: 'machine' as const, id: machineId };
    const asset = await lockOwnedAsset(tx, actor, ref);
    if (expectedVersion) {
      const current = await tx.machine.findUniqueOrThrow({ where: { id: machineId }, select: machineEditSelect });
      if (editableMachine(current).version !== expectedVersion) return assetFail('CONFLICT');
    }
    const write = { ...data };
    if (typeof write.notes === 'string' || write.notes === null) {
      const previous = await tx.machine.findUniqueOrThrow({ where: { id: machineId }, select: { notes: true } });
      write.notes = serializeMachineNotes({ body: parseMachineNotes(write.notes).body, defects: parseMachineNotes(previous.notes).defects });
    }
    const machine = await tx.machine.update({ where: { id: machineId, companyProfileId: companyId }, data: write });
    // A previously inactive base row can be enabled only if the domain gate
    // accepts it. The tentative update and all other edits roll back on failure.
    if (!asset.isActive && machine.isActive) await assertAssetUsable(tx, actor, ref);
    await tx.companyOperationalAsset.update({ where: { id: asset.id, companyProfileId: companyId }, data: { revision: { increment: 1 } } });
    await tx.companyAssetEvent.create({ data: { companyProfileId: companyId, assetId: asset.id, type: !asset.isActive && machine.isActive ? 'machine.activated' : asset.isActive && !machine.isActive ? 'machine.blocked' : 'machine.updated', actorKey: assetActorKey(actor), actorName: actor.name, note: '' } });
    return machine;
  });
}
