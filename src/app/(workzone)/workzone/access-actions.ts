'use server';
import { revalidatePath } from 'next/cache';

import { assetActionError } from '@/lib/company-assets/action-errors';
import { readPlaceAccess, readWorkerAccessSummary, setPlaceAccess, setWorkerAccessLevel } from '@/lib/access/manage';

export async function getPlaceAccessAction(place: string, scopeId?: string) {
  try { return { ok: true as const, data: await readPlaceAccess(place, scopeId) }; } catch (e) { return assetActionError(e); }
}
export async function setPlaceAccessAction(input: { place: string; scopeId?: string; workerId: string; level: 'view' | 'act' | null }) {
  try { const data = await setPlaceAccess(input); revalidatePath('/workzone', 'layout'); return { ok: true as const, data }; } catch (e) { return assetActionError(e); }
}
export async function getWorkerAccessAction(workerId: string) {
  try { return { ok: true as const, data: await readWorkerAccessSummary(workerId) }; } catch (e) { return assetActionError(e); }
}
export async function setWorkerAccessLevelAction(input: { workerId: string; level: 'BASE' | 'FULL_VIEW' }) {
  try { const data = await setWorkerAccessLevel(input); revalidatePath('/workzone', 'layout'); return { ok: true as const, data }; } catch (e) { return assetActionError(e); }
}
