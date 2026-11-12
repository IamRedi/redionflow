'use server';
import { revalidatePath } from 'next/cache';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import { OfficeError } from './work-access';
import { startOwnOfficeWork } from './presence';

export async function startOfficeWorkAction() {
  try {
    await startOwnOfficeWork();
    revalidatePath('/workzone', 'layout');
    notifyRealtimeUpdate('worker.session.updated', ['worker-strip', 'working-badge']);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof OfficeError ? error.code : 'FAILED' };
  }
}
