<p align="center"><img src="docs/assets/hero.png" alt="RediOnFlow: eine Codebasis, zwei Produkte. BaumdienstFlow fÃ¼r Baumpflege, BauFlow fÃ¼r Bau und Tiefbau." width="100%"></p>

# RediOnFlow

**Betriebssoftware fÃ¼r Teams, die drauÃŸen arbeiten.** Der Chef plant im BÃ¼ro, die Mitarbeitenden arbeiten auf der Baustelle am Handy, und beide sehen denselben Stand: Baustellen, Arbeiten, Stunden, Fuhrpark, Material und Kalkulation. Aus einer Codebasis entstehen zwei Produkte:

- **BaumdienstFlow** fÃ¼r Baumpflege- und Baumdienstbetriebe: Baumlisten mit Koordinaten, FÃ¤llungen, Kronenpflege, Hubsteiger und HÃ¤cksler.
- **BauFlow** fÃ¼r Bau-, Tiefbau- und Glasfaserbetriebe: Arbeitslisten statt BÃ¤ume, Trassen, HausanschlÃ¼sse, SpÃ¼lbohrung, Werkzeug und Absicherung.

[![CI](https://github.com/IamRedi/redionflow/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/IamRedi/redionflow/actions/workflows/ci.yml)

**[English version](README.en.md)** Â· **Stand: 4. November 2026** Â· **[Projektstand und Verlauf](docs/PROJEKTSTAND.md)** Â· **[PrÃ¼fprotokoll](EVIDENCE.md)**

## Lokaler BauFlow-Musterbetrieb Â· 14.11.2026

Der eigenstÃ¤ndige Profilkandidat **BauFlow Musterbau Â· DEMO** verwendet die
bestehenden Stahlbau-AblÃ¤ufe mit zwÃ¶lf erfundenen Mitarbeitenden, fÃ¼nf BÃ¼ros,
drei Baustellen, einer Werkhalle und neun verbundenen GerÃ¤ten. Das originale
BauFlow-Logo und passende Day/Night-Campusbilder geben ihm eine eigene IdentitÃ¤t.
Es werden keine Kundendaten Ã¼bernommen. Der Profilkandidat ist nicht die
Ã¶ffentliche Glasfaser-Demo und wurde nicht in den AL-Steel-Piloten eingespielt.
[Vorbereitung, Datenlogik und aktueller PrÃ¼fstand](docs/BAUFLOW_MUSTER_TEMPLATE.md).

Echte Aufnahmen des lokalen Musterkandidaten; noch nicht verÃ¶ffentlicht.

![BauFlow Musterbau Â· Workzone Day](docs/assets/screenshots/bauflow-muster-workzone-light-desktop.webp)

![BauFlow Musterbau Â· Workzone Night](docs/assets/screenshots/bauflow-muster-workzone-dark-desktop.webp)

<img src="docs/assets/screenshots/bauflow-muster-office-light-phone.webp" alt="BauFlow Musterbau Â· local office on a narrow touch screen" width="260">

## In PrÃ¼fung: Produktionspanel fÃ¼r Stahlbetriebe

Ein Kalender zeigt bestÃ¤tigte kg pro Tag und Projekt: Teileschnitt,
Baugruppenschnitt und Zusammenbau bleiben getrennt. Dazu kommen Tagesnachweise,
Prozessfortschritt, gespeicherte BestÃ¤tigungsgewichte und eine private
Monitoransicht ohne Bearbeitung oder personenbezogene Arbeitsnachweise.

Dieser Erweiterungskandidat ist lokal geprÃ¼ft und zur Pilotfreigabe vorbereitet.
[Definitionen, Grenzen und Nachweise](docs/STEEL_PRODUCTION_DASHBOARD.md).
Die Aufnahme zeigt ausschlieÃŸlich eine fiktive Firma mit synthetischer Arbeit.

![Lokaler Produktionspanel-Kandidat mit Kalender und Projektfortschritt](docs/assets/screenshots/steel-dashboard-candidate.png)

## Pilot-Erweiterung: Flottenkarte, Tankbelege und eigene Fotos

Die Pilot-Erweiterung zeigt bestÃ¤tigte Fahrzeuge neben Baustellen, Ã¶ffnet
ihre GPS-Position in Maps und erfasst Original-Tankbelege mit hochladender Person,
tatsÃ¤chlich tankender Person, Belegzeit und nÃ¤chster historischer GPS-Meldung
einschlieÃŸlich Zeitabstand. Lokale OCR schlÃ¤gt die Uhrzeit vor; der Mensch prÃ¼ft
und bestÃ¤tigt sie. Unklare Fahrzeugzuordnungen bleiben beim Chef.

Fahrzeuge, Baustellen und Werkstatt erhalten eigene Fotos Ã¼ber ein kleines
Kamerasymbol: aufnehmen oder auswÃ¤hlen; automatisch WebP, maximal 1024 Pixel
und 180 KB. Fotos bleiben innerhalb der Firma.

Die Basis bestand 559 Unit-, 301 PostgreSQL- und 28 Chromium-PrÃ¼fungen. FÃ¼r die
Foto-Erweiterung wurden nur neue gezielte PrÃ¼fungen ausgefÃ¼hrt; die vollstÃ¤ndigen
Ã¤lteren Tests wurden auf Wunsch des EigentÃ¼mers nicht wiederholt. Die Abnahme
mit echten GPS-GerÃ¤ten und Belegen bleibt separat ausstehend.
[Ablauf, Grenzen und Freigabe](docs/FLEET_MAP_FUEL.md). Die folgenden Aufnahmen
zeigen ausschlieÃŸlich synthetische Daten aus dem lokalen Review-Kandidaten.

![Lokaler BauFlow-Kandidat: Fahrzeuge und Baustelle auf derselben Karte](docs/assets/screenshots/fleet-map-candidate.png)

<img src="docs/assets/screenshots/fuel-receipt-candidate.png" alt="Synthetischer Tankbeleg im lokalen Kandidaten mit getrennten Upload-, Tank- und GPS-Zeiten" width="300">

<img src="docs/assets/screenshots/asset-photos-phone.png" alt="Synthetic BauFlow photo upload workflow" width="260">

## Websites und Live-Demos

| Produkt | Website | Demo | Fiktive Firma |
|---|---|---|---|
| BaumdienstFlow | **[baumdienstflow.de](https://www.baumdienstflow.de/)** | **[redionflow-production.up.railway.app/demo](https://redionflow-production.up.railway.app/demo)** | Baumdienst Musterstadt GmbH: 8 Mitarbeitende, 3 Baustellen, 152 BÃ¤ume, 5 Maschinen |
| BauFlow | **[BauFlow-Website](https://www.baumdienstflow.de/bauflow/)** | **[bauflow-production-1344.up.railway.app/demo](https://bauflow-production-1344.up.railway.app/demo)** | BauFlow Musterbau: 12 Mitarbeitende, 5 Büros, 3 Stahlbau-Baustellen, eine Werkhalle, 30 Baustellenphasen, 9 verbundene Geräte |

Die `/demo`-Seiten sind schreibgeschÃ¼tzt und brauchen kein Login. Alle Namen, Adressen, Kennzeichen und Firmen sind erfunden. Beide Demos werden jede Nacht um 02:00 UTC auf den Ausgangsstand zurÃ¼ckgesetzt. Einen Admin-Zugang zum Ausprobieren gibt es auf Anfrage.

Seit 1. November 2026 ist die BaumdienstFlow-Demo mit dem **KiDraht-Assistenten** derselben fiktiven Firma verknÃ¼pft: Ein Knopf â€žFirmenwissenâ€œ in der oberen Leiste und eine Unterweisungskarte auf jeder Baustelle Ã¶ffnen die vom Chef freigegebenen Regeln und die Sicherheitsunterweisung fÃ¼r diese Baustelle. Mitarbeitende melden sich dort mit einer PIN an.

## Was heute umgesetzt ist

| Status | Bedeutung und Umfang |
|---|---|
| **Umgesetzt und live** | Workzone fÃ¼r die Baustelle (Arbeitsliste oder Baumliste, Karte, Arbeitszeit mit Start, Pause und Stopp, Zusatzarbeiten, Hinweise, Absicherung), Admin-Dashboard, Personal und Fuhrpark, Tagesplan mit Versionen, Barcode-Inventar mit Ausgabe an Mitarbeitende, Kalkulation (Projekte, Positionen, Vorlagen, Lohnrollen, Rezepte), Tages- und Monatsberichte, Baustellen-Export (ZIP mit HTML, CSV, KML), Urlaub, Admin-Login mit Passwort, 6 Sprachen |
| **Verifiziert** | FrÃ¼here CI-Baseline: 711 Tests, Secret-Scan und Docker-Demo-Smoke. Aktuelle lokale PrÃ¼fungen und ihre exakte Abgrenzung stehen im [PrÃ¼fprotokoll](EVIDENCE.md). Cloud-Verifikation ist auf diesem Branch ausdrÃ¼cklich wÃ¤hlbar. |
| **Umgesetzt und live (Stahlbau-Pilot)** | Stahlbau-Projekte aus Tekla-Listen: neues Projekt aus Dokumenten mit Adresse auf der Karte, Werksliste und Baustellenliste je Element, StÃ¼ckzahl je Arbeitsschritt mit Arbeitern, Abschluss mit Route, Werk nur zur Ansicht. [Regeln und Ablauf](docs/STEEL_ELEMENTS.md). |
| **Neu vorbereitet, Freigabe offen** | WanWay/IOPGPS nur lesend: verschlÃ¼sselte Zugangsdaten je Firma, Verbindungstest, bestÃ¤tigte Zuordnung zu vorhandenen Fahrzeugen, manuelle Synchronisierung und letzte Positionsdaten. Nicht in Production oder Ã¶ffentlicher Demo aktiviert; echter GPS-Test steht aus. [Technik und Grenzen](docs/WANWAY_GPS.md). |
| **Umgesetzt, in der Demo nicht aktiv** | KI-Assistent (braucht einen OpenAI-SchlÃ¼ssel), Push-Benachrichtigungen (Firebase), Dateispeicher fÃ¼r Dokumente und Fotos (Supabase), Abos und Rechnungen im SaaS-Modus (Stripe), Fahrzeug-GPS. Der Code ist vorhanden und getestet; die Ã¶ffentliche Demo lÃ¤uft bewusst ohne diese Dienste. |
| **In Arbeit** | Offline-Modus fÃ¼r Feldaktionen (Warteschlange im Browser ist angelegt, noch nicht im Feld erprobt), Content Security Policy von â€žReport-Onlyâ€œ auf â€žblockierendâ€œ, echter Virenscanner fÃ¼r Uploads |
| **Vision** | Pilotbetriebe in beiden Branchen, weitere Gewerke als eigener Modus, Auswertung Ã¼ber mehrere Saisons |

## Warum dieses Projekt?

Kleine und mittlere Betriebe planen ihre Baustellen oft mit Zetteln, WhatsApp-Gruppen und Excel. Was drauÃŸen passiert (wer arbeitet wo, was ist erledigt, wo fehlt Absicherung, welches Werkzeug ist bei wem), kommt spÃ¤t oder gar nicht im BÃ¼ro an, und Stunden werden am Monatsende aus dem GedÃ¤chtnis rekonstruiert. RediOnFlow bringt beides auf einen Bildschirm: Die Mitarbeitenden tippen auf der Baustelle zwei, drei Mal, und das BÃ¼ro sieht es sofort.

> **Upgrade humans. Not replace them.** Die Software nimmt Schreibarbeit ab. Entscheiden, planen und verantworten bleibt beim Menschen.

## Einblick in die Anwendung

Alle Bilder stammen aus der laufenden Anwendung mit den fiktiven Demo-Daten. Es sind keine Mockups.

### BaumdienstFlow

| Workzone: alle Baustellen auf einen Blick | Baustelle mit Baumliste |
|---|---|
| ![Workzone von BaumdienstFlow mit drei Baustellen als Karten](docs/assets/screenshots/baumdienst-workzone.webp) | ![Baustelle Friedhof Nord mit Baumliste, Absicherung und Aufgaben](docs/assets/screenshots/baumdienst-baustelle.webp) |

| Tagesplan fÃ¼r morgen | Kalkulation eines Angebots |
|---|---|
| ![Tagesplan mit Mitarbeitenden, Baustellen und Maschinen](docs/assets/screenshots/baumdienst-tagesplan.webp) | ![Projekt mit Kundendaten und Rezepten fÃ¼r typische Arbeiten](docs/assets/screenshots/baumdienst-kalkulation.webp) |

### BauFlow (Glasfaser-Tiefbau)

| Dashboard fÃ¼r den Chef | Barcode-Inventar mit Werkzeug und Kleidung |
|---|---|
| ![BauFlow-Dashboard mit Stunden, Baustellenfortschritt und Sicherheitsbestand](docs/assets/screenshots/bauflow-dashboard.webp) | ![Inventar mit Werkzeug, Kleidung und BaustellenausrÃ¼stung](docs/assets/screenshots/bauflow-inventar.webp) |

![BauFlow-Workzone mit vier Glasfaser-Baustellen und Absicherungsmaterial](docs/assets/screenshots/bauflow-workzone.webp)

### Auf der Baustelle (Handy, 390 px)

| BaumdienstFlow: Baustelle | BauFlow: Baustelle | BauFlow: Ãœbersicht |
|---|---|---|
| ![Baustelle Stadtpark am Handy mit Start- und Stopp-Knopf](docs/assets/screenshots/baumdienst-mobil-baustelle.webp) | ![Glasfaser-Baustelle am Handy mit Arbeitsliste](docs/assets/screenshots/bauflow-mobil-baustelle.webp) | ![Ãœbersicht der Glasfaser-Baustellen am Handy](docs/assets/screenshots/bauflow-mobil-workzone.webp) |

## Architektur

![Architektur: drei OberflÃ¤chen, eine Next.js-Anwendung mit Modus pro Firma, PostgreSQL mit Mandantentrennung, optionale Dienste](docs/assets/architecture.svg)

- **Eine Anwendung, zwei Produkte.** `CompanyProfile.mode` entscheidet pro Firma zwischen BaumdienstFlow und BauFlow. Zentrale Feature-Flags blenden baumspezifische Teile aus, und BauFlow hat einen eigenen Wortschatz in allen 6 Sprachen. Es gibt keine zwei Codebasen, die auseinanderlaufen.
- **Mandantentrennung.** Jede Abfrage wird nach der Firma aus der Sitzung gefiltert; das ist heute die wirksame Grenze, auch in den Live-Demos. Als zweite Linie sind PostgreSQL-Row-Level-Security-Policies fÃ¼r alle Mandantentabellen angelegt. Mit einer eingeschrÃ¤nkten Datenbankrolle durchgesetzt wird Row-Level Security bisher in einem Pilot (Baustellen und Tagesplan), der in CI gegen eine Wegwerf-Datenbank lÃ¤uft; der Ausbau auf alle Bereiche ist offen. Die Browser-Tests prÃ¼fen, dass ein Mandant die Daten eines anderen nicht sieht.
- **Zwei Betriebsarten.** Als SaaS mit vielen Firmen in einer Datenbank, oder als eigene Instanz fÃ¼r einen einzelnen Kunden.
- **Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript strict, Prisma 7, PostgreSQL 16, Tailwind CSS, Radix UI, Zod, Vitest, Playwright, GitHub Actions, Docker, Railway.

Mehr dazu in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

## QualitÃ¤t und Sicherheit

- **Verifikation:** lokale Gates fÃ¼r Lint, TypeScript, Unit-/PostgreSQL-Integrationstests, Build und Browser-Tests. Cloud-Verifikation nur nach ausdrÃ¼cklicher Auswahl (`workflow_dispatch`); erforderliche Checks und Merge-Schutz bleiben bestehen. [Regel](docs/LOCAL_CI_POLICY.md).
- **Sicherheit:** PasswÃ¶rter und Codes mit scrypt, Rate-Limit beim Login, widerrufbare Sitzungen, Same-Origin-PrÃ¼fung fÃ¼r jede Ã„nderung, private Dateien nur Ã¼ber eine geprÃ¼fte Route, Sicherheits-Header. Bedrohungsmodell und bekannte Restrisiken stehen offen in [SECURITY.md](SECURITY.md).
- **Barrierefreiheit und Tempo:** Lighthouse mobil auf der Startseite 96 Performance, 100 Barrierefreiheit, 100 Best Practices, 100 SEO.
- **Keine echten Daten.** Das Repository wurde als Schnappschuss ohne Git-Verlauf aus dem privaten Produktivsystem erstellt. Echte Firmen- und Personendaten wurden entfernt, die Demo-Daten sind selbst erfunden.

## Selbst starten

**Demo in drei Minuten** (Voraussetzung: Docker):

```bash
docker compose up --build                      # BaumdienstFlow-Demo
docker compose down -v && DEMO_SEED_MODE=glasfaser docker compose up --build   # BauFlow-Demo
```

Danach `http://localhost:3000/demo` Ã¶ffnen. FÃ¼r den Admin-Bereich vor dem Start `DEMO_ADMIN_PASSWORD='ein-langes-passwort'` setzen und unter `/admin-login` mit `admin@baumdienst-musterstadt.example` (bzw. `admin@glasfaserbau-beispieltal.example`) anmelden. `DEMO_SEED_MODE=bau` startet eine allgemeine Baufirma (Pflaster, Beschilderung, EntwÃ¤sserung). Frische Daten: `docker compose exec app npm run demo:reset`.

**Entwicklung** (Node.js 22, npm 10, PostgreSQL 16):

```bash
cp .env.example .env
npm ci
npm run db:migrate && npm run db:seed
npm run dev
```

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:integration:local   # braucht Docker
npm run test:e2e:local           # braucht Docker
```

Betrieb, Auth-Details und Deployment: [docs/OPERATIONS.md](docs/OPERATIONS.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Wie dieses Projekt entsteht

RediOnFlow wird von Redion Cekrezi entwickelt, mit KI-Agenten als Werkzeug: Der Mensch entscheidet, was gebaut wird, prÃ¼ft jedes Ergebnis und gibt es frei; die Agenten schreiben Code, Tests und Dokumentation in kleinen Pull Requests, die nur mit grÃ¼ner CI gemergt werden. Wie das konkret ablÃ¤uft und wo die Grenzen liegen: [docs/KI_WORKFLOW.md](docs/KI_WORKFLOW.md).

## Dokumentation

| Thema | Dokument |
|---|---|
| Wo das Projekt steht, was bisher passiert ist | [docs/PROJEKTSTAND.md](docs/PROJEKTSTAND.md) |
| Was geprÃ¼ft wurde und wie | [EVIDENCE.md](EVIDENCE.md) |
| Architektur im Ãœberblick | [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md), [SaaS-Architektur](docs/SAAS_ARCHITECTURE.md), [Row-Level Security](docs/RLS.md) |
| Sicherheit | [SECURITY.md](SECURITY.md), [CSP](docs/CSP.md), [Sitzungen widerrufen](docs/SESSION_REVOCATION.md) |
| Entscheidungen | [docs/DECISIONS.md](docs/DECISIONS.md), [ADRs](docs/adr/) |
| Betrieb und Deployment | [docs/OPERATIONS.md](docs/OPERATIONS.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Arbeitsweise mit KI | [docs/KI_WORKFLOW.md](docs/KI_WORKFLOW.md) |

## Ãœber den Autor

Redion Cekrezi arbeitet seit 2021 als Baumpfleger und Teamleiter in einem Baumdienst in Nordrhein-Westfalen und hat davor Ã¼ber 15 Jahre in Elektronik und technischer Diagnose gearbeitet. RediOnFlow ist aus dieser Praxis entstanden: Die AblÃ¤ufe, die die Software abbildet, kennt er vom Hubsteiger und aus der Tagesplanung, nicht aus einem Lastenheft. Seit 2025 entwickelt er eigene Softwareprodukte als Full-Stack- und Applied-AI-Entwickler.

## Zusammenarbeit

Interessant fÃ¼r Baumdienste, Bau-, Tiefbau- und Glasfaserbetriebe, die ihre Baustellen digital fÃ¼hren wollen, und fÃ¼r Partner, die einen Pilotbetrieb begleiten mÃ¶chten. Eine VorfÃ¼hrung oder einen Admin-Zugang zur Demo gibt es auf Anfrage Ã¼ber das **[Portfolio](https://www.redioncekrezi.de)** oder [GitHub](https://github.com/IamRedi).

**Redion Cekrezi Â· Full-Stack & Applied AI Developer Â· Produced by RediON**

## Lizenz

Source-available, alle Rechte vorbehalten. Der Code darf gelesen und zur Bewertung lokal ausgefÃ¼hrt werden, aber nicht kommerziell genutzt werden. Details in [LICENSE](LICENSE).

## BÃ¼rooberflÃ¤che Â· 12. November 2026

[PR175](https://github.com/IamRedi/redionflow/pull/175) ist im echten Firmenbetrieb verÃ¶ffentlicht: Beschriftungen und kleine Linienicons sitzen direkt auf Schubladen und Briefumschlag. Arbeitsfenster nutzen kompaktes Kristallglas in den vorhandenen Farben. Die beiden konfigurierten BÃ¼ro-Administratoren Ã¶ffnen ihren bestehenden Firmenassistenten am Monitor statt am Firmenlogo; private GesprÃ¤chsarchive und Zugriffsregeln bleiben erhalten. Originalfotos und Berechtigungen wurden beim Deployment unverÃ¤ndert bestÃ¤tigt. Die folgenden Aufnahmen zeigen ausschlieÃŸlich fiktive Daten.

![Office Studio DEMO Â· office crystal UI](docs/assets/screenshots/office-room-crystal-demo.png)

![Office Studio DEMO Â· private task workspace](docs/assets/screenshots/office-tasks-crystal-demo.png)
