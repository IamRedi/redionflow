'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentCompanyId } from '@/lib/db/tenant';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import { readAssetDetail, readAssetSnapshot, runAssetMutation } from '@/lib/company-assets/service';
import { saveCompanyAssetFile } from '@/lib/company-assets/files';
import { assetActionError } from '@/lib/company-assets/action-errors';
import type { AssetDetail, AssetMutation, AssetQuery, AssetRef, AssetResult, AssetSnapshot } from '@/lib/company-assets/types';

async function refreshAssets() {
  revalidatePath('/workzone', 'layout');
  revalidatePath('/app/inventory');
  revalidatePath('/app/admin/inventory');
  revalidatePath('/app/workshop');
  revalidatePath('/app/admin');
  const companyId = await getCurrentCompanyId();
  if (companyId) notifyRealtimeUpdate('inventory.updated', ['worker-profile','admin-inventory','machine-sidebar','daily-plan','company-assets'], companyId);
}
export async function getAssetSnapshotAction(query?: AssetQuery): Promise<AssetResult<AssetSnapshot>> {
  try { return { ok: true, data: await readAssetSnapshot(query) }; } catch (error) { return assetActionError(error); }
}
export async function getAssetDetailAction(ref: AssetRef): Promise<AssetResult<AssetDetail>> {
  try { return { ok: true, data: await readAssetDetail(ref) }; } catch (error) { return assetActionError(error); }
}
export async function runAssetOperationAction(input: AssetMutation): Promise<AssetResult<unknown>> {
  try {
    const data = await runAssetMutation(input);
    await refreshAssets();
    return { ok: true, data };
  } catch (error) { return assetActionError(error); }
}
export async function uploadAssetFileAction(form: FormData): Promise<AssetResult<{ id: string; url: string }>> {
  try {
    const data = await saveCompanyAssetFile(form);
    await refreshAssets();
    return { ok: true, data };
  } catch (error) { return assetActionError(error); }
}
