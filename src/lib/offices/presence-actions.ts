'use server';
import { revalidatePath } from 'next/cache';
import { notifyRealtimeUpdate } from '@/lib/realtime/event-hub';
import { OfficeError } from './work-access';
import { startOwnOfficeWork, stopOwnOfficeWork } from './presence';

export async function startOfficeWorkAction() {
  try {
    const companyId = await startOwnOfficeWork();
    revalidatePath('/workzone', 'layout');
    notifyRealtimeUpdate('worker.session.updated', ['worker-strip', 'working-badge'], companyId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof OfficeError ? error.code : 'FAILED' };
  }
}

export async function stopOfficeWorkAction(sessionId: unknown) {
  try {
    await stopOwnOfficeWork(sessionId);
    revalidatePath('/workzone', 'layout');
    // The shared stop action already publishes the attendance update.
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof OfficeError ? error.code : 'FAILED' };
  }
}
