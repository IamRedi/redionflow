# BaumdienstFlow / RediOnFlow - ADN

## Produktidentität

**BaumdienstFlow** ist die aktuelle Referenzimplementierung der Plattform fuer eine Baumdienst-Firma.

Langfristig gehoert die Plattform zur Master-Marke **RediOnFlow**:

- one codebase
- one platform
- multi-product
- mode-driven

BaumdienstFlow bleibt der reale Ausgangspunkt. BauFlow und PersonalFlow werden spaeter ueber `company.mode`, Konfiguration und UI-Vereinfachung abgeleitet.

## Zielgruppe & Rollen

- Sekretariat / Office Admin
- Kalkulator / Schätzer
- Inhaber / Geschäftsführung

## Produktwahrheit (Non‑Negotiables)

- **Editierbare Referenzen via UI sind Kernfunktion**: Lohnrollen, Maschinen, Overheads, Templates, Stammdaten.
- **Projekt → Positionen** ist die zentrale Struktur (position-basierte Kalkulation).
- **Kalkulationsengine ist Single Source of Truth**: keine Formeln in UI-Tabellen verstecken, keine Duplikate.
- **Ein Codebase, mehrere Deployment-/Produktmodi**: Unterschiede gehoeren in Deployment, Environment, Datenbank, Tenancy, `company.mode` und Feature Flags, nicht in doppelte App-Versionen.
- **Arbeitslohnlogik ist transparent**: effektiver Stundenverrechnungssatz muss herleitbar und in der UI erklärbar sein.
- **B2B UX**: ruhig, effizient, verlässlich, „deutsches Büro“, dark-mode friendly, keine Spielerei.
- **Dokumentation ist Teil des Produkts**: `docs/` ist verpflichtend und wird kontinuierlich gepflegt.

## Kalkulationsphilosophie (DE-Kalkulation)

Die Kalkulation folgt einer deutschen Kostenstruktur mit konfigurierbaren Prozentsätzen und Modi:

1. Lohn-Einzelkosten
2. Maschinen-Einzelkosten
3. Material-Einzelkosten
4. Fremdleistung-Einzelkosten
5. Summe = **Einzelkosten (EK)**
6. **BGK** auf definierter Basis → **Herstellkosten (HK)**
7. **AGK** auf definierter Basis → **Selbstkosten (SK)**
8. **Wagnis** (separat oder kombiniert)
9. **Gewinn** (separat oder kombiniert)
10. Ergebnis = **Angebot netto**
11. optional **MwSt** → **Brutto**

## Domain Guardrails

