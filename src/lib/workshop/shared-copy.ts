const en = {
  demoHint: "Public demo: changes and files are visible on every device. Use fictional test data only.",
  saved: "Saved in the shared demo.", saving: "Saving…", loading: "Loading the shared demo…", connection: "Cannot reach the demo. Your change has not been confirmed. Reconnect and refresh.", conflict: "Another device changed the demo. The latest state is shown; check it and try again.", busy: "The demo is busy. Please try again shortly.", storage: "The shared demo has reached its storage limit. Your change was not saved.",
  documentHint: "PDF or TXT up to 1 MB; JPG, PNG or WebP photos up to 12 MB are compressed automatically. Shared across devices.", fileError: "Choose a valid PDF/TXT up to 1 MB or a JPG/PNG/WebP photo up to 12 MB.",
  localScope: "Shared Baumdienst demo only. Real operations and AL Steel remain separate. Workshop history survives the nightly base-data reset.",
  photos: "Photos", photoHint: "Sample photos only. Compressed automatically and saved in this shared demo.", noPhotos: "No photos yet.", photoEvent: "Photo added", partsHistory: "Stock movements", stockAdded: "Restocked", stockUsed: "Used in repair", process: "Repair process", refresh: "Refresh", shared: "Shared demo", synced: "Last saved", noReset: "Shared history is retained.",
};
type SharedCopy = { [K in keyof typeof en]: string };
const de: SharedCopy = {
  demoHint: "Öffentliche Demo: Änderungen und Dateien sind auf allen Geräten sichtbar. Nur fiktive Testdaten verwenden.",
  saved: "In der gemeinsamen Demo gespeichert.", saving: "Wird gespeichert…", loading: "Gemeinsame Demo wird geladen…", connection: "Demo nicht erreichbar. Deine Änderung ist noch nicht bestätigt. Verbindung prüfen und aktualisieren.", conflict: "Ein anderes Gerät hat die Demo geändert. Der aktuelle Stand wird angezeigt; bitte prüfen und erneut versuchen.", busy: "Die Demo ist gerade ausgelastet. Bitte gleich erneut versuchen.", storage: "Der Speicher der gemeinsamen Demo ist voll. Deine Änderung wurde nicht gespeichert.",
  documentHint: "PDF oder TXT bis 1 MB; Fotos als JPG, PNG oder WebP bis 12 MB werden automatisch verkleinert. Auf allen Geräten verfügbar.", fileError: "Gültiges PDF/TXT bis 1 MB oder Foto als JPG/PNG/WebP bis 12 MB auswählen.",
  localScope: "Nur die gemeinsame Baumdienst-Demo. Echter Betrieb und AL Steel bleiben getrennt. Die Werkstatthistorie bleibt beim nächtlichen Reset der Basisdaten erhalten.",
  photos: "Fotos", photoHint: "Nur Beispielfotos. Automatisch verkleinert und in dieser gemeinsamen Demo gespeichert.", noPhotos: "Noch keine Fotos.", photoEvent: "Foto hinzugefügt", partsHistory: "Lagerbewegungen", stockAdded: "Aufgefüllt", stockUsed: "In Reparatur verwendet", process: "Reparaturablauf", refresh: "Aktualisieren", shared: "Gemeinsame Demo", synced: "Zuletzt gespeichert", noReset: "Die gemeinsame Historie bleibt erhalten.",
};
const sq: SharedCopy = {
  demoHint: "Demo publike: ndryshimet dhe skedarët shihen nga çdo pajisje. Përdor vetëm të dhëna fiktive.",
  saved: "U ruajt në demon e përbashkët.", saving: "Duke ruajtur…", loading: "Duke ngarkuar demon e përbashkët…", connection: "Demoja nuk arrihet. Ndryshimi yt ende nuk është konfirmuar. Kontrollo lidhjen dhe rifresko.", conflict: "Një pajisje tjetër ndryshoi demon. Po shfaqet gjendja e fundit; kontrolloje dhe provo përsëri.", busy: "Demoja është e zënë. Provo pas pak.", storage: "Hapësira e demos së përbashkët është plot. Ndryshimi nuk u ruajt.",
  documentHint: "PDF ose TXT deri në 1 MB; fotot JPG, PNG ose WebP deri në 12 MB zvogëlohen automatikisht. Shihen nga çdo pajisje.", fileError: "Zgjidh PDF/TXT të vlefshëm deri në 1 MB ose foto JPG/PNG/WebP deri në 12 MB.",
  localScope: "Vetëm demoja e përbashkët Baumdienst. Puna reale dhe AL Steel mbeten të ndara. Historiku i oficinës ruhet gjatë reset-it të natës të të dhënave bazë.",
  photos: "Fotot", photoHint: "Vetëm foto prove. Zvogëlohen automatikisht dhe ruhen në këtë demo të përbashkët.", noPhotos: "Ende pa foto.", photoEvent: "U shtua foto", partsHistory: "Lëvizjet e magazinës", stockAdded: "U furnizua", stockUsed: "U përdor në riparim", process: "Procesi i riparimit", refresh: "Rifresko", shared: "Demo e përbashkët", synced: "Ruajtja e fundit", noReset: "Historiku i përbashkët ruhet.",
};
const it: SharedCopy = {
  demoHint: "Demo pubblica: modifiche e file visibili su ogni dispositivo. Usa solo dati fittizi.",
  saved: "Salvato nella demo condivisa.", saving: "Salvataggio…", loading: "Caricamento della demo condivisa…", connection: "Demo non raggiungibile. La modifica non è ancora confermata. Controlla la connessione e aggiorna.", conflict: "Un altro dispositivo ha modificato la demo. È mostrato lo stato aggiornato; controlla e riprova.", busy: "La demo è occupata. Riprova tra poco.", storage: "La memoria della demo condivisa è piena. La modifica non è stata salvata.",
  documentHint: "PDF o TXT fino a 1 MB; foto JPG, PNG o WebP fino a 12 MB compresse automaticamente. Disponibili su ogni dispositivo.", fileError: "Scegli un PDF/TXT valido fino a 1 MB o una foto JPG/PNG/WebP fino a 12 MB.",
  localScope: "Solo demo Baumdienst condivisa. Attività reali e AL Steel restano separati. Lo storico officina rimane dopo il ripristino notturno dei dati di base.",
  photos: "Foto", photoHint: "Solo foto di prova. Compresse automaticamente e salvate nella demo condivisa.", noPhotos: "Nessuna foto.", photoEvent: "Foto aggiunta", partsHistory: "Movimenti di magazzino", stockAdded: "Rifornito", stockUsed: "Usato in riparazione", process: "Processo di riparazione", refresh: "Aggiorna", shared: "Demo condivisa", synced: "Ultimo salvataggio", noReset: "Lo storico condiviso viene conservato.",
};
const pl: SharedCopy = {
  demoHint: "Publiczne demo: zmiany i pliki są widoczne na każdym urządzeniu. Tylko fikcyjne dane testowe.",
  saved: "Zapisano we wspólnym demo.", saving: "Zapisywanie…", loading: "Ładowanie wspólnego demo…", connection: "Brak połączenia z demo. Zmiana nie została potwierdzona. Sprawdź połączenie i odśwież.", conflict: "Inne urządzenie zmieniło dane. Pokazano aktualny stan; sprawdź go i spróbuj ponownie.", busy: "Demo jest zajęte. Spróbuj za chwilę.", storage: "Pamięć wspólnego demo jest pełna. Zmiana nie została zapisana.",
  documentHint: "PDF lub TXT do 1 MB; zdjęcia JPG, PNG lub WebP do 12 MB są automatycznie zmniejszane. Dostępne na każdym urządzeniu.", fileError: "Wybierz prawidłowy PDF/TXT do 1 MB lub zdjęcie JPG/PNG/WebP do 12 MB.",
  localScope: "Tylko wspólne demo Baumdienst. Rzeczywista praca i AL Steel pozostają oddzielne. Historia warsztatu przetrwa nocny reset danych bazowych.",
  photos: "Zdjęcia", photoHint: "Tylko zdjęcia testowe. Automatycznie zmniejszane i zapisywane we wspólnym demo.", noPhotos: "Brak zdjęć.", photoEvent: "Dodano zdjęcie", partsHistory: "Ruchy magazynowe", stockAdded: "Uzupełniono", stockUsed: "Zużyto w naprawie", process: "Proces naprawy", refresh: "Odśwież", shared: "Wspólne demo", synced: "Ostatni zapis", noReset: "Wspólna historia jest zachowywana.",
};
const ro: SharedCopy = {
  demoHint: "Demo public: modificările și fișierele sunt vizibile pe orice dispozitiv. Folosește doar date fictive.",
  saved: "Salvat în demo-ul comun.", saving: "Se salvează…", loading: "Se încarcă demo-ul comun…", connection: "Demo-ul nu poate fi accesat. Modificarea nu este confirmată. Verifică conexiunea și reîncarcă.", conflict: "Un alt dispozitiv a modificat demo-ul. Este afișată starea actuală; verifică și încearcă din nou.", busy: "Demo-ul este ocupat. Încearcă din nou în curând.", storage: "Spațiul demo-ului comun este plin. Modificarea nu a fost salvată.",
  documentHint: "PDF sau TXT de maximum 1 MB; fotografiile JPG, PNG sau WebP de maximum 12 MB sunt comprimate automat. Disponibile pe orice dispozitiv.", fileError: "Alege PDF/TXT valid de maximum 1 MB sau fotografie JPG/PNG/WebP de maximum 12 MB.",
  localScope: "Doar demo-ul comun Baumdienst. Activitatea reală și AL Steel rămân separate. Istoricul atelierului rămâne după resetarea nocturnă a datelor de bază.",
  photos: "Fotografii", photoHint: "Doar fotografii de probă. Comprimate automat și salvate în demo-ul comun.", noPhotos: "Încă nu există fotografii.", photoEvent: "Fotografie adăugată", partsHistory: "Mișcări de stoc", stockAdded: "Stoc completat", stockUsed: "Folosit în reparație", process: "Proces de reparație", refresh: "Reîncarcă", shared: "Demo comun", synced: "Ultima salvare", noReset: "Istoricul comun este păstrat.",
};
export function sharedWorkshopCopy(lang: string): SharedCopy { return ({ en, de, sq, it, pl, ro } as Record<string, SharedCopy>)[lang] ?? en; }
