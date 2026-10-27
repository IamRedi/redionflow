# Arbeitsweise mit KI

RediOnFlow wird von einer Person entwickelt, Redion Cekrezi, mit KI-Agenten als Werkzeug. Dieses Dokument beschreibt ehrlich, wie das abläuft, was dabei gut funktioniert und wo die Grenzen liegen.

## Rollen

| Wer | Aufgabe |
|---|---|
| **Mensch (Produktverantwortung)** | Entscheidet, was gebaut wird und für wen; kennt die Betriebe und ihre Abläufe; prüft Ergebnisse in der laufenden Anwendung; gibt frei, was öffentlich wird |
| **KI-Agent (Umsetzung)** | Liest den Code, schlägt einen Plan vor, schreibt Code, Tests und Dokumentation in einem eigenen Branch, öffnet einen Pull Request, behebt CI-Fehler |
| **CI (Schiedsrichter)** | Lint, Typecheck, Unit-, Integrations- und Browser-Tests, Build, Secret-Scan, Docker-Smoke-Test. Rot heißt: kein Merge |

## Ablauf eines Schritts

1. **Auftrag in Alltagssprache**, oft auf Albanisch, zum Beispiel: „BauFlow zeigt noch Äste über 10 cm, mach es für jede Baustelle passend und einfacher für die Arbeiter.“
2. **Erkunden statt raten:** Der Agent startet die Anwendung lokal mit den Demo-Daten, macht Screenshots am Handy und am Desktop und sucht im Code nach den Stellen.
3. **Kleiner Pull Request** mit klarer Beschreibung, was sich ändert und warum.
4. **Prüfen:** Lint, Typecheck und Tests lokal, dann CI. Vorher-Nachher-Screenshots.
5. **Merge nur bei grüner CI**, danach automatisches Deployment der Live-Demos.

Die 16 Pull Requests in [PROJEKTSTAND.md](PROJEKTSTAND.md) sind so entstanden, innerhalb von zwei Tagen.

## Leitplanken

- **Keine echten Daten.** Das Original *baumkalk* mit echten Kunden bleibt unangetastet; dieses Repository enthält nur erfundene Daten.
- **Nichts wird behauptet, was nicht geprüft ist.** Das [Prüfprotokoll](../EVIDENCE.md) trennt Gemessenes von nur Vorhandenem.
- **Unumkehrbares nur mit Freigabe.** Produktivsysteme, Löschungen und Veröffentlichungen entscheidet der Mensch.
- **Tests werden nie abgeschaltet, um grün zu werden.** Ein roter Test ist ein Befund.

## Was gut funktioniert

- Große, mechanische Aufräumarbeiten in kurzer Zeit: alle `any` entfernen, Übersetzungen in Dateien auslagern, Abhängigkeiten aktualisieren.
- Sicherheitsprüfungen mit frischem Blick: So wurde gefunden, dass `/demo` auf Einzelinstallationen echte Daten zeigte ([#7](https://github.com/IamRedi/redionflow/pull/7)).
- Realistische Demo-Daten nach Recherche, etwa wie Glasfaser-Tiefbaufirmen in Deutschland arbeiten.

## Grenzen

- Der Agent kennt die Baustelle nicht aus eigener Erfahrung. Fachliche Entscheidungen, was ein Polier oder Baumpfleger wirklich braucht, kommen vom Menschen und von den Betrieben.
- Was sich nur auf echten Geräten mit schlechtem Netz zeigt, etwa der Offline-Modus, lässt sich in der Cloud-Umgebung nicht prüfen.
- Gut aussehender Code ist nicht automatisch richtiger Code. Deshalb entscheiden Tests und der Blick in die laufende Anwendung, nicht der Eindruck.