- Prozentwerte sind **konfigurierbar**, aber Engine muss deterministisch bleiben.
- Overrides (z. B. Stunden-/Tagessatz) müssen in der Summenlogik sauber abbildbar sein.
- „Aktiv/Inaktiv“ statt hartes Löschen, wo es Referenzen/History betrifft.
- Datenintegrität durch klare Relationen + sinnvolle Constraints.
- Workzone-Importe muessen idempotent sein: `TreeItem.treeId` ist innerhalb einer `Baustelle` eindeutig; Re-Importe aktualisieren nur fachliche Stammdaten und duerfen erledigte Arbeit/Koordinaten nicht ueberschreiben.
- Zukuenftige NFC-/Chip-Scans fuer Baeume duerfen diese Regel nicht aufweichen: die erkannte Kennung muss auf dieselbe fachliche Referenz (`treeId` / Baum-ID) fuehren, direkt zum passenden Baum in der aktuellen Baustelle springen und bei Nicht-Treffern nur kontrolliert `Baum hinzufuegen` anbieten.
- Manuelle Workzone-Korrekturen an Baeumen sind sichtbar zu auditieren (`isEdited`, `lastEditedBy`, `lastEditedAt`), ohne die Hauptliste zu ueberladen.
- HR/Flotte ist Teil der operativen Workzone: `Worker` ist getrennt von Office-`User`, Login erfolgt per Name + 6-stelligem `loginCode`, und Live-Status wird ausschliesslich durch `WorkSession.isLive` gesetzt.
- Maschinen sind in der Workzone als rechter Seiten-Rail sichtbar: Worker/Admin koennen Maschinenstatus, Foto, technische Details und Notizen direkt im Flow sehen; `Machine.isActive=false` bedeutet gesperrt/nicht verwenden.
- Flotten-GPS ist ein optionales Firmen-Feature, kein Pflichtverhalten: Firmen ohne GPS bleiben unveraendert, Firmen mit GPS koennen Maschinenstandort, Baustellen-Aufenthalt und Route aktivieren.
- Maschinen-GPS wird mit Baustellen-GPS ueber eine kontrollierte Geofence-Logik abgeglichen: Wenn eine Maschine in den Radius einer `Baustelle` faehrt, wird ein Aufenthalt mit `machineId`, `baustelleId`, `enteredAt`, `leftAt`, Dauer und Quelle nachvollziehbar gespeichert.
- Maschinenrouten duerfen nur fuer den Arbeitskontext gespeichert werden: route points gehoeren zu Maschine, Zeitraum, Quelle und optional `Baustelle`/`WorkSession`, nicht zu einer privaten Dauerueberwachung.
- Worker-Telefon-GPS darf nur waehrend einer aktiven WorkSession laufen: nach `Start Puna`, solange die App offen/aktiv ist, nicht waehrend manueller Pause und nur bis `Stop Puna`.
- Worker-Telefon-GPS ist kein Admin-Live-Tracking: Admins duerfen Worker nicht als persoenliche Live-GPS-Punkte verfolgen; Telefon-GPS dient nur als technischer Input fuer Tagesbericht, Baustellen-Zuordnung, Maschinen-/WorkSession-Kontext und Plausibilitaetsberechnung.
- Kein Tracking ausserhalb der Arbeit und kein Tracking in Pausen: Manual-Pause stoppt Telefon-GPS sofort; Resume darf GPS erst wieder starten, wenn die WorkSession aktiv weiterlaeuft und die App offen ist.
- GPS-Daten duerfen Tagesberichte nur fachlich ergaenzen: Maschine, Baustelle, Worker, Aufenthaltszeit und Route koennen den Einsatzkontext bestaetigen, aber Worker duerfen generierte Zeiten/Aktivitaeten nicht nachtraeglich manipulieren.
- Admin/Office-Zugriff ist getrennt von Worker-Zugriff: `User(role=ADMIN)` nutzt eine eigene Admin-Session (`bk_admin_id`), waehrend Worker nur `bk_worker_id` erhalten und nicht automatisch `/app/*` oeffnen duerfen.
- Worker-Profil ist eine gemeinsame Sicht fuer Worker und Admin: Admin sieht denselben Profilaufbau wie der Worker, inklusive Live-Status, Stunden, Berichte, Foto und Dokumenten.
- Worker-Dokumente bleiben kompakte Profilanhaenge; Arbeitskleidung und Ausruestung sind eigene Uebergabe-Items mit beidseitiger Bestaetigung zwischen Admin und Worker.
- Firmeninventar ist die Quelle der Wahrheit fuer bewegliche Gegenstaende: `CompanyInventoryItem` verwaltet Vegla pune, Klamote/Rroba und Pajisje Baustelle mit stabiler ID; `WorkerAssetItem` dokumentiert nur die Bewegung/Uebergabe an Worker.
- Barcode Inventory System:
  - `CompanyInventoryItem.barcode` ist der globale, eindeutig vergebene Scan-Schluessel fuer genau einen physischen Firmenartikel.
  - Geplante NFC-Unterstuetzung laeuft parallel zum Barcode und ersetzt ihn nicht: ein Firmenartikel kann spaeter Barcode plus NFC-Identitaet tragen, beide muessen aber auf denselben `CompanyInventoryItem` zeigen.
  - Kleidung kann optional eine `sizeLabel` tragen (z. B. `S`, `M`, `L`, `48`, `42`). Diese Groesse gehoert zum Lagerartikel und wird bei der Uebergabe an den Worker mitgespeichert.
  - Die Lagerlogik ist stueckgenau: 5 Motorsaegen bedeuten 5 Inventarzeilen mit 5 unterschiedlichen Barcodes, auch wenn Name/Kategorie gleich sind.
  - `WorkerAssetItem` speichert zusaetzlich `barcode`, `sizeLabel` und `isPrivate`, damit scanbasierte Uebergaben, Groessen und private Gegenstaende im Profil sichtbar bleiben.
  - Worker-Profile speichern persoenliche Bekleidungsgroessen getrennt als `clothingTopSize`, `clothingBottomSize` und `shoeSize`.
  - Worker-bezogene Barcode-Audits laufen ueber `InventoryAssetMovement` und nicht ueber das bestehende Baustellenmaterial-Ledger `InventoryMovement`.
  - Admin-Workflow: Barcode scannen -> Name/Typ erfassen -> Artikel wird als `IN_STOCK` im Firmenlager registriert.
  - Ein Firmen-Barcode ist write-once: wurde er gescannt oder einmal generiert, bleibt er fest am Artikel und ist danach weder editierbar noch regenerierbar.
  - Manuelle Lagerartikel duerfen anfangs ohne Barcode existieren; in diesem Fall kann spaeter genau einmal ein Barcode gesetzt oder generiert und danach gedruckt werden.
  - Worker-Workflow: Barcode im Profil scannen -> wenn Firmenartikel vorhanden und frei, wird er automatisch uebernommen und als `TAKE` geloggt.
  - Geplanter Parallel-Workflow: ein NFC-Scan bei Kleidung, Werkzeug oder Ausruestung soll spaeter denselben Uebergabeprozess wie Barcode ausloesen, damit Teams je nach Etikett oder Tag dasselbe Lagerobjekt ohne Doppellogik erreichen.
  - Scan-UI bleibt ein Einstieg: Nutzer sehen zuerst nur `Scan` und waehlen danach NFC oder Code/QR; beide Wege muessen denselben Barcode-/Inventarprozess nutzen.
  - Nach erfolgreicher Uebergabe springt die Profil-UI direkt in die passende Liste (`Kleidung` oder `Ausruestung`), damit der gerade uebernommene Artikel sofort sichtbar ist.
  - Admin kann in der Kleidungsspalte nach Groessen filtern; die Filterzahl zeigt nur frei verfuegbare Lagerstuecke (`IN_STOCK`) dieser Groesse.
  - Kein Assignment und keine Rueckgabe ohne Log-Eintrag: `TAKE`, `RETURN`, `CREATE_PRIVATE`.
  - Unbekannte Barcodes duerfen nur im Worker-Scan als private Gegenstaende aufgenommen werden; ihre Barcodes muessen nicht global eindeutig sein.
  - Sticker werden lokal/offline als Barcode-SVG gerendert und ueber `/app/admin/inventory/print` im A4-Grid gedruckt.
