import { ZodError } from 'zod';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { AssetOperationError } from './access';

const copy = {
  sq: ['Veprimi nuk u ruajt. Rifresko dhe provo përsëri.', 'Nuk ke të drejtë për këtë veprim.', 'Të dhënat kanë ndryshuar. Rifresko përpara se të vazhdosh.', 'Pajisja nuk është e disponueshme. Kontrollo dorëzimin, raportimet dhe oficinën.', 'Konfirmo provën e funksionimit dhe shto shënimin ose dokumentimin e riparimit.', 'Skedari nuk pranohet. Përdor foto JPG/PNG/WebP deri në 12 MB ose PDF deri në 5 MB.', 'Përdor Magazina / Oficina për këtë veprim dhe konfirmimet e nevojshme.'],
  en: ['Nothing was saved. Refresh and try again.', 'You cannot perform this action.', 'The record changed. Refresh before continuing.', 'This asset is unavailable. Check handovers, reports and workshop.', 'Confirm the function test and add repair notes or evidence.', 'File refused. Use JPG/PNG/WebP up to 12 MB or PDF up to 5 MB.', 'Use Warehouse / Workshop for this action and its required confirmations.'],
  de: ['Nicht gespeichert. Aktualisieren und erneut versuchen.', 'Keine Berechtigung für diese Aktion.', 'Der Datensatz wurde geändert. Bitte aktualisieren.', 'Nicht verfügbar. Übergaben, Meldungen und Werkstatt prüfen.', 'Funktionsprüfung bestätigen und Reparaturnotiz oder Beleg ergänzen.', 'Datei abgelehnt. JPG/PNG/WebP bis 12 MB oder PDF bis 5 MB verwenden.', 'Lager / Werkstatt für diese Aktion und die erforderlichen Bestätigungen verwenden.'],
  it: ['Non salvato. Aggiorna e riprova.', 'Non puoi eseguire questa azione.', 'Il record è cambiato. Aggiorna prima di continuare.', 'Bene non disponibile. Controlla consegne, segnalazioni e officina.', 'Conferma il test e aggiungi note o documenti della riparazione.', 'File rifiutato. JPG/PNG/WebP fino a 12 MB o PDF fino a 5 MB.', 'Usa Magazzino / Officina per questa azione e le conferme richieste.'],
  pl: ['Nie zapisano. Odśwież i spróbuj ponownie.', 'Brak uprawnień do tej operacji.', 'Dane zmieniły się. Odśwież przed kontynuowaniem.', 'Zasób niedostępny. Sprawdź przekazania, zgłoszenia i warsztat.', 'Potwierdź test działania i dodaj notatkę lub dokumentację naprawy.', 'Plik odrzucony. JPG/PNG/WebP do 12 MB lub PDF do 5 MB.', 'Użyj Magazynu / Warsztatu i wymaganych potwierdzeń.'],
  ro: ['Nu s-a salvat. Reîncarcă și încearcă din nou.', 'Nu ai dreptul să faci această operațiune.', 'Datele s-au schimbat. Reîncarcă înainte de a continua.', 'Indisponibil. Verifică predările, raportările și atelierul.', 'Confirmă testul și adaugă nota sau documentația reparației.', 'Fișier refuzat. JPG/PNG/WebP până la 12 MB sau PDF până la 5 MB.', 'Folosește Depozit / Atelier pentru operațiune și confirmările necesare.'],
} as const;
export async function assetActionError(error: unknown) {
  const code = error instanceof AssetOperationError ? error.code : error instanceof ZodError ? 'INVALID_INPUT' : 'FAILED';
  const text = copy[await resolveRequestLanguage()];
  const index = code === 'DENIED' || code === 'NOT_FOUND' ? 1 : code === 'CONFLICT' ? 2 : ['ASSET_UNAVAILABLE','REPAIR_ALREADY_OPEN','WORKER_UNAVAILABLE','SITE_UNAVAILABLE'].includes(code) ? 3 : code === 'REPAIR_EVIDENCE_REQUIRED' ? 4 : code.startsWith('FILE_') ? 5 : ['LEGACY_CONFIRMATION_REQUIRED','AMBIGUOUS_CUSTODY','USE_REPAIR_WORKFLOW','RETURN_REQUIRED','RETURN_NOTE_REQUIRED'].includes(code) ? 6 : 0;
  return { ok: false as const, message: text[index], code };
}
export async function assetWorkflowMessage() { return copy[await resolveRequestLanguage()][6]; }
