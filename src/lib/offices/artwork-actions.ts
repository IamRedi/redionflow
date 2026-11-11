'use server';
import { saveOfficeArtwork } from './artwork';
import { OfficeError } from './work-access';
export async function updateOfficeArtwork(form: FormData) {
  try { return { ok: true as const, artwork: await saveOfficeArtwork(form) }; }
  catch (error) { return { ok: false as const, code: error instanceof OfficeError ? error.code : 'INVALID' }; }
}