- Worker-Zeitberichte sind Tickets: Tagesberichte zeigen nur geleistete Baustellenarbeit (`TreeItem`s und `ManualTask`s) pro Baustelle; Stundenzettel sind Monatsdokumente mit 28-31 Tageszeilen aus `WorkSession`. Worker duerfen nur Notizen ergaenzen, nicht die generierten Aktivitaeten/Zeiten nachtraeglich veraendern.
- Extra-Baeume aus der Baustelle duerfen von Workern/Admins kontrolliert erfasst werden, muessen aber im `TreeItem.notes` auditierbar markiert bleiben (`extraTree`, `addedByName`, optional `scanCode` + normalisiertes `scanIdentity`) und in Listen/Tagesberichten sichtbar als Extra Baum erscheinen. `scanIdentity` ist die technische Wiedererkennung fuer QR/NFC und darf unabhaengig von spaeter geaenderter Baum-ID/Name matchen.
- Pausenlogik ist restriktiv: unter/gleich 4 Stunden default 0 Minuten, ueber 4 Stunden default 30 Minuten; erlaubt sind nur 0, 15, 30 oder 60 Minuten.
- Manuelle Pause wird spaeter als eigene Zeitstruktur behandelt: `pauseStart`/`pauseEnd`-Intervalle sind die Quelle fuer Pausenzeit, stoppen GPS-Tracking und ersetzen beim Stoppen der Arbeit die automatische 30-Minuten-Pause-Empfehlung.
- Baustelle-Start/Stop muss vergessene Klicks abfangen: Start fragt "jetzt oder 07:00" mit editierbarer Uhrzeit; Stop nach 16:30 fragt "jetzt oder 16:30" mit editierbarer Uhrzeit.
- Profil ist die bewusste Zeitkorrektur-Stelle: START im Profil fragt nach "tani" oder editierbarer Uhrzeit; Baustelle fragt nur, wenn noch keine Live-Session aktiv ist.
- Sessions unter 60 Sekunden gelten als Fehlklick und werden nicht als Stunden-/Tagesbericht-Daten gespeichert.
- Vergessene Standard-Tages-Sessions werden auditierbar automatisch geschlossen: fruehe Tagesschicht (ca. 05:00-12:00 Start) bleibt bis nach 12:00 am Folgetag live, dann schliesst das System sie auf 16:00 mit 30 min Pause und markiert `closedBySystem=true`.
- Worker-Disponibilitaet (`AVAILABLE`, `SICK`, `VACATION`, `UNAVAILABLE`) blockiert neue Live-Sessions, wenn der Worker nicht verfuegbar ist.
- Geplante Workzone-Offline-Faehigkeit ist ein Outbox-/Sync-System, kein zweiter Datenbestand: operative Aktionen duerfen lokal in IndexedDB zwischengespeichert werden, aber der Server bleibt die Quelle der Wahrheit und entscheidet Konflikte. Details: `docs/WORKZONE_OFFLINE_SYNC.md`.
- Das bestehende Kalkulationsmodell `Machine` bleibt kompatibel; Flottenfelder werden daran ergaenzt statt eine zweite Maschinenstruktur aufzubauen.

