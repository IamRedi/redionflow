import type { AccessPlace } from "./rules";

const LANGS = ["sq", "en", "de", "it", "pl", "ro"] as const;
const words = {
  access: ["Akseset", "Access", "Zugriff", "Accessi", "Dostęp", "Acces"],
  acts: ["Vepron", "Can act", "Darf handeln", "Può operare", "Może działać", "Poate acționa"],
  registers: ["Regjistron pajisje", "Registers equipment", "Erfasst Geräte", "Registra attrezzature", "Rejestruje sprzęt", "Înregistrează echipamente"],
  registerHint: ["Shton pajisje të reja; kjo leje nuk jep menaxhimin e pajisjeve ekzistuese.", "Adds new equipment; this permission does not grant management of existing equipment.", "Erfasst neue Geräte; diese Freigabe erlaubt keine Verwaltung bestehender Geräte.", "Aggiunge nuove attrezzature; questo permesso non consente di gestire quelle esistenti.", "Dodaje nowy sprzęt; to uprawnienie nie pozwala zarządzać istniejącym sprzętem.", "Adaugă echipamente noi; această permisiune nu acordă gestionarea celor existente."],
  sees: ["Shikon", "Can view", "Darf sehen", "Può vedere", "Może widzieć", "Poate vedea"],
  add: ["Shto", "Add", "Hinzufügen", "Aggiungi", "Dodaj", "Adaugă"],
  remove: ["Hiq", "Remove", "Entfernen", "Rimuovi", "Usuń", "Elimină"],
  removed: ["Hequr", "Removed", "Entzogen", "Rimosso", "Odebrany", "Retras"],
  reset: ["Si kategoria", "As category", "Wie Kategorie", "Come categoria", "Jak kategoria", "Ca în categorie"],
  person: ["Personi", "Person", "Person", "Persona", "Osoba", "Persoana"],
  choose: ["Zgjidh…", "Choose…", "Auswählen…", "Scegli…", "Wybierz…", "Alege…"],
  admins: ["Admin, gjithçka", "Admin, everything", "Admin, alles", "Admin, tutto", "Admin, wszystko", "Admin, tot"],
  fromRole: ["nga roli", "from role", "durch Rolle", "dal ruolo", "z roli", "din rol"],
  partly: ["pjesërisht", "partly", "teilweise", "in parte", "częściowo", "parțial"],
  wholePlace: ["për të gjithë kantieret", "for all sites", "für alle Baustellen", "per tutti i cantieri", "dla wszystkich budów", "pentru toate șantierele"],
  thisSite: ["Ky kantier", "This site", "Diese Baustelle", "Questo cantiere", "Ta budowa", "Acest șantier"],
  allSites: ["Të gjithë kantieret", "All sites", "Alle Baustellen", "Tutti i cantieri", "Wszystkie budowy", "Toate șantierele"],
  fromLevel: ["nga kategoria", "from category", "durch Stufe", "dalla categoria", "z poziomu", "din categorie"],
  nobody: ["Askush ende.", "Nobody yet.", "Noch niemand.", "Ancora nessuno.", "Jeszcze nikt.", "Încă nimeni."],
  base: ["Bazë", "Basic", "Basis", "Base", "Podstawowy", "De bază"],
  full: ["Shikim i plotë", "Full view", "Volle Ansicht", "Vista completa", "Pełny podgląd", "Vizualizare completă"],
  level: ["Niveli", "Level", "Stufe", "Livello", "Poziom", "Nivel"],
  where: ["Ku ka akses", "Where they have access", "Wo Zugriff besteht", "Dove ha accesso", "Gdzie ma dostęp", "Unde are acces"],
  noGrants: ["Asnjë akses i veçantë.", "No extra access.", "Kein zusätzlicher Zugriff.", "Nessun accesso extra.", "Brak dodatkowego dostępu.", "Fără acces suplimentar."],
  baseHint: ["Sheh Workzone, kantieret, planin e ditës, profilin e vet dhe Flotën (karburant, defekt).", "Sees Workzone, sites, the daily plan, own profile and Fleet (fuel, defects).", "Sieht Workzone, Baustellen, Tagesplan, eigenes Profil und Flotte (Tanken, Mängel).", "Vede Workzone, cantieri, piano del giorno, profilo e Flotta (carburante, guasti).", "Widzi Workzone, budowy, plan dnia, własny profil i Flotę (paliwo, usterki).", "Vede Workzone, șantiere, planul zilei, profilul propriu și Flota (combustibil, defecte)."],
  fullHint: ["Sheh pothuajse gjithçka, pa kosto dhe pa profilet e të tjerëve. Vepron vetëm ku i jep akses.", "Sees almost everything except costs and other people's profiles. Acts only where given access.", "Sieht fast alles außer Kosten und fremden Profilen. Handelt nur mit Freigabe.", "Vede quasi tutto tranne costi e profili altrui. Opera solo dove autorizzato.", "Widzi prawie wszystko poza kosztami i profilami innych. Działa tylko z dostępem.", "Vede aproape tot, fără costuri și profilurile altora. Acționează doar unde are acces."],
  denied: ["Nuk ke akses këtu. Aksesin ta jep shefi.", "You have no access here. Your boss can give it.", "Kein Zugriff hier. Die Freigabe gibt der Chef.", "Non hai accesso qui. Te lo dà il capo.", "Nie masz tu dostępu. Nadaje go szef.", "Nu ai acces aici. Accesul îl dă șeful."],
  loading: ["Po hapet…", "Loading…", "Lädt…", "Caricamento…", "Ładowanie…", "Se încarcă…"],
  failed: ["Nuk u hap. Provo përsëri.", "Could not load. Try again.", "Laden fehlgeschlagen. Erneut versuchen.", "Caricamento non riuscito. Riprova.", "Nie wczytano. Spróbuj ponownie.", "Nu s-a încărcat. Încearcă din nou."],
  close: ["Mbyll", "Close", "Schließen", "Chiudi", "Zamknij", "Închide"],
} as const;

