# RediOnFlow

Eine Codebasis, zwei Produkte für Betriebe, die draußen arbeiten:

- **BaumdienstFlow** – Planung, Kalkulation und Dokumentation für Baumpflege- und Baumdienstbetriebe (Baumkataster, Baustellen, Tagesplanung, Fuhrpark).
- **BauFlow** – dieselbe Plattform für Bau- und Regiebetriebe (Baustellen, Regieberichte, Einsatzplanung).

Das Produkt wird pro Firma über `company.mode` und zentrale Feature-Flags gesteuert, nicht über getrennte Apps.

> **Status:** Dieses Repository wird gerade als saubere, öffentlich präsentierbare Fassung aufgebaut. Ausführliche Doku, Screenshots und eine Live-Demo folgen.

## Stack

- Next.js 16 (App Router), React 19, TypeScript (strict)
- PostgreSQL + Prisma 7 (Driver Adapter `@prisma/adapter-pg`), Row-Level Security
- Tailwind CSS, Radix UI, React Hook Form, Zod
- Vitest (Unit + Integration), Playwright (E2E), GitHub Actions
- Supabase Storage, Firebase Cloud Messaging, Stripe (SaaS-Modus), OpenAI (Assistent)
- Mehrsprachig: Deutsch, Englisch, Albanisch, Italienisch

## Schnellstart

Voraussetzungen: Node.js 22 (siehe `.nvmrc`), npm 10, Docker für eine lokale PostgreSQL.

```bash
docker run -d --name redionflow-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=redionflow -p 5432:5432 postgres:16
cp .env.example .env
npm ci
npm run db:migrate
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

## Dokumentation

- [Betriebshandbuch](docs/OPERATIONS.md) – lokale Entwicklung, Auth, Tests, Deployment
- [Architektur & SaaS](docs/SAAS_ARCHITECTURE.md), [Row-Level Security](docs/RLS.md), [CSP](docs/CSP.md)
- [Architekturentscheidungen](docs/DECISIONS.md), [ADRs](docs/adr/)

## Lizenz

Source-available, alle Rechte vorbehalten. Der Code darf gelesen und zur Bewertung lokal ausgeführt werden, aber nicht kommerziell genutzt werden. Details in [LICENSE](LICENSE).
