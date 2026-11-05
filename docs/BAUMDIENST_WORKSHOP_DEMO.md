# BaumdienstFlow: Werkstatt-Demo und UX-Abgleich

Stand: 5. November 2026. **Lokaler Kandidat, nicht veröffentlicht und nicht für reale Betriebsdaten.** Grundlage ist `807519b1a4dea650645aa153db49000406af3a7f` aus dem BauFlow-Pilotzweig. Die öffentliche Baumdienst-Demo läuft davon unabhängig auf `main`.

## Auftrag und fachliche Übertragung

Der Eigentümer möchte die erprobte BauFlow-Oberfläche auf das fiktive Baumdienst-Demoprofil übertragen. An die Stelle der Fertigungsübersicht tritt die Werkstatt. Hier werden Fahrzeuge und einzelne Geräte mit Defekt angenommen, repariert und nach Prüfung wieder freigegeben. Die Baumdienst-Farben, bestehenden Karten, Schriften, Icons und Komponenten bleiben erhalten.

Die drei Reparaturzustände sind **Angenommen → In Reparatur → Repariert**. Eine erfolgreich dokumentierte Reparatur ist von der bewussten Freigabe für den nächsten Einsatz getrennt. Das ist eine Probe des Workflows, keine echte Prüfbescheinigung.

## Befunde und Änderungen

| Bereich | Befund im Ausgangsstand | Kandidat / verbleibende Grenze |
| --- | --- | --- |
| Einstieg und Team | Demo-Header mit passivem AI-Badge, mehrfacher Demo-Kennzeichnung, kleinen Navigationszielen | Team direkt neben dem Logo; klare Workzone-/Werkstatt-Navigation, Theme-Schalter und 44px-Ziele; Baumdienst bleibt grün/creme |
| Workzone | Kein Werkstatt-Einstieg; geöffnete Flottenleiste beansprucht auf dem Telefon viel Platz | Werkstattübersicht unter den Baustellen, analog zur Position der BauFlow-Fertigung; Desktop-Leiste zunächst geschlossen; Flotte auf schmalen Geräten in der Navigation |
| Defekte | Operative `machine-notes.ts` speichert höchstens fünf Defekte und kennt nur offen/erledigt | Eigenes Demo-Auftragsmodell mit Zustandsregeln und fortgeschriebener Historie. **Die alte operative Speicherung ist unverändert** und muss vor einem echten Werkstattbetrieb ersetzt werden |
| Flotte und Geräte | Technischer Aktiv-Status ist keine Reparaturfreigabe | Lokale Werkstatt-/Prüfsperre, explizite Freigabe, Kennzeichen/Inventarnummer und Verbindung zur lokalen Flottenansicht. Vorhandene Planungsdaten bleiben schreibgeschützt |
| Werkzeuglager | Keine gemeinsam testbare Annahme-/Ausgabeprobe | Einzelgeräte mit Empfänger, Ausgabe, Rücknahme, Prüfdatum und Ereignissen; Geräte in Reparatur oder mit überfälliger Prüfung lassen sich nicht ausgeben |
| Ersatzteile | Kein Werkstattverbrauch | Positive Ganzzahlen, Überziehungsprüfung, Abzug beim Verbrauch und gespeicherter damaliger Stückpreis im Auftrag; Nachfüllen als Demo. Lieferanten-, Einkaufs- und vollständiges Lagerbewegungsbuch sind nicht implementiert |
| Dokumente | Kein auftragsbezogener Werkstattbereich | Musterdateien an Gerät und optional Auftrag; Download und Speicherung nach Reload. Nur PDF/PNG/JPG/TXT, höchstens 256 KB je Datei und 1 MB insgesamt |
| Historie | Ein Defekt lässt sich bisher nicht durch Annahme und Reparatur verfolgen | Zeit, Demo-Akteur, Zustand, Reparaturtext, verwendete Teile, Prüfung, Freigabe und Ausgabe/Rückgabe bleiben erhalten; Export und bewusstes Zurücksetzen betreffen nur den eigenen Demo-Schlüssel |
| Darstellung | Potenziell widersprüchliche Verfügbarkeit; schwebende Flottentaste überdeckt auf dem Telefon Karten | Werkstattstatus wird in der Demo-Leiste berücksichtigt; der Telefon-Einstieg überdeckt keine Inhalte. Responsive Spalten, Suche und Filter; keine Drag-Pflicht |
| Formulare | Frühe Klicks vor Hydration und unklare Select-Beschriftung wurden beim Browser-Test sichtbar | Mutationen erst nach Hydration; explizite Label-/ID-Verknüpfung, Dialog-Fokus und Escape-Rückkehr geprüft |
| Native Präsentation | Neue Demo-Fähigkeit fehlt; dekorative Nummern auf parallelen Vorschaukarten | Nur auf einer Baumdienst-Demo-Instanz ein deutlich begrenzter Werkstatt-Einstieg; Kartennummern entfernt. Fachliche Reihenfolgen bleiben erhalten |

## Daten- und Zugriffsgrenze

`/demo/workshop` setzt die bestehende Freigabe für öffentliche Demos (`APP_ENV=local|demo`, kein SaaS-Modus) und den Firmenmodus `baumdienst` voraus. BauFlow und der echte SaaS-/Pilotbetrieb erhalten dadurch keine Werkstattaktion.