const places: Record<AccessPlace, readonly string[]> = {
  site: ["Kantieri", "Site", "Baustelle", "Cantiere", "Budowa", "Șantier"],
  field: ["Lista e montimit", "Field list", "Baustellenliste", "Lista di montaggio", "Lista montażu", "Lista de montaj"],
  factory: ["Linja e fabrikës", "Factory line", "Fertigungslinie", "Linea di fabbrica", "Linia produkcji", "Linia de fabrică"],
  new_project: ["Projekt i ri", "New project", "Neues Projekt", "Nuovo progetto", "Nowy projekt", "Proiect nou"],
  fleet_gps: ["Flota dhe GPS", "Fleet and GPS", "Flotte und GPS", "Flotta e GPS", "Flota i GPS", "Flotă și GPS"],
  workshop: ["Oficina", "Workshop", "Werkstatt", "Officina", "Warsztat", "Atelier"],
  warehouse: ["Magazina", "Warehouse", "Lager", "Magazzino", "Magazyn", "Depozit"],
  daily_plan: ["Plani i ditës", "Daily plan", "Tagesplan", "Piano del giorno", "Plan dnia", "Planul zilei"],
  costs: ["Kostot", "Costs", "Kosten", "Costi", "Koszty", "Costuri"],
  staff: ["Stafi dhe pushimet", "Staff and vacation", "Personal und Urlaub", "Personale e ferie", "Personel i urlopy", "Personal și concedii"],
};

export type AccessCopy = { [K in keyof typeof words]: string } & { place: (place: AccessPlace) => string };

export function accessCopy(lang: string): AccessCopy {
  const i = Math.max(0, (LANGS as readonly string[]).indexOf(lang));
  const out = Object.fromEntries(Object.entries(words).map(([key, value]) => [key, value[i]])) as { [K in keyof typeof words]: string };
  return { ...out, place: place => places[place][i] };
}
