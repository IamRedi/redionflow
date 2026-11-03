# Prüfprotokoll / Verification record

**Stand: 3. November 2026.** Dieses Protokoll trennt, was gemessen wurde, von dem, was nur im Code vorhanden ist. Zahlen ohne Quelle gibt es hier nicht.

## 3 November 2026 — WanWay feature candidate (local, not deployed)

Scope: `feat/wanway-gps-integration`, based on active pilot revision
`000ebf1cc4310de770b0efb4ccf2e7df69b50a19` (PR #27), reconciled locally
in commit `9868ecd080cbd76b4be2342bad149241468e32cd`. The pilot advanced during
verification; its new site-element features were preserved and the combined
source was rechecked. Production is still on
its existing pilot deployment; no merge, production migration, environment
change or real-provider authentication was performed for this feature.

| Local gate | Verified result |
| --- | --- |
| ESLint / TypeScript | PASS, zero lint warnings |
| Unit tests | **505 PASS**, 67 files |
| PostgreSQL integration | **277 PASS**, 17 files, including 12 WanWay security/service tests |
| Production build | PASS, including the WanWay-enabled managed E2E build |
| Chromium E2E | **26 PASS**, including discovery, confirmed mapping to an existing vehicle, offline telemetry, transient history/map initialization and disconnect with **37 synthetic vehicles preserved** |
| Additive migrations | 59 migrations applied to a fresh isolated PostgreSQL 16; schema comparison: **No difference detected** |
| Secret scan | Gitleaks 8.30.1 on the complete staged feature diff: **no leaks found** |
| Responsive visual review | Integration panel at 1440 px and 390 px; key cleared after submit, no full IMEI/secret in rendered HTML, phone panel has no horizontal overflow |

Execution: the owner's Windows laptop, locally through WSL Ubuntu, Node 22.19,
PostgreSQL 16.15. Docker Desktop was unavailable, so fresh native loopback
clusters were used, with the same migrations and restricted runtime role rather
than a shared DB. No cloud Actions were dispatched. Existing required gates
were retained; automatic ordinary CI triggers are opt-in on this branch.

Initial Windows-wide unit execution exposed three inherited platform-specific
failures; full checks passed in Linux. A timing-sensitive new token-cache test
was corrected to use a controlled clock. The new composite device/vehicle FK
was corrected and regression-tested to preserve existing deletion behaviour.
No unrelated production code was changed to hide test failures.

The map layer and route geometry initialized; external tile rendering was not an
acceptance assertion. Real GS900-Wired data, account licence/IP restrictions,
real-route accuracy, production keyring setup, privacy sign-off and owner
acceptance remain **NOT VERIFIED / PENDING APPROVAL**. Workzone and tenant
regression suites passed; no real KiDraht/provider calls were made.

Architecture, endpoint contracts, security, rollout boundaries and reproducible
local commands: [WANWAY_GPS.md](docs/WANWAY_GPS.md). The earlier CI baseline below
is historical evidence, not a cloud run on this feature.

## Automatisierte Prüfungen (CI — historische Baseline)

Quelle: GitHub Actions auf dem letzten gemergten Pull Request ([#16](https://github.com/IamRedi/redionflow/pull/16), Commit `37ddb90`). Dieselben Schritte laufen auf jedem Pull Request; gemergt wird nur mit grüner CI.

| Schritt | Ergebnis |
|---|---|
| ESLint (`--max-warnings 0`) | bestanden |
| TypeScript strict (`tsc --noEmit`) | bestanden |
| Unit-Tests (Vitest) | **423 bestanden** in 50 Dateien |
| Integrationstests gegen eine frische PostgreSQL 16 im Container, mit eingeschränkter Datenbankrolle | **263 bestanden** in 15 Dateien |
| Produktionsbuild (`next build`) | bestanden |
| Ende-zu-Ende-Tests (Playwright, Chromium) gegen den Build und eine frische Datenbank, im SaaS-Modus mit eingeschaltetem RLS-Pilot (`RLS_ENFORCE=true`: Baustellen und Tagesplan laufen über eine eingeschränkte Datenbankrolle) | **25 bestanden** |
| Secret-Scan (gitleaks) | keine Funde |
| Docker-Demo: `docker compose up`, danach Smoke-Test: Health-Endpunkt, `/demo/workzone` lädt und zeigt die Demo-Baustelle | bestanden |

Die Ende-zu-Ende-Tests prüfen unter anderem: Anmeldung beider Produkte, Anlegen und Bearbeiten von Bäumen bzw. Baustellenaufgaben in der Workzone, dass BauFlow keine Baum-Module zeigt, dass ein Mandant keine Admin-, Workzone-, Projekt-, Mitarbeiter- oder Exportdaten eines anderen Mandanten sieht, dass private Dokumente nur für den eigenen Mandanten abrufbar sind, und dass Server Actions mit fremdem `Origin` abgewiesen werden.

## Manuelle Prüfungen

| Prüfung | Beobachtung |
|---|---|
| Lighthouse 12, Mobil-Profil, lokaler Produktionsbuild (26.10.2026) | Startseite 96 / 100 / 100 / 100 (Performance, Barrierefreiheit, Best Practices, SEO); Login-Seiten 98–99 Performance, SEO 60 wegen bewusstem `noindex` |
| `npm audit` (26.10.2026) | 0 Befunde |
| Browser-Durchgang BauFlow (27.10.2026) | Alle Admin- und Workzone-Seiten mit den Glasfaser-Daten bei 1280 px und 430 px aufgerufen; Baum-Begriffe, überlaufende Karten und überlappende Kacheln gefunden und in [#16](https://github.com/IamRedi/redionflow/pull/16) behoben |
| Nächtlicher Reset der Live-Demos (27.10.2026, 02:00 UTC) | Beide Reset-Dienste protokollierten „Seed completed“: Baumdienst Musterstadt GmbH (8 Mitarbeitende, 3 Baustellen, 152 Bäume, 5 Maschinen) und Glasfaserbau Beispieltal GmbH (10 Mitarbeitende, 4 Baustellen, 114 Arbeiten, 8 Maschinen) |
| Screenshots in der README | Aufgenommen mit Playwright/Chromium gegen einen lokalen Produktionsbuild mit denselben fiktiven Daten wie die Live-Demos, 1440 × 900 und 390 × 844 Pixel; jedes Bild einzeln angesehen |

## Was nicht geprüft ist

- **Externe Dienste in der Live-Demo.** KI-Assistent (OpenAI), Push (Firebase), Dateispeicher (Supabase), Stripe und Fahrzeug-GPS sind in der Demo nicht konfiguriert. Ihr Code ist durch Unit- und Integrationstests mit Test-Doubles abgedeckt; ein Live-Aufruf wurde für diese Fassung nicht gemacht.
- **Offline-Betrieb im Feld.** Die Warteschlange im Browser existiert, ein Test mit schlechtem Mobilfunk auf einer echten Baustelle fehlt.
- **Row-Level Security außerhalb des Pilots.** Die Policies sind für alle Mandantentabellen angelegt, durchgesetzt mit eingeschränkter Rolle werden sie nur im Pilot und nur in Wegwerf-Datenbanken. In den Live-Demos und regulären Installationen ist der Mandantenfilter der Anwendung die wirksame Grenze.
- **Last und Skalierung.** Es gab keinen Lasttest. Realtime-Ereignisse laufen im Prozess und werden zwischen mehreren Instanzen nicht geteilt (siehe [SECURITY.md](SECURITY.md)).
- **Fachliche Richtigkeit der Demo-Inhalte.** Baustellen, Mengen und Abläufe sind realistisch erfunden, aber keine Arbeitsanweisung.

## Daten und Rechte

- Das Repository enthält keine echten Kunden-, Mitarbeiter- oder Baustellendaten. Alle Demo-Firmen, Namen, Adressen, Telefonnummern und Kennzeichen sind erfunden ([`prisma/seed-data.ts`](prisma/seed-data.ts), [`prisma/seed-data-bau.ts`](prisma/seed-data-bau.ts), [`prisma/seed-data-glasfaser.ts`](prisma/seed-data-glasfaser.ts)). Koordinaten liegen in echten Städten, damit die Karten realistisch aussehen.
- Bilder, Diagramme und Texte: Redion Cekrezi / RediON. Es wird keine Nutzungslizenz über die [LICENSE](LICENSE) hinaus gewährt.
