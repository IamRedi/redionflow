'use server';
import { revalidatePath } from 'next/cache';
import { saveAssetPhoto } from '@/lib/asset-photos/service';
export async function uploadAssetPhoto(form: FormData) {
  try {
    const kind = form.get('kind');
    if (kind !== 'machine' && kind !== 'site')
      return { ok: false as const, code: 'PHOTO_FILE' };
    const result = await saveAssetPhoto(
      kind,
      String(form.get('id') ?? ''),
      form.get('file') as File,
    );
    revalidatePath('/workzone', 'layout');
    revalidatePath('/app/fleet-gps');
    revalidatePath('/app/baustellen');
    return { ok: true as const, ...result };
  } catch (e) {
    return {
      ok: false as const,
      code:
        e instanceof Error && /^PHOTO_(FILE|BUSY|DENIED)$/.test(e.message)
          ? e.message
          : 'PHOTO_FILE',
    };
  }
}
