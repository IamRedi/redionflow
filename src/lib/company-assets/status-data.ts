import { assetActor } from './access';
import { readCanonicalAssetStatuses } from './service';
import { unknownAssetStatus } from './status';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { AssetOperationalStatus } from './types';

export function machineStatusIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > 500 || input.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) return null;
  return [...new Set(input as string[])];
}

/** Non-steel remains unchanged. Failed/missing owned reads are explicitly unknown. */
export async function loadMachineOperationalStatusMap(companyId: string, input: string[]): Promise<Map<string, AssetOperationalStatus> | null> {
  const ids = [...new Set(input)];
  const unknown = () => new Map(ids.map(id => [id, unknownAssetStatus()]));
  try {
    if (!await isSteelCompany(companyId)) return null;
    // Large legacy registries must still render. Do not silently project only the first 500.
    if (!machineStatusIds(input)) return unknown();
    const actor = await assetActor();
    if (actor.companyId !== companyId) return unknown();
    const rows = await withTenantContext(companyId, tx => readCanonicalAssetStatuses(tx, actor, ids.map(id => ({ kind: 'machine', id }))));
    const result = unknown();
    const wanted = new Set(ids);
    for (const row of rows) if (row.ref.kind === 'machine' && wanted.has(row.ref.id)) result.set(row.ref.id, row.status);
    return result;
  } catch { return unknown(); }
}
