const LANGS = ["sq", "en", "de", "it", "pl", "ro"] as const;

const words = {
  title: ["Plani ditor", "Daily plan", "Tagesplan", "Piano del giorno", "Plan dnia", "Planul zilei"],
  today: ["Sot", "Today", "Heute", "Oggi", "Dziś", "Azi"],
  previous: ["Dita e kaluar", "Previous day", "Vortag", "Giorno prima", "Poprzedni dzień", "Ziua anterioară"],
  next: ["Dita tjetër", "Next day", "Nächster Tag", "Giorno dopo", "Następny dzień", "Ziua următoare"],
  workers: ["Punëtorë", "Workers", "Mitarbeiter", "Operai", "Pracownicy", "Muncitori"],
  machines: ["Mjete", "Machines", "Maschinen", "Mezzi", "Maszyny", "Utilaje"],
  free: ["të lirë", "free", "frei", "liberi", "wolnych", "liberi"],
  search: ["Kërko emrin…", "Search name…", "Name suchen…", "Cerca nome…", "Szukaj nazwy…", "Caută nume…"],
  step: ["Zgjidh një punëtor ose mjet, pastaj shtyp kantierin.", "Pick a worker or machine, then tap the site.", "Mitarbeiter oder Maschine wählen, dann die Baustelle antippen.", "Scegli un operaio o un mezzo, poi tocca il cantiere.", "Wybierz pracownika lub maszynę, potem dotknij budowy.", "Alege un muncitor sau utilaj, apoi atinge șantierul."],
  picked: ["shtyp kantierin ku punon sot.", "tap the site for today.", "Baustelle für heute antippen.", "tocca il cantiere di oggi.", "dotknij budowy na dziś.", "atinge șantierul de azi."],
  cancel: ["Anulo", "Cancel", "Abbrechen", "Annulla", "Anuluj", "Anulează"],
  nobody: ["Askush ende", "Nobody yet", "Noch niemand", "Ancora nessuno", "Jeszcze nikt", "Încă nimeni"],
  dropHere: ["Shtyp këtu", "Tap here", "Hier antippen", "Tocca qui", "Dotknij tutaj", "Atinge aici"],
  remove: ["Hiq", "Remove", "Entfernen", "Rimuovi", "Usuń", "Elimină"],
  note: ["Shënim", "Note", "Notiz", "Nota", "Notatka", "Notă"],
  save: ["Ruaj planin", "Save plan", "Plan speichern", "Salva piano", "Zapisz plan", "Salvează planul"],
  clear: ["Pastro", "Clear", "Leeren", "Svuota", "Wyczyść", "Golește"],
  clearAsk: ["Të hiqen të gjithë nga plani i kësaj dite?", "Remove everyone from this day's plan?", "Alle aus dem Plan dieses Tages entfernen?", "Togliere tutti dal piano di questo giorno?", "Usunąć wszystkich z planu tego dnia?", "Scoți pe toți din planul acestei zile?"],
  saved: ["Ruajtur", "Saved", "Gespeichert", "Salvato", "Zapisano", "Salvat"],
  unsaved: ["Ka ndryshime pa ruajtur", "Unsaved changes", "Ungespeicherte Änderungen", "Modifiche non salvate", "Niezapisane zmiany", "Modificări nesalvate"],
  notSaved: ["Ende pa ruajtur", "Not saved yet", "Noch nicht gespeichert", "Non ancora salvato", "Jeszcze nie zapisano", "Încă nesalvat"],
  savedPlan: ["Plani i ruajtur", "Saved plan", "Gespeicherter Plan", "Piano salvato", "Zapisany plan", "Plan salvat"],
  savedHint: ["Këtë e shohin punëtorët.", "This is what the workers see.", "Das sehen die Mitarbeiter.", "Questo vedono gli operai.", "To widzą pracownicy.", "Asta văd muncitorii."],
  noPlan: ["Plani i kësaj dite nuk është ruajtur ende.", "The plan for this day is not saved yet.", "Der Plan für diesen Tag ist noch nicht gespeichert.", "Il piano di questo giorno non è ancora salvato.", "Plan na ten dzień nie jest jeszcze zapisany.", "Planul acestei zile nu este încă salvat."],
  youAre: ["Ti je te", "You are at", "Du bist bei", "Sei a", "Jesteś na", "Ești la"],
  notIn: ["Nuk je në planin e kësaj dite.", "You are not in this day's plan.", "Du bist heute nicht eingeplant.", "Non sei nel piano di oggi.", "Nie ma cię w planie tego dnia.", "Nu ești în planul acestei zile."],
  needsOk: ["Kërkon konfirmim", "Needs confirmation", "Bestätigung nötig", "Serve conferma", "Wymaga potwierdzenia", "Necesită confirmare"],
  inPlan: ["në plan", "planned", "eingeplant", "pianificato", "w planie", "planificat"],
  noMatch: ["Asnjë emër i tillë.", "No such name.", "Kein Treffer.", "Nessun risultato.", "Brak wyników.", "Niciun rezultat."],
} as const;

export type PlanCopy = { [K in keyof typeof words]: string };

export function planCopy(lang: string | null | undefined): PlanCopy {
  const index = Math.max(0, LANGS.indexOf((lang ?? "sq") as (typeof LANGS)[number]));
  return Object.fromEntries(Object.entries(words).map(([key, values]) => [key, values[index] ?? values[1]])) as PlanCopy;
}

const LOCALES: Record<string, string> = { sq: "sq-AL", en: "en-GB", de: "de-DE", it: "it-IT", pl: "pl-PL", ro: "ro-RO" };

/** "e hënë, 9 nëntor" style label for a yyyy-mm-dd key. */
export function planDayLabel(dateKey: string, lang: string | null | undefined) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  try {
    return new Intl.DateTimeFormat(LOCALES[lang ?? "sq"] ?? "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return dateKey;
  }
}
