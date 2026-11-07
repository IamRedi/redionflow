'use server';
import { revalidatePath } from 'next/cache';
import { saveAssetPhoto } from '@/lib/asset-photos/service';
import { logger } from '@/lib/observability/logger';
export async function uploadAssetPhoto(form: FormData) {
  try {
    const kind = form.get('kind');
    if (kind !== 'machine' && kind !== 'site' && kind !== 'worker')
      return { ok: false as const, code: 'PHOTO_FILE' };
    const result = await saveAssetPhoto(
      kind,
      String(form.get('id') ?? ''),
      form.get('file') as File,
    );
    revalidatePath('/workzone', 'layout');
    revalidatePath('/app/fleet-gps');
    revalidatePath('/app/baustellen');
    if (kind === 'worker') {
      const id = String(form.get('id'));
      revalidatePath('/workzone/profile');
      revalidatePath(`/workzone/admin-workers/${id}`);
      revalidatePath(`/app/admin/workers/${id}`);
    }
    return { ok: true as const, ...result };
  } catch (e) {
    const known = e instanceof Error && /^PHOTO_(FILE|BUSY|DENIED|NOT_FOUND)$/.test(e.message);
    if (!known) logger.warn({ event: 'asset.photo_save_failed' }, 'Photo was not changed; retry is available');
    return {
      ok: false as const,
      code:
        known && e instanceof Error
          ? e.message
          : 'PHOTO_UNAVAILABLE',
    };
  }
}
