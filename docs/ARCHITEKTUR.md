# Architektur im Überblick

![Architektur von RediOnFlow](assets/architecture.svg)

Dieses Dokument ist der Einstieg. Tiefer gehen [SAAS_ARCHITECTURE.md](SAAS_ARCHITECTURE.md) (Produkte, Modi, Mandanten), [RLS.md](RLS.md) (Row-Level Security), [CSP.md](CSP.md), [SESSION_REVOCATION.md](SESSION_REVOCATION.md) und [SECURITY.md](../SECURITY.md).

## Drei Oberflächen, eine Anwendung

| Oberfläche | Wer | Wo im Code |
|---|---|---|
| **Workzone** | Mitarbeitende auf der Baustelle, am Handy; Admins sehen dieselbe Ansicht mit mehr Rechten | `src/app/(workzone)/workzone` |
| **Admin** | Büro und Chef: Dashboard, Personal, Fuhrpark, Baustellen, Kalkulation, Inventar, Einstellungen | `src/app/(admin)/app` |
| **Display und Demo** | Lesende Ansichten für einen Monitor in der Halle und die öffentliche Demo | `src/app/display`, `src/app/demo` |

Alle drei laufen in einer Next.js-16-Anwendung (App Router). Änderungen gehen über Server Actions oder wenige API-Routen (`src/app/api`), etwa für die Synchronisation aus der Workzone, private Dateien, Push-Registrierung, Stripe-Webhooks und Fahrzeug-GPS.

## Zwei Produkte über einen Modus

Jede Firma hat einen `mode` (`baumdienst` oder `bau`, per Datenbank-Constraint auf diese zwei beschränkt). `src/lib/mode-config.ts` leitet daraus Feature-Flags ab, zum Beispiel `trees` für alles, was nur Bäume betrifft. Übersetzungen liegen in `src/locales/<sprache>.json`; BauFlow überschreibt einzelne Begriffe in `src/locales/bau/<sprache>.json` („Arbeit“ statt „Baum“, „Menge“ statt „Durchmesser“). Ein Test stellt sicher, dass jede BauFlow-Übersetzung in allen 6 Sprachen vorhanden ist.

So bleibt es eine Codebasis: Eine Verbesserung an der Workzone kommt beiden Produkten zugute, und baumspezifische Teile tauchen in BauFlow nicht auf.

## Sicherheit an der Grenze

Jede ändernde Anfrage durchläuft dieselben Schritte:

1. **Herkunft:** Same-Origin-Prüfung (`src/lib/auth/same-origin.ts`) und Next.js-Origin-Check für Server Actions.
2. **Identität und Rolle:** signierte Sitzung mit Epoche, die sich serverseitig widerrufen lässt; Rollen Admin, Mitarbeitende, Display.
3. **Mandant:** Die Firma kommt aus der Sitzung, nie aus der Anfrage. Kind-Datensätze werden nur an Eltern derselben Firma gebunden.
4. **Eingaben:** Zod-Schemas, zum Beispiel für die Workzone-Synchronisation (`src/lib/workzone/sync/schemas.ts`).
5. **Datenbank:** PostgreSQL Row-Level Security als zweite Linie, Laufzeit über eine eingeschränkte Datenbankrolle.

## Daten

PostgreSQL 16 mit Prisma 7 (Driver Adapter `@prisma/adapter-pg`), 59 Modelle, 49 Migrationen. Wichtige Bereiche: Firmen und Benutzer, Mitarbeitende mit Sitzungen und Pausen, Baustellen mit Arbeiten (`TreeItem`, in BauFlow als Arbeit genutzt), Tagespläne mit Versionen, Maschinen und Kegel, Inventar mit Barcode und Bewegungen, Projekte mit Positionen und Kostenarten, Audit-Log.

## Betrieb

- **SaaS:** viele Firmen in einer Datenbank, Registrierung, Testphase, Stripe-Abos.
- **Eigene Instanz:** eine Firma, eigene Datenbank, Erstanmeldung über einen gesicherten First-Boot-Ablauf.
- **Demo:** `APP_ENV=demo`, fiktive Daten aus `prisma/seed*.ts`, nächtlicher Reset über `npm run demo:reset`. Die Live-Demos laufen auf Railway ([DEPLOYMENT.md](DEPLOYMENT.md), [`railway.json`](../railway.json)).

## Optionale Dienste

| Dienst | Wofür | Ohne ihn |
|---|---|---|
| Supabase Storage | Dokumente und Fotos | Dateien liegen im lokalen Dateisystem (für Entwicklung und Einzelinstanz) |
| Firebase Cloud Messaging | Push-Benachrichtigungen | Keine Push-Nachrichten, alles andere läuft |
| Stripe | Abos im SaaS-Modus | Eigene Instanz und Demo brauchen es nicht |
| OpenAI | KI-Assistent für Admins und Mitarbeitende | Der Assistent meldet, dass der Schlüssel fehlt |
| Fahrzeug-GPS | Positionen der Maschinen | Keine Live-Positionen, Fuhrpark funktioniert sonst normal |
