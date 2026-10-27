# Sicherheit

## Schwachstellen melden

Bitte keine öffentlichen Issues für Sicherheitslücken. Melde sie vertraulich über
**GitHub → Security → Report a vulnerability** (Private Vulnerability Reporting).
Du bekommst innerhalb von 7 Tagen eine Rückmeldung. Bestätigte Lücken werden
behoben, bevor Details veröffentlicht werden.

## Bedrohungsmodell

### Was geschützt wird

| Asset | Warum es zählt |
|---|---|
| Personaldaten der Mitarbeitenden (Kontakt, Geburtsdatum, Arbeitszeiten, Urlaub, HR-Notizen) | DSGVO-relevant; Leck schadet Personen direkt |
| Baustellen, Kunden, Kalkulationen, Berichte | Geschäftsgeheimnisse der Firma |
| GPS-Positionen von Fahrzeugen und Arbeitszeit-Sessions | Bewegungsprofile |
| Hochgeladene Dateien (Fotos, Dokumente) | Können personenbezogene Daten enthalten |
| Admin- und Worker-Sitzungen | Schlüssel zu allem oben |

### Wer angreift

1. **Anonyme Internetnutzer**: erreichen nur öffentliche Seiten, Login-Formulare und wenige Webhooks.
2. **Angemeldete Mitarbeitende**: dürfen ihre eigene Arbeit sehen, aber keine Admin-Funktionen nutzen.
3. **Andere Mandanten (SaaS)**: eine fremde Firma auf derselben Instanz. Sie darf nie Daten einer anderen Firma lesen oder ändern.
4. **Gestohlenes Gerät / abgegriffene Sitzung**: ein gültiges Cookie in falschen Händen.

Außerhalb des Modells: ein kompromittierter Server, Datenbank-Superuser und
die Infrastruktur des Hosting-Anbieters.

### Kontrollen

| Bedrohung | Kontrolle | Wo |
|---|---|---|
| Fremder Mandant liest Daten | Mandantenfilter in jeder Abfrage (wirksame Grenze); PostgreSQL-Row-Level-Security-Policies mit `FORCE` als zweite Linie, mit eingeschränkter Rolle bisher nur im Pilot für Baustellen und Tagesplan durchgesetzt; ohne gesetzten Mandanten liefert jede Policy 0 Zeilen | `src/lib/db/tenant*.ts`, [docs/RLS.md](docs/RLS.md) |
| Rechteausweitung Worker → Admin | Rollenprüfung in jeder Server Action und jedem Route Handler; Admin-Verwaltung nur durch den Firmeninhaber (`User.isOwner`) | `src/lib/auth/authorization.ts`, `src/app/(admin)/app/profile/actions.ts` |
| Passwort raten | Admins: E-Mail + Passwort (mind. 12 Zeichen), scrypt-Hashes; Postgres-gestütztes Rate-Limit pro Client (fail-closed) für Admin-, Worker-, Display- und First-Boot-Login | `src/lib/auth/password.ts`, `src/lib/auth/login-guard.ts`, [ADR-0001](docs/adr/0001-login-rate-limiter-backend.md) |
| Sitzung gestohlen | HMAC-signierte, `httpOnly`-, `SameSite=Lax`-, in Produktion `Secure`-Cookies; Sitzungs-Epoche wird bei Passwortwechsel oder Entfernung erhöht und entwertet alle alten Cookies | `src/lib/auth/session-cookie.ts`, [docs/SESSION_REVOCATION.md](docs/SESSION_REVOCATION.md) |
| CSRF | Same-Origin-Prüfung für jede zustandsändernde API-Route, Server Actions mit Next.js-Origin-Check | `src/lib/auth/same-origin.ts` |
| Bösartige Uploads | Magic-Byte-Prüfung, Größenlimit, Content-Scan-Schnittstelle, private Dateien nur über eine autorisierte Route | [docs/CONTENT_SCANNING.md](docs/CONTENT_SCANNING.md), `src/app/api/private-files/route.ts` |
| Clickjacking, MIME-Sniffing, Downgrade | HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `next.config.mjs` |
| XSS | React-Escaping, keine `dangerouslySetInnerHTML` mit Nutzereingaben; CSP im Report-Only-Modus mit Sammelendpunkt | [docs/CSP.md](docs/CSP.md) |
| Gefälschte Webhooks | Stripe-Signaturprüfung; Fahrzeug-GPS nur mit Mandanten-Token | `src/app/api/stripe/webhook/route.ts`, `src/lib/fleet/ingest-auth.ts` |
| Ungültige Eingaben | Zod-Schemas an den Grenzen (Sync, Formulare, Login) | `src/lib/workzone/sync/schemas.ts` u. a. |
| Öffentliche Demo zeigt echte Daten | `/demo` existiert nur bei `APP_ENV=demo` oder `local`; die Demo-Instanz enthält ausschließlich fiktive Daten | `src/lib/public-demo.ts` |
| Geheimnisse im Code | gitleaks auf jedem Push, `.env*` ignoriert, keine Standard-Passwörter im Code | `.github/workflows/ci.yml` |
| Verwundbare Abhängigkeiten | `npm audit` ohne Befunde zum Zeitpunkt dieser Fassung | `package.json` |

### Bekannte Restrisiken

- **CSP ist noch Report-Only.** Sie blockiert nichts, bis die Richtlinie nach der Auswertung der Berichte scharf geschaltet wird.
- **Worker- und Display-Login nutzen 6-stellige Codes.** Das ist auf der Baustelle bewusst schnell; Schutz kommt vom Rate-Limit und davon, dass diese Rollen keine Admin-Rechte haben.
- **Der Content-Scanner ist standardmäßig ein No-op** (nur EICAR-Test). Für produktive Uploads sollte ein echter Scanner angebunden werden.
- **Realtime-Benachrichtigungen laufen im Prozess.** Mehrere Instanzen teilen sie nicht; die Ereignisse enthalten aber nur Namen und Bereiche, keine Daten.
- **Bestehende Admins mit altem 6-stelligen Code** können sich damit anmelden, bis der Inhaber ein neues Passwort setzt.

## Prüfungen in CI

Lint, Typecheck, Unit-, Integrations- (gegen frische PostgreSQL mit RLS-Policies) und
E2E-Tests sowie gitleaks laufen bei jedem Push. Die Integrationstests enthalten
eine Sicherheitsmatrix für Mandantentrennung, Sitzungsgrenzen und
Rollenprüfungen (`src/lib/db/*security*.integration.test.ts`).
