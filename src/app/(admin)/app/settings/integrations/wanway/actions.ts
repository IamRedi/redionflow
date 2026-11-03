'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { TrackPoint } from '@/lib/fleet/wanway/adapter';
import {
  bindDevice,
  disconnect,
  errorCode,
  loadHistory,
  saveCredentials,
  syncDevices,
} from '@/lib/fleet/wanway/service';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save'),
    appid: z.string().trim().min(1).max(200),
    key: z.string().max(512),
    approved: z.boolean(),
  }),
  z.object({ action: z.literal('disconnect') }),
  z.object({ action: z.literal('test') }),
  z.object({ action: z.literal('sync') }),
  z.object({
    action: z.literal('link'),
    id: z.string().min(1).max(100),
    machineId: z.string().max(100).nullable(),
  }),
  z.object({ action: z.literal('history'), id: z.string().min(1).max(100) }),
]);

export async function wanwayAction(
  input: unknown,
): Promise<{
  ok: boolean;
  code?: string;
  count?: number;
  points?: TrackPoint[];
  fetchedAt?: string;
}> {
  const result = schema.safeParse(input);
  if (!result.success) return { ok: false, code: 'INVALID' };
  try {
    const d = result.data;
    let count: number | undefined;
    if (d.action === 'save') await saveCredentials(d.appid, d.key, d.approved);
    if (d.action === 'disconnect') await disconnect();
    if (d.action === 'link') await bindDevice(d.id, d.machineId);
    if (d.action === 'test' || d.action === 'sync')
      count = await syncDevices(d.action === 'test');
    if (d.action === 'history') {
      const history = await loadHistory(d.id);
      return { ok: true, count: history.points.length, ...history };
    }
    revalidatePath('/app/settings/integrations/wanway');
    revalidatePath('/app/fleet-gps', 'layout');
    return { ok: true, count };
  } catch (error) {
    return { ok: false, code: errorCode(error) };
  }
}
