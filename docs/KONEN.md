# Konen Modul

Dieses Dokument beschreibt die Logik fuer die weiss/roten Baustellen-Konen.
Das wichtigste Prinzip: Konen werden nicht frei erzeugt. Admins definieren den
Bestand pro Maschine, danach bewegen sich diese Konen nur noch im System.

## Kernprinzip

- `Machine.coneTotal` ist der Basisbestand einer Maschine.
- Die Summe aller `coneTotal` Werte ist der Firmenbestand.
- Mitarbeiter koennen diesen Firmenbestand nicht erhoehen.
- Jede Bewegung wird in `MachineConeMovement` gespeichert.
- Der aktuelle Bestand wird aus dem Ledger berechnet, nicht manuell gespeichert.

Beispiel:

- 4 Maschinen mit je 5 Konen = 20 Konen in der Firma.
- Wenn 3 Konen von Maschine A an Baum 12 gesetzt werden, hat Maschine A 3 weniger verfuegbar.
- Wenn diese 3 Konen eingesammelt und in Maschine B gelegt werden, hat Maschine B 3 mehr verfuegbar.

## Datenmodell

`Machine.coneTotal`

- Basisbestand, nur Admin.
- Wert wird in der Maschinenkarte im Workzone-FLOTE Bereich gepflegt.

`MachineConeMovement`

- `DEPLOY`: Konen werden von einer Maschine an einen Baum gesetzt.
- `COLLECT`: Konen werden von einem Baum eingesammelt und in eine Maschine gelegt.
- `TRANSFER`: Konen werden direkt von Maschine A zu Maschine B gegeben.

Wichtige Felder:

- `fromMachineId`: Quelle.
- `toMachineId`: Ziel.
- `baustelleId`: Baustelle, wenn Bewegung an einer Baustelle passiert.
- `treeItemId`: Baum, wenn Bewegung an einem Baum passiert.
- `actorRole`, `actorWorkerId`, `actorAdminId`, `actorName`: wer die Bewegung gemacht hat.

Bei `COLLECT` wird `fromMachineId` als Ursprungsmaschine benutzt. Dadurch kann die Historie spaeter zeigen, von welcher Maschine die eingesammelten Konen urspruenglich kamen, auch wenn sie in eine andere Maschine gelegt werden.

## Berechnung

Verfuegbar pro Maschine:

```text
available =
  coneTotal
  - DEPLOY von dieser Maschine
  + COLLECT in diese Maschine
  - TRANSFER von dieser Maschine
  + TRANSFER in diese Maschine
```

Konen vor Ort pro Baum:

```text
onTree =
  DEPLOY an diesen Baum
  - COLLECT von diesem Baum
```

Die Berechnung auf der Baustellen-Detailseite ist zweigeteilt:

- Maschinen-Verfuegbarkeit wird firmenweit berechnet, ueber alle `MachineConeMovement` Eintraege.
- Konen am Baum werden nur fuer die aktuelle Baustelle und den aktuellen Baum berechnet.

Das ist wichtig, weil die Dropdown-Liste im Baum-Dialog immer den realen Firmenbestand pro Maschine zeigen muss, nicht nur Bewegungen der aktuellen Baustelle.

## Server-Regeln

Alle kritischen Regeln liegen serverseitig in:

```text
src/app/(workzone)/workzone/cone-actions.ts
```

Regeln:

- `DEPLOY` ist blockiert, wenn die Quellmaschine nicht genug verfuegbare Konen hat.
- `TRANSFER` ist blockiert, wenn die Quellmaschine nicht genug verfuegbare Konen hat.
- `COLLECT` ist blockiert, wenn am Baum weniger Konen vor Ort sind als eingesammelt werden sollen.
- Maschinen muessen zur gleichen Firma gehoeren.
- Admin darf `coneTotal` setzen.
- Eingeloggte Worker/Admins duerfen Bewegungen ausfuehren und Historie sehen.

Diese Regeln duerfen nicht nur im UI existieren. Das UI ist Komfort, die Server Action ist die Wahrheit.

## UI-Flows

### Admin setzt Grundbestand

Ort:

```text
/workzone -> FLOTE -> Maschinenkarte -> Konen
```

Admin setzt `Total`. Danach wird `Verfuegbar` aus Total plus Ledger berechnet.

### Konen an Baum setzen

Ort:

```text
/workzone/baustellen/[baustelleId] -> Baumliste -> Konen Button
```

Flow:

