# Urlaub

Dieses Dokument beschreibt kurz und verbindlich, wie Urlaub in der Plattform funktioniert.

## Grundidee

- Jeder Worker hat ein Urlaubskonto: `Worker.vacationAllowanceDays`.
- Standardwert beim Anlegen ist `26`.
- Admins koennen den Wert in `HR & Flotte` pro Worker bearbeiten.
- Worker koennen Urlaub im eigenen Profil beantragen.
- Urlaubstage werden erst nach Admin-Genehmigung vom Rest abgezogen.

## Workflow

1. Worker oeffnet `Workzone -> Profil`.
2. Im Bereich `Tickets / Berichte` sieht der Worker den Block `Urlaub`.
3. Dort stehen:
   - `Gesamt`: vom Admin hinterlegte Urlaubstage.
   - `Genehmigt`: bereits genehmigte Urlaubstage.
   - `Offen`: beantragte, aber noch nicht entschiedene Tage.
   - `Rest`: Gesamt minus genehmigte Tage.
4. Worker klickt bzw. nutzt `Urlaub beantragen`.
5. Worker gibt `Von`, `Bis`, `Urlaubstage` und optional eine Notiz ein.
6. Admin sieht beim Worker oben in der Workzone-Leiste ein `?`, wenn eine offene Urlaubsanfrage existiert.
7. Admin oeffnet das Worker-Profil und kann die Anfrage `Genehmigen` oder `Ablehnen`.
8. Admin kann eine Nachricht hinterlassen, zum Beispiel `Bitte persoenlich mit dem Chef sprechen`.
9. Worker sieht die Antwort in der Urlaubshistorie. Zusaetzlich erscheint fuer kurze Zeit ein `!` am eigenen Worker-Kreis, wenn eine Anfrage beantwortet wurde.

## NRW-Kalender

Die Plattform zaehlt Urlaubstage nach Arbeitstagen in NRW:

- Samstag und Sonntag werden nicht als Urlaubstag gezaehlt.
- NRW-Feiertage werden nicht als Urlaubstag gezaehlt.
- Aktuell beruecksichtigte Feiertage:
  - Neujahr
  - Karfreitag
  - Ostermontag
  - Tag der Arbeit
  - Christi Himmelfahrt
  - Pfingstmontag
  - Fronleichnam
  - Tag der Deutschen Einheit
  - Allerheiligen
  - 1. Weihnachtstag
  - 2. Weihnachtstag

Beispiel: Wenn ein Worker `1. Mai bis 5. Mai` beantragt, werden Wochenenden und der 1. Mai automatisch ausgeschlossen. Wenn in diesem Zeitraum nur 2 NRW-Arbeitstage liegen, werden maximal 2 Urlaubstage gespeichert.

## Datenmodell

- `Worker.vacationAllowanceDays`: gesamtes Urlaubskonto.
- `VacationRequest.status`:
  - `PENDING`: offen.
  - `APPROVED`: genehmigt, zaehlt gegen das Urlaubskonto.
  - `REJECTED`: abgelehnt, zaehlt nicht gegen das Urlaubskonto.
- `VacationRequest.adminMessage`: Nachricht vom Admin bei Genehmigung oder Ablehnung.

## Regeln

- Worker duerfen nur eigene Urlaubsanfragen erstellen.
- Admins duerfen Anfragen genehmigen oder ablehnen.
- Bereits bearbeitete Anfragen koennen nicht noch einmal bearbeitet werden.
- Wenn die genehmigte Anfrage mehr Tage als den Resturlaub benoetigt, blockiert der Server die Genehmigung.
- UI ist nur Komfort; die wichtigen Regeln liegen serverseitig in `vacation-actions.ts`.

## Assistant-Zugriff

Der Team-Assistent kennt die Urlaub-Logik und fragt Live-Daten aus der Datenbank ab.

- Worker koennen nach dem eigenen Urlaubskonto fragen. Der Assistent nutzt `getMyVacationSummary`.
- Admin kann fragen, wer an einem Datum einsatzbereit ist. Der Assistent nutzt `adminGetAvailabilityForDate`.
- `adminGetAvailabilityForDate` beruecksichtigt genehmigten Urlaub, `VACATION`, `SICK` und `UNAVAILABLE` im Worker-Profil.
- Offene Urlaubsanfragen fuer das abgefragte Datum werden separat mit angezeigt.
- Admin kann fragen, wer Urlaub beantragt hat. Der Assistent nutzt `adminListVacationRequests`.
- Offene Anfragen sind standardmaessig `PENDING`; bei Bedarf kann der Assistent auch `APPROVED`, `REJECTED` oder `ALL` abfragen.
- Antworten zu Urlaub und Verfuegbarkeit sollen kurz, menschlich und ohne Links sein, ausser der Nutzer fragt ausdruecklich nach einem Link.
- In der Workzone wird ein Worker an Tagen mit genehmigtem Urlaub automatisch als `Urlaub` dargestellt, auch wenn der Profilstatus nicht manuell umgestellt wurde.

Grundregel: Der Assistent darf Urlaubsdaten nur in dem Umfang sehen, den derselbe eingeloggte User in der UI sehen darf. Admin sieht Team-Urlaub; Worker sieht nur den eigenen Urlaub.