Alle Werkstattdaten sind fiktive Beispiele. Der versionierte, validierte Zustand liegt unter `redionflow:baumdienst:workshop-demo:v1` in `localStorage`. Kein Server-Action-/API-Schreibpfad, keine neue Migration, kein neuer Provider und keine neuen Abhängigkeiten. Aufträge und Dateiinhalte werden nicht an die Datenbank oder einen Storage-Anbieter übertragen. Es gibt weder Benutzerrollen noch Mehrbenutzer-Synchronisation für diese Probe; der Akteur heißt ausdrücklich Demo. Ein Browser-Export ist keine betriebliche Datensicherung. Bei defektem oder vollem Browserspeicher wird kein Speichern vorgetäuscht.

Das Modell begrenzt den Demo-Umfang auf 100 Geräte, 1.000 Aufträge und 40 Dateien. Es entfernt keine alten Reparaturen stillschweigend, um Platz zu schaffen. Historie und Dateien sind lokal und gehen beim Löschen des Browserspeichers verloren.

Die bestehenden schreibgeschützten Baustellen, Arbeitszeiten und Mitarbeiterprofile behalten ihre Datenquelle. Der neue Werkstattstatus ist keine serverseitige Sperre im echten Tagesplan, keine bestätigte GPS-Position und kein Nachweis einer echten HU/UVV-Prüfung.

## Prüfung

- Lokaler PostgreSQL-16-Testbestand mit dem vorhandenen fiktiven Baumdienst-Seed; getrennt von gemeinsamem oder produktivem Datenbestand.
- Produktionsbuild mit Next.js 16.4.3 und TypeScript erfolgreich. Zwei vorhandene Page-Prop-Signaturen wurden an den generierten Next-Vertrag angepasst; der direkte Testaufruf übergibt jetzt ein leeres Props-Objekt. Keine Fachlogik geändert.
- 15 fokussierte Modelltests: Reihenfolge, doppelte Annahme, Prüfung/Freigabe, Ausgabe/Rücknahme, Bestandsgrenzen, Dokumentzuordnung und sieben Reparaturzyklen ohne Fünf-Einträge-Verlust.
- Chromium: vollständiger Reparatur-/Ersatzteil-/Freigabe-/Ausgabe-/Dokument-/Reload-/Export-/Reset-Ablauf; beschädigter Speicher; keine Page-Errors im geprüften Ablauf.
- Alle sechs UI-Sprachen; 1440/768/390/320px, hell/dunkel, alle Werkstattbereiche, kein horizontaler Seitenüberlauf; primäre Aktionen mindestens 44px, Textkontrast der primären Aktion mindestens 4,5:1, Dialog/Escape/Fokusrückkehr und ein Autorenlink geprüft.
- Native Präsentation in SQ/EN/DE/IT auf Desktop und Telefon; Workzone, Dashboard und Baustellendetail bei 1440/390px in beiden Themes geprüft. Vor-/Nachvergleich der nativen Karten und des geteilten Headers.
- Keine Cloud-Actions gestartet. Frühere vollständige GPS-, OCR-, Backup-, Foto- und Stahlproduktionspakete wurden nicht erneut ausgeführt; ihre reale Abnahme bleibt getrennt.

Die Tests stehen unter `src/lib/workshop/demo-model.test.ts` und `tests/workshop/`. Die Browser-Suite verlangt eine bereits gestartete, fiktive Loopback-Demo und weist öffentliche/entfernte Targets ab. Lokale Befehle: `vitest run src/lib/workshop/demo-model.test.ts`, `playwright test -c tests/workshop/playwright.config.ts`, fokussiertes ESLint und `next build --webpack`.

## Nach der Demo-Probe

Vor einem echten Einsatz sind normalisierte, firmengebundene Werkstattaufträge und Ereignisse mit Migration, Rollen/RLS, unveränderlicher Historie und Konkurrenzschutz notwendig. Ein physisches Gerät benötigt eine eindeutige Identität; Gerätesets dürfen nicht mit einzeln ausgegebenen Werkzeugen oder Verbrauchsteilen vermischt werden. Teilebuchungen und Rücknahmen benötigen Transaktionen und ein Lagerbewegungsbuch. Dokumente benötigen privaten Storage, echte Inhaltsprüfung, Rechte und Lösch-/Aufbewahrungsregeln. Planung, Flotte, Mitarbeiterübergaben und Prüffristen müssen denselben serverseitigen Verfügbarkeitszustand verwenden.

GPS-Verlässlichkeit, Erinnerungen, Offline-Konflikte, echte Zertifikate und ein produktiver Werkstatt-Rollenablauf sind nicht durch diesen Prototypen abgenommen. Der sichtbare Kalender und die Baumlisten bleiben Baumdienst-spezifisch; Stahlgewichte und Fertigungsprozesse werden nicht in den Baumdienst kopiert.

## Lieferung und Präsentation

Die öffentliche Baumdienst-Demo und ihr nächtlicher Reset verwenden laut Provider-Readback weiterhin `main`; der reale Pilot verwendet seinen eigenen Zweig. Dieser Kandidat wird ausschließlich in einer getrennten Feature-PR vorbereitet. Ein Merge in den Railway-verbundenen Pilotzweig ist kein harmloser Weg, nur die Baumdienst-Demo zu veröffentlichen.

Native Information und README beschreiben die lokale Probe. Die Portfolio-Begleit-PR führt dieselben Grenzen in SQ/EN/DE/IT und echte synthetische Screenshots; bestehende Live-Links, About und Prod/90 bleiben unverändert. **PENDING_PUBLICATION / OWNER_UAT**: kein Merge, kein Deployment und keine Änderung an Firmen-, Provider-, GPS- oder Echtdaten. Nächster Punkt ist die Prüfung dieses konkreten lokalen Demo-Kandidaten; eine spätere Demo-Veröffentlichung braucht einen eigenen, auf Baumdienst begrenzten Release-Schritt.