1. Mitarbeiter klickt den Konen Button am Baum.
2. Dialog zeigt `Aktuell vor Ort`.
3. Dropdown zeigt Maschinen mit realer `verfuegbar` Zahl.
4. `Menge` startet immer mit `0`, damit `Setzen` und `Einsammeln` nicht versehentlich geklickt werden koennen.
5. Mitarbeiter waehlt Maschine und eine Menge groesser als 0.
6. `Setzen` erzeugt `DEPLOY`.

Wenn die Maschine 0 Konen verfuegbar hat, darf diese Bewegung nicht gespeichert werden.

### Konen einsammeln

Ort:

```text
/workzone/baustellen/[baustelleId] -> Baumliste -> Konen Button
```

Flow:

1. Mitarbeiter klickt den Konen Button am Baum.
2. Dialog zeigt `Aktuell vor Ort`.
3. System schlaegt die Ursprungsmaschine vor, basierend auf den Konen, die aktuell am Baum liegen.
4. `Menge` startet immer mit `0`, damit keine versehentliche Rueckgabe gespeichert wird.
5. Mitarbeiter waehlt die Zielmaschine, in die die Konen gelegt werden.
6. `Einsammeln` erzeugt `COLLECT`.

Nach dem Einsammeln muss `Aktuell vor Ort` entsprechend sinken. Wenn alle Konen eingesammelt sind, muss der Wert 0 sein und die Konen-Markierung am Baum verschwinden.

### Konen zwischen Maschinen transferieren

Ort:

```text
/workzone -> FLOTE -> Maschinenkarte -> Konen -> Transfer
```

Flow:

1. Maschine A wird geoeffnet.
2. Zielmaschine und Menge werden gewaehlt.
3. `TRANSFER` wird gespeichert.

Transfer ist nur erlaubt, wenn Maschine A genug verfuegbare Konen hat.

## Baumliste

In der Baumliste bleiben Baeume mit Konen vor Ort oben, auch wenn der Baum bereits `done` ist.
Grund: Mitarbeiter sollen nicht vergessen, die Konen wieder einzusammeln.

Sortierlogik:

1. Baeume mit `onTree > 0`.
2. Danach normale Status-Reihenfolge: `todo`, `blocked`, `done`.
3. Danach `treeId`.

## Historie

Die Maschinenkarte zeigt die letzten Bewegungen einer Maschine:

- Zeitpunkt.
- Typ (`DEPLOY`, `COLLECT`, `TRANSFER`).
- Menge.
- Quelle/Ziel.
- Baustelle/Baum, wenn vorhanden.
- Mitarbeiter/Admin.

Wichtig fuer Rueckgaben:

- Wenn Konen von Maschine A an Baum X gesetzt wurden und spaeter in Maschine B eingesammelt werden, steht in der Historie von A, dass diese Konen von A kamen.
- In der Historie von B steht, dass sie in B eingesammelt wurden.

## Reset fuer Tests

Wenn Konen beim Testen durcheinander geraten sind:

```powershell
npm run db:reset:cones
```

Das Script:

- loescht alle `MachineConeMovement` Eintraege der Default Company.
- setzt `Machine.coneTotal` aller Maschinen der Default Company auf 0.

Danach muss der Admin die Grundbestaende wieder neu setzen.

## Dateien

- `prisma/schema.prisma`
- `prisma/migrations/20260421082500_add_machine_cones_tracking/migration.sql`
- `src/app/(workzone)/workzone/cone-actions.ts`
- `src/app/(workzone)/workzone/layout.tsx`
- `src/app/(workzone)/workzone/machine-sidebar.tsx`
- `src/app/(workzone)/workzone/baustellen/[baustelleId]/page.tsx`
- `src/app/(workzone)/workzone/baustellen/[baustelleId]/tree-list.tsx`
- `scripts/reset-cones-data.ts`

## Invariants

Diese Regeln muessen bei zukuenftigen Aenderungen erhalten bleiben:

- Firmenbestand entsteht nur durch Admin `coneTotal`.
- Worker-Aktionen duerfen den Firmenbestand nie erhoehen.
- Verfuegbarkeit muss serverseitig geprueft werden.
- Baum-Bestand muss aus `DEPLOY - COLLECT` berechnet werden.
- UI darf keine Bewegung speichern, die serverseitig verboten ist.
- Baeume mit Konen vor Ort muessen sichtbar priorisiert bleiben.
- UI-Texte muessen auf Deutsch bleiben; keine albanischen Aktionslabels in der App.
