export type PhotoKind = 'machine' | 'site' | 'worker';
export const assetPhotoUrl = (
  kind: PhotoKind,
  id: string,
  at?: Date | string | null,
) =>
  at ? `/api/asset-photos/${kind}/${encodeURIComponent(id)}?v=${new Date(at).getTime()}` : null;
const en = {
  edit: 'Change photo',
  camera: 'Take photo',
  upload: 'Choose photo',
  saving: 'Saving photo…',
  saved: 'Photo saved',
  error: 'Choose a JPG, PNG or WebP photo up to 12 MB.',
  denied: 'Your role cannot change this photo.',
  busy: 'Another photo is processing. Try again shortly.',
  unavailable: 'The photo could not be saved. Try again shortly.',
};
export const photoCopy = (lang: string) =>
  lang === 'sq'
    ? {
        edit: 'Ndrysho foton',
        camera: 'Hap kamerën',
        upload: 'Zgjidh foto',
        saving: 'Duke ruajtur foton…',
        saved: 'Fotoja u ruajt',
        error: 'Zgjidh foto JPG, PNG ose WebP deri në 12 MB.',
        denied: 'Roli yt nuk mund ta ndryshojë këtë foto.',
        busy: 'Një foto tjetër po përpunohet. Provo pas pak.',
        unavailable: 'Fotoja nuk u ruajt. Provo përsëri pas pak.',
      }
    : lang === 'de'
      ? {
          edit: 'Foto ändern',
          camera: 'Kamera öffnen',
          upload: 'Foto auswählen',
          saving: 'Foto wird gespeichert…',
          saved: 'Foto gespeichert',
          error: 'JPG, PNG oder WebP bis 12 MB auswählen.',
          denied: 'Deine Rolle darf dieses Foto nicht ändern.',
          busy: 'Ein Foto wird verarbeitet. Bitte gleich erneut versuchen.',
          unavailable: 'Das Foto konnte nicht gespeichert werden. Bitte gleich erneut versuchen.',
        }
      : lang === 'it'
        ? {
            edit: 'Cambia foto',
            camera: 'Apri fotocamera',
            upload: 'Scegli foto',
            saving: 'Salvataggio foto…',
            saved: 'Foto salvata',
            error: 'Scegli JPG, PNG o WebP fino a 12 MB.',
            denied: 'Il tuo ruolo non può cambiare questa foto.',
            busy: 'Una foto è in elaborazione. Riprova tra poco.',
            unavailable: 'La foto non è stata salvata. Riprova tra poco.',
          }
        : lang === 'pl'
          ? {
              edit: 'Zmień zdjęcie',
              camera: 'Otwórz aparat',
              upload: 'Wybierz zdjęcie',
              saving: 'Zapisywanie zdjęcia…',
              saved: 'Zdjęcie zapisane',
              error: 'Wybierz JPG, PNG lub WebP do 12 MB.',
              denied: 'Twoja rola nie pozwala zmienić tego zdjęcia.',
              busy: 'Inne zdjęcie jest przetwarzane. Spróbuj za chwilę.',
              unavailable: 'Nie udało się zapisać zdjęcia. Spróbuj za chwilę.',
            }
          : lang === 'ro'
            ? {
                edit: 'Schimbă fotografia',
                camera: 'Deschide camera',
                upload: 'Alege fotografia',
                saving: 'Se salvează fotografia…',
                saved: 'Fotografie salvată',
                error: 'Alege JPG, PNG sau WebP de maximum 12 MB.',
                denied: 'Rolul tău nu permite schimbarea acestei fotografii.',
                busy: 'Se procesează altă fotografie. Încearcă din nou în curând.',
                unavailable: 'Fotografia nu a putut fi salvată. Încearcă din nou în curând.',
              }
            : en;
