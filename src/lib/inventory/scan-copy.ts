const words = {
  photo: ['Foto e kodit', 'Code photo', 'Code-Foto', 'Foto del codice', 'Zdjęcie kodu', 'Fotografia codului'],
  code: ['Barkod / QR', 'Barcode / QR', 'Barcode / QR', 'Codice a barre / QR', 'Kod kreskowy / QR', 'Cod de bare / QR'],
  rescan: ['Skano sërish', 'Scan again', 'Erneut scannen', 'Scansiona ancora', 'Skanuj ponownie', 'Scanează din nou'],
  decoding: ['Duke lexuar kodin…', 'Reading code…', 'Code wird gelesen…', 'Lettura codice…', 'Odczytywanie kodu…', 'Se citește codul…'],
  notFound: ['Nuk u lexua kod. Afroje, ndriçoje ose fut kodin me shkrim.', 'No code read. Move closer, improve lighting or enter it manually.', 'Kein Code erkannt. Näher halten, besser beleuchten oder eingeben.', 'Codice non letto. Avvicina, illumina o inserisci a mano.', 'Nie odczytano kodu. Przybliż, doświetl lub wpisz ręcznie.', 'Cod necitit. Apropie, luminează sau introdu manual.'],
  camera: ['Kamera nuk u hap. Kontrollo lejen ose përdor foton/kodin me shkrim.', 'Camera unavailable. Check permission or use a photo/manual code.', 'Kamera nicht verfügbar. Berechtigung prüfen oder Foto/Code verwenden.', 'Fotocamera non disponibile. Controlla il permesso o usa foto/codice.', 'Kamera niedostępna. Sprawdź uprawnienia lub użyj zdjęcia/kodu.', 'Camera indisponibilă. Verifică permisiunea sau folosește foto/cod.'],
  photoLimit: ['Zgjidh një foto deri në 12 MB.', 'Choose a photo up to 12 MB.', 'Foto bis 12 MB auswählen.', 'Scegli una foto fino a 12 MB.', 'Wybierz zdjęcie do 12 MB.', 'Alege o fotografie până la 12 MB.'],
} satisfies Record<string, string[]>;
export function scanCopy(language: string) {
  const index = Math.max(0, ['sq','en','de','it','pl','ro'].indexOf(language));
  return Object.fromEntries(Object.entries(words).map(([key, values]) => [key, values[index]])) as { [K in keyof typeof words]: string };
}
