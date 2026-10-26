# RediOnFlow

Eine Codebasis, zwei Produkte für Betriebe, die draußen arbeiten:

- **BaumdienstFlow** – Planung, Kalkulation und Dokumentation für Baumpflege- und Baumdienstbetriebe (Baumkataster, Baustellen, Tagesplanung, Fuhrpark).
- **BauFlow** – dieselbe Plattform für Bau- und Regiebetriebe (Baustellen, Regieberichte, Einsatzplanung).

Das Produkt wird pro Firma über `company.mode` und zentrale Feature-Flags gesteuert, nicht über getrennte Apps.

> **Status:** Dieses Repository wird gerade als saubere, öffentlich präsentierbare Fassung aufgebaut. Ausführliche Doku, Screenshots und eine öffentliche Live-Demo folgen.

## Stack

- Next.js 16 (App Router), React 19, TypeScript (strict)
- PostgreSQL + Prisma 7 (Driver Adapter `@prisma/adapter-pg`), Row-Level Security
- Tailwind CSS, Radix UI, React Hook Form, Zod
- Vitest (Unit + Integration), Playwright (E2E), GitHub Actions
- Supabase Storage, Firebase Cloud Messaging, Stripe (SaaS-Modus), OpenAI (Assistent)
- Mehrsprachig: Deutsch, Englisch, Albanisch, Italienisch, Polnisch, Rumänisch

## Demo in drei Minuten

Voraussetzung: Docker.

```bash
docker compose up --build
```

Danach `http://localhost:3000/demo` öffnen. Der Container führt die Migrationen aus und legt die fiktive Firma **Baumdienst Musterstadt GmbH** an: 8 Mitarbeitende, 3 Baustellen, 152 Bäume mit Koordinaten, 5 Maschinen, ein Tagesplan und laufende Arbeitszeiten. Alle Namen, Adressen und Kennzeichen sind erfunden ([`prisma/seed-data.ts`](prisma/seed-data.ts)).

Die `/demo`-Seiten sind schreibgeschützt und brauchen kein Login. Wer zusätzlich den Admin-Bereich sehen will, setzt vor dem Start ein Passwort:

```bash
DEMO_ADMIN_PASSWORD='ein-langes-passwort' docker compose up --build
# Login unter /admin-login mit admin@baumdienst-musterstadt.example
```

Frische Demo-Daten: `docker compose exec app npm run demo:reset`.

Die BauFlow-Variante mit der fiktiven **Bau Beispielstadt GmbH** (Pflaster, Beschilderung, Entwässerung) startet mit einer frischen Datenbank:

```bash
docker compose down -v
DEMO_SEED_MODE=bau docker compose up --build
```

## Schnellstart (Entwicklung)

Voraussetzungen: Node.js 22 (siehe `.nvmrc`), npm 10, Docker für eine lokale PostgreSQL.

```bash
docker run -d --name redionflow-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=redionflow -p 5432:5432 postgres:16
cp .env.example .env
npm ci
npm run db:migrate
npm run db:seed     # fiktive Demo-Daten
npm run dev
```

Den ersten Admin legst du über den gesicherten First-Boot-Flow oder den lokalen Demo-Bootstrap an (siehe `.env.example`).

## Qualität

```bash
npm run lint        # ESLint, 0 Warnungen erlaubt
npm run typecheck   # TypeScript strict
npm test            # Unit-Tests
npm run build       # Produktionsbuild
```

Integrations- und E2E-Tests laufen in CI gegen eine frische, wegwerfbare PostgreSQL (`npm run test:integration:local`, `npm run test:e2e:local`). Jeder Push wird zusätzlich mit gitleaks auf Secrets geprüft.

### Lighthouse (mobil)

Gemessen am 26.10.2026 mit Lighthouse 12, Mobil-Profil (gedrosselte CPU und Netzwerk), gegen einen lokalen Produktionsbuild (`npm run build && npm start`).

| Seite | Performance | Barrierefreiheit | Best Practices | SEO |
|---|---|---|---|---|
| Startseite `/` | 96 | 100 | 100 | 100 |
| Zugang `/zugang` | 99 | 100 | 100 | 60¹ |
| Admin-Login `/admin-login` | 98 | 100 | 100 | 60¹ |

¹ Login-Seiten sind absichtlich `noindex`, damit sie nicht in Suchmaschinen landen.

## Dokumentation

- [Betriebshandbuch](docs/OPERATIONS.md) – lokale Entwicklung, Auth, Tests, Deployment
- [Architektur & SaaS](docs/SAAS_ARCHITECTURE.md), [Row-Level Security](docs/RLS.md), [CSP](docs/CSP.md)
- [Architekturentscheidungen](docs/DECISIONS.md), [ADRs](docs/adr/)
- [Sicherheit & Bedrohungsmodell](SECURITY.md)

## Lizenz

Source-available, alle Rechte vorbehalten. Der Code darf gelesen und zur Bewertung lokal ausgeführt werden, aber nicht kommerziell genutzt werden. Details in [LICENSE](LICENSE).
