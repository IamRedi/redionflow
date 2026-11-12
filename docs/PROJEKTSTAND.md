# Projektstand

**Stand: 27. Oktober 2026**

## Kurz gesagt

RediOnFlow ist eine lauffähige Betriebssoftware für Baumdienste (BaumdienstFlow) und Bau- und Tiefbaubetriebe (BauFlow). Die Anwendung ist aus dem privaten Produktivsystem *baumkalk* entstanden, das ein Baumdienst im Alltag nutzt. Dieses Repository ist die bereinigte, öffentlich zeigbare Fassung: ohne echte Daten, ohne Git-Verlauf des Originals, mit fiktiven Demo-Firmen, vollständiger CI und zwei Live-Demos.

| | |
|---|---|
| Produktwebsites | [BaumdienstFlow](https://www.baumdienstflow.de/) · [BauFlow](https://www.baumdienstflow.de/bauflow/) |
| Live-Demos | [BaumdienstFlow](https://redionflow-production.up.railway.app/demo) · [BauFlow (Glasfaser-Tiefbau)](https://bauflow-production-1344.up.railway.app/demo) |
| Hosting | Railway, Region EU West (Niederlande), je Demo eine eigene PostgreSQL, nächtlicher Reset um 02:00 UTC |
| Umfang | rund 55.000 Zeilen TypeScript, 59 Datenbankmodelle, 49 Migrationen, rund 70 Seiten und API-Routen, 6 Sprachen |
| Tests | 711 automatisierte Tests in CI (423 Unit, 263 Integration, 25 Ende-zu-Ende) |
| Pull Requests | 16 gemergt am 26. und 27. Oktober 2026, jeder mit grüner CI |

## Wie es dazu kam

Die Ausgangslage war eine produktiv genutzte Anwendung mit echten Kunden-, Mitarbeiter- und Baustellendaten, einem dritten Produkt (PersonalFlow) und interner Agenten-Dokumentation. Das Ziel: zwei Produkte so aufbereiten, dass sie Betrieben vorgeführt werden können, die danach gefragt haben, und dass der Code einer technischen Prüfung standhält. Das Original *baumkalk* bleibt dabei unangetastet.

Die Arbeit lief in fünf Phasen, jede als kleine Pull Requests mit Lint, Typecheck, Tests und Build:

### Phase 0: Sauberer Schnappschuss
Neues Repository aus einem Stand von *baumkalk*, ohne dessen Git-Verlauf. Echte Datenschnappschüsse, Importdateien, interne KI-Notizen und datierte Audits entfernt. Lizenz „source-available“, Secret-Scan (gitleaks) in CI.

### Phase 1: Fokus auf zwei Produkte
| PR | Inhalt |
|---|---|
| [#1](https://github.com/IamRedi/redionflow/pull/1) | PersonalFlow entfernt; die Datenbank erlaubt nur noch die Modi `baumdienst` und `bau` |

### Phase 2: Codequalität
| PR | Inhalt |
|---|---|
| [#2](https://github.com/IamRedi/redionflow/pull/2) | Jedes explizite `any` entfernt, ESLint verbietet es künftig |
| [#3](https://github.com/IamRedi/redionflow/pull/3) | Die größten Dateien in fokussierte Module aufgeteilt (Baumliste, Assistent, Sync, Export) |
| [#4](https://github.com/IamRedi/redionflow/pull/4) | Übersetzungen aus dem Code in JSON-Dateien je Sprache, BauFlow-Wortschatz getrennt |
| [#5](https://github.com/IamRedi/redionflow/pull/5) | Persönliche Admin-Identitäten durch ein Inhaber-Flag ersetzt, fiktive Adresse |

### Phase 3: Sicherheit und Tempo
| PR | Inhalt |
|---|---|
| [#6](https://github.com/IamRedi/redionflow/pull/6) | Abhängigkeiten aktualisiert: `npm audit` von 36 Befunden auf 0 |
| [#7](https://github.com/IamRedi/redionflow/pull/7) | Datenleck geschlossen: `/demo` zeigte auf Einzelinstallationen echte Daten; öffentliche Endpunkte gehärtet |
| [#8](https://github.com/IamRedi/redionflow/pull/8) | Admins melden sich mit Passwort (mind. 12 Zeichen) an, Mitarbeitende behalten ihren 6-stelligen Code |
| [#9](https://github.com/IamRedi/redionflow/pull/9) | [SECURITY.md](../SECURITY.md) mit Bedrohungsmodell, Kontrollen und offenen Restrisiken |
| [#10](https://github.com/IamRedi/redionflow/pull/10) | Lighthouse mobil von 54 auf 96 (Ursache: ein 1,5 MB großes Logo als Favicon) |

### Phase 4: Demo und Live-Betrieb
| PR | Inhalt |
|---|---|
| [#11](https://github.com/IamRedi/redionflow/pull/11) | Fiktive Demo-Firma, Docker-Demo mit einem Befehl, nächtlicher Reset |
| [#12](https://github.com/IamRedi/redionflow/pull/12) | Railway-Konfiguration für die Live-Demo |
| [#13](https://github.com/IamRedi/redionflow/pull/13) | Demo lesbar in hell und dunkel, einheitliche Sprache, Handy-Layout |
| [#14](https://github.com/IamRedi/redionflow/pull/14) | Zweite Demo-Firma für BauFlow (Pflaster, Beschilderung, Entwässerung) |
| [#15](https://github.com/IamRedi/redionflow/pull/15) | Glasfaser-Tiefbau als BauFlow-Demo: Trasse, Hausanschluss, Spülbohrung, Spleißen, Maschinen bis zur Schaufel, Inventar und Wissensbeiträge |
| [#16](https://github.com/IamRedi/redionflow/pull/16) | BauFlow ohne Baum-Details (Äste, Kronenbreite, Baum-Rezepte), einfachere Bildschirme für Mitarbeitende, Handy-Fehler behoben |

### Phase 5: Öffentliche Präsentation (dieser Stand)
README auf Deutsch und Englisch, Screenshots aus den Demos, Architekturbild, [Prüfprotokoll](../EVIDENCE.md), dieses Dokument, [Arbeitsweise mit KI](KI_WORKFLOW.md). Alte Bilder auf der Startseite durch Aufnahmen der fiktiven Demo ersetzt.

## Was die Demos zeigen

**BaumdienstFlow, Baumdienst Musterstadt GmbH:** drei Baustellen (Verkehrssicherung an einer Allee, Pflegeschnitt im Stadtpark, Fällungen auf einem Friedhof), 152 Bäume mit Koordinaten, Baumart und Durchmesser, Hubsteiger, Kran-LKW und Häcksler, ein Tagesplan, laufende Arbeitszeiten, ein Angebot mit Kalkulation.

**BauFlow, Glasfaserbau Beispieltal GmbH:** ein Nachunternehmer im FTTH-Ausbau. Offene Trasse im Gehweg, Hausanschlüsse mit Kernbohrung, Spülbohrung unter einer Bundesstraße, Einblasen und Spleißen im Netzverteiler. 114 Arbeiten, Minibagger, Spülbohranlage, Einblasgerät, Spleißfahrzeug, 20 Werkzeuge vom Stampfer bis zur Spitzhacke, Arbeitskleidung, Absicherung nach verkehrsrechtlicher Anordnung.

## Offene Punkte

| Punkt | Warum offen |
|---|---|
| Row-Level Security auf alle Bereiche ausweiten | Policies sind angelegt, durchgesetzt mit eingeschränkter Rolle nur im Pilot für Baustellen und Tagesplan |
| Content Security Policy blockierend schalten | Läuft im Report-Only-Modus, bis die Berichte ausgewertet sind |
| Offline-Modus im Feld erproben | Die Warteschlange im Browser ist angelegt, ein Test mit schlechtem Netz auf der Baustelle fehlt |
| Echten Virenscanner anbinden | Die Schnittstelle existiert, standardmäßig prüft sie nur die EICAR-Testdatei |
| KI-Assistent in der Demo | Braucht einen API-Schlüssel und eine Kostengrenze; bewusst nicht aktiv |
| Ältere Dokumente unter `docs/` | Teile von [ROADMAP](ROADMAP.md) und [DECISIONS](DECISIONS.md) beschreiben die frühere Arbeitsweise in *baumkalk* und sind als historisch markiert |

## Nächste Schritte

1. Demos mit den interessierten Betrieben durchgehen und Rückmeldungen sammeln.
2. Einen Pilotbetrieb je Produkt auf einer eigenen Instanz einrichten.
3. Offene Sicherheitspunkte schließen (CSP, Scanner), danach Offline-Modus im Feld testen.


## BauFlow presentation renewal · 12 November 2026 · READY / PENDING_PUBLICATION

Reviewed application: AL-Steel production `d2846d1797f2a91cd5a49af6b483067ca43ce615` (PR188). The owner explicitly requested the website/portfolio renewal, superseding the previous routine-media deferral for this delivery. No operational app, account, provider, schema, customer record or production configuration was changed.

The native BauFlow site adopts the accepted warm stone/copper/clear-crystal material, four actual SQ/EN/DE/IT editions, compact controls, automatic/light/dark appearance, personal offices/reception, internal mail/tasks, role-scoped assistants, factory/site workflow, document receipts, assets and repair phases. Screenshots are genuine captures from the matching local application tree with an isolated Mira Steel DEMO tenant; no customer data or fabricated AI replies. Twelve responsive WebP captures total 892,910 bytes; original local PNGs and prior public media are retained. The existing approved AL-Steel reference logo/photo remain byte-identical. The older fibre-construction public demo does not represent the new private office version. AI/GPS/notifications remain configuration-dependent. Readiness stays Prod90.

Existing PRs are consolidated, not duplicated: redionflow155 (native website), redionflow154 (showcase README/media), portfolio79 (first-page card, case study, directory and the previously prepared AL-Steel reference from portfolio80). BaumdienstFlow's generated pages/assets and other portfolio products are preserved. Native publication is a separate combined static package; do not push the Railway-connected app branch or deploy only the BauFlow subtree.

Local evidence: `outputs/bauflow-web-renewal-20261112`. Generator/syntax, static link/asset/locale/metadata checks; 32 native locale/viewport/theme cases plus theme persistence/Auto/reflow; portfolio lint/typecheck/content/native/public-site tests, production build/SSR checks and 48 portfolio UI/link observations. Genuine application capture had zero browser errors, and its dedicated synthetic tenant was removed. Owned app preview/PostgreSQL were stopped. No paid API, AI generation or GitHub Actions were used.

Gates: CONTENT/LOCALE/UI/SEO_ASSETS/SYNC local PASS for the stated scope; application sign-in links are the existing company entrances. The command-line native read returned HTTP403, but an anonymous desktop browser resolved both the native root and SQ edition with HTTP200 and the expected existing titles; the portfolio SQ homepage also resolved correctly. Candidate publication/readback is still pending; source/local previews do not establish published PASS. Exact candidate publication, owner editorial acceptance, physical iPhone/Safari and measured Lighthouse scores are not claimed. Publication requires owner approval on the reviewed source/media/targets. Existing public reference rights and product licenses are preserved.
