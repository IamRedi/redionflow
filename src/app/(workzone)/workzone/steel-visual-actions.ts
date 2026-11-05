'use server';
import { revalidatePath } from 'next/cache';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { getActionTranslator } from '@/lib/i18n/action-messages';
import { photoCopy } from '@/lib/asset-photos/shared';
import { generateSteelWorkVisual, uploadSteelWorkVisual } from '@/lib/steel-work/media';

export async function uploadSteelWorkVisualAction(form: FormData) {
  const lang = await resolveRequestLanguage(), tr = await getActionTranslator();
  try {
    const file = form.get('file');
    if (!(file instanceof File)) return { ok: false as const, message: photoCopy(lang).error };
    const result = await uploadSteelWorkVisual(String(form.get('definitionId') ?? ''), Number(form.get('revision')), file);
    revalidatePath('/workzone', 'layout');
    return { ok: true as const, message: photoCopy(lang).saved, ...result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error && error.message === 'VISUAL_DENIED' ? tr('accessDenied') : photoCopy(lang).error };
  }
}

export async function generateSteelWorkVisualAction(input: { definitionId: string; revision: number }) {
  const lang = await resolveRequestLanguage();
  const unavailable: Record<string, string> = {
    sq: 'Detyra u ruajt. Ilustrimi nuk u krijua; provo përsëri më vonë.',
    en: 'The work item is saved. The illustration could not be created; try again later.',
    de: 'Der Arbeitsschritt ist gespeichert. Die Illustration konnte nicht erstellt werden; bitte später erneut versuchen.',
    it: 'La voce è salvata. Impossibile creare l’illustrazione; riprova più tardi.',
    ro: 'Operația este salvată. Ilustrația nu a putut fi creată; încearcă mai târziu.',
    pl: 'Pozycja jest zapisana. Nie udało się utworzyć ilustracji; spróbuj później.',
  };
  try {
    const result = await generateSteelWorkVisual(input?.definitionId, input?.revision);
    revalidatePath('/workzone', 'layout');
    return { ok: true as const, message: 'OK', ...result };
  } catch (error) {
    if (error instanceof Error && error.message === 'VISUAL_QUOTA') {
      const quota: Record<string, string> = {
        sq: 'Kufiri i ilustrimeve u arrit. Provo më vonë; figura ekzistuese ruhet.',
        en: 'The illustration limit was reached. Try later; the existing image is kept.',
        de: 'Das Illustrationslimit ist erreicht. Bitte später erneut versuchen; das bestehende Bild bleibt erhalten.',
        it: 'Limite delle illustrazioni raggiunto. Riprova più tardi; l’immagine esistente viene conservata.',
        ro: 'Limita de ilustrații a fost atinsă. Încearcă mai târziu; imaginea existentă este păstrată.',
        pl: 'Osiągnięto limit ilustracji. Spróbuj później; dotychczasowy obraz pozostaje.',
      };
      return { ok: false as const, message: quota[lang] ?? quota.en, status: 'quota' };
    }
    return { ok: false as const, message: unavailable[lang] ?? unavailable.en, status: 'error' };
  }
}
