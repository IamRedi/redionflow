'use server';
import { revalidatePath } from 'next/cache';
import { syncFleetLocations, errorCode } from '@/lib/fleet/wanway/service';
export async function refreshFleetAction() {
  try {
    const count = await syncFleetLocations();
    revalidatePath('/workzone', 'layout');
    revalidatePath('/app/fleet-gps', 'layout');
    return { ok: true as const, count };
  } catch (error) {
    return { ok: false as const, code: errorCode(error) };
  }
}
