'use server';

import { assetActor } from '@/lib/company-assets/access';
import { loadMachineOperationalStatusMap, machineStatusIds } from '@/lib/company-assets/status-data';
import type { AssetOperationalStatus, AssetResult } from '@/lib/company-assets/types';

/** Tenant and actor come from the server session, never the submitted IDs. */
export async function getMachineOperationalStatusAction(input: string[]): Promise<AssetResult<{ id: string; status: AssetOperationalStatus }[]>> {
  const ids = machineStatusIds(input);
  if (!ids) return { ok: false, code: 'INVALID_INPUT', message: '' };
  try {
    const actor = await assetActor();
    const statuses = await loadMachineOperationalStatusMap(actor.companyId, ids);
    if (!statuses) return { ok: false, code: 'DENIED', message: '' };
    return { ok: true, data: [...statuses].map(([id, status]) => ({ id, status })) };
  } catch { return { ok: false, code: 'UNAVAILABLE', message: '' }; }
}
