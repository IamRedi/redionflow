'use server';

import { revalidatePath } from 'next/cache';
import { assetActor, assetFail } from '@/lib/company-assets/access';
import { assetActionError } from '@/lib/company-assets/action-errors';
import { machineDateFields, machineEditSchema, type MachineEdit } from '@/lib/company-assets/machine-edit';
import { updateMachineWithAssetGuard } from '@/lib/company-assets/legacy-machine';
import { withTenantContext } from '@/lib/db/tenant-context';
import { editableMachine, machineEditSelect } from '@/lib/company-assets/machine-edit-data';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import type { AssetResult } from '@/lib/company-assets/types';
import type { Prisma } from '@/generated/prisma/client';

export async function getMachineEditAction(id: string): Promise<AssetResult<MachineEdit>> {
  try {
    const actor = await assetActor();
    if (!actor.canManage || typeof id !== 'string' || id.length > 100) return assetFail('DENIED');
    const row = await withTenantContext(actor.companyId, tx => tx.machine.findFirst({
      where: { id, companyProfileId: actor.companyId },
      select: machineEditSelect,
    }));
    if (!row) return assetFail('NOT_FOUND');
    return { ok: true, data: editableMachine(row) };
  } catch (error) { return assetActionError(error); }
}

export async function saveMachineEditAction(input: MachineEdit): Promise<AssetResult<{ updatedAt: string }>> {
  try {
    const actor = await assetActor();
    if (!actor.canManage) return assetFail('DENIED');
    const { id, version, ...fields } = machineEditSchema.parse(input);
    const dates = Object.fromEntries(machineDateFields.map(key => [key, fields[key] ? new Date(`${fields[key]}T00:00:00.000Z`) : null]));
    const row = await updateMachineWithAssetGuard(actor.companyId, id, { ...fields, ...dates } as Prisma.MachineUpdateInput, version);
    revalidatePath('/workzone', 'layout');
    revalidatePath('/app/admin');
    revalidatePath('/app/admin/machines');
    revalidatePath(`/app/admin/machines/${id}`);
    notifyRealtimeUpdate('machine.updated', ['machine-sidebar', 'company-assets', 'daily-plan'], actor.companyId);
    return { ok: true, data: { updatedAt: row.updatedAt.toISOString() } };
  } catch (error) { return assetActionError(error); }
}