## Architekturprinzipien

- **Domain-first**: Rechenlogik und Domänentypen in `src/lib/calculation/*`.
- **UI = Darstellung & Eingabe**, nicht Business Rules.
- **Typed boundaries**: Zod für IO, TypeScript für interne Typen.
- **Modular & testbar**: Engine ist unabhängig von Next/React.
- **Keine Parallelstrukturen**: ein klarer Datenzugang (Prisma) und eine Engine.
- **Deployment getrennt vom Produktcode**: Railway/Supabase fuer Demo/Test und Docker/dedizierter Server fuer Kundenproduktion duerfen keine fachliche Code-Duplikation erzeugen.

## Naming-Regeln

- Explizite, domänengetriebene Namen (Deutsch in UI, Code-Modelle konsistent Englisch/Domain).
- „Project“ = Kalkulationscontainer, „Position“ = kalkulierte Einheit mit Kostenzeilen.
- Overhead-Begriffe: EK/HK/SK/BGK/AGK/Wagnis/Gewinn/MwSt.

## Branding Guardrails

- Header branding is centralized in `src/lib/branding.ts`.
- `appName` can change per client/category, for example `Baumdienst` or `AutoService`.
- `Flow` remains the fixed platform suffix.
- The global RediON footer is the discreet ownership/product signature.
- Primary accent uses the logo green; dark mode should stay neutral grey, not blue-heavy slate.
- The top Flow shell (logo, Home, Panel, worker strip, admin profile buttons) should stay visually stable across Workzone and Admin/Panel routes; route changes must not create alternative header variants.
- Admin assistant access belongs to one single AI-badged logo trigger in that shared top shell; no duplicate assistant triggers should appear elsewhere in the page chrome.
- UI writing hierarchy for compact info cards/lists must stay typographically honest:
  - title/subtitle spacing may be generous enough to create hierarchy,
  - but body rows inside the same shell should stay tighter to each other than to the title,
  - and shells should hug the content instead of looking oversized relative to the text.

## SaaS/Product Mode Guardrails

- The long-term platform is one codebase, one platform, multi-product, and mode-driven.
- No separate BaumdienstFlow, BauFlow, or PersonalFlow apps are allowed.
- BaumdienstFlow is the SaaS reference implementation and must stay equivalent to the current real-client product before other modes are simplified.
- BauFlow is derived from the same operational company logic, with tree-specific modules hidden or replaced by construction-focused terminology and workflows.
- PersonalFlow is derived after BauFlow by simplifying UI and hiding advanced team/company surfaces.
- Product behavior must come from `company.mode` and central feature flags, not hardcoded product checks.
- `RediOnFlow` is the master/legal/document brand, not the primary top-right in-app product name.
- SaaS and dedicated-client deployments must keep the same logic and database structure; only environment, deployment, tenancy, and mode may differ.
