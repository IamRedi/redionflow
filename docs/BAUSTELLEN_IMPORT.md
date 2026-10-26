# Baustellen Import

Dieses Dokument beschreibt, wie der Import und Re-Import von Baustellen funktioniert.

## Grundprinzip

Der Import ist idempotent. Das bedeutet:

- Innerhalb einer Baustelle ist `TreeItem.treeId` eindeutig.
- Beim Re-Import werden passende Baeume anhand einer normalisierten `treeId` aktualisiert.
- Erledigte Arbeit wird nicht zurueckgesetzt.
- Der Status eines Baums (`todo`, `done`, `blocked`) wird beim Import nicht ueberschrieben.

Die Normalisierung verhindert Dubletten, wenn dieselbe Baum-ID in Dateien leicht anders geschrieben ist.
Beispiele:

- `00008100:000cf857`
- `8100:000cf857`

Diese Werte gelten beim Re-Import als derselbe Baum.

## Erlaubte Uploads

Mindestens eine Datei ist erforderlich.

### Excel/CSV ohne KML

Erlaubt:

```text
Excel / CSV: vorhanden
KML: leer
```

Das System erstellt oder aktualisiert die Baumliste aus der Tabelle.
Koordinaten bleiben leer, wenn keine KML-Datei hochgeladen wurde.

### KML ohne Excel/CSV

Erlaubt:

```text
Excel / CSV: leer
KML: vorhanden
```

Das System liest die KML-Placemarks und erzeugt daraus Baum-Eintraege.
Die `treeId` kommt bevorzugt aus ExtendedData-ID-Feldern, sonst aus dem KML-`name`.
Wenn Baumart oder Durchmesser fehlen, werden sichere Defaults genutzt:

- Baumart: `Unbekannt`
- Durchmesser: `0`

### Excel/CSV zusammen mit KML

Erlaubt:

```text
Excel / CSV: vorhanden
KML: vorhanden
```

Das System nimmt die Baumliste aus Excel/CSV und verbindet passende KML-Koordinaten ueber:

- Baum-ID / Baumnummer / Nr
- KML-`name`
- passende KML-ExtendedData-Felder wie `baumId`, `baumNr`, `standortNr`

## Re-Import in eine bestehende Baustelle

Der Re-Import wird ueber die bestehende Baustelle gestartet und uebergibt die `targetBaustelleId`.
Diese ID ist der sichere Zielschluessel. Der Dateiname ist dabei nicht entscheidend.

Beim Re-Import:

- neue `treeId`s werden als neue Baeume angelegt
- bestehende oder normalisiert passende `treeId`s aktualisieren Baumart und Durchmesser
- KML-Koordinaten werden aktualisiert, wenn die KML zu einer bestehenden oder normalisiert passenden `treeId` passt
- erledigte Arbeit, Status und Workzone-Historie bleiben erhalten

## KML-Re-Import fuer vorhandene Liste

Wenn eine Baustelle bereits eine Baumliste hat und spaeter nur eine KML-Datei hochgeladen wird:

1. Das System liest die KML-Punkte.
2. Es sucht passende `treeId`s in der bestehenden Baustelle.
3. Gefundene Baeume bekommen die neuen Koordinaten.
4. KML-Punkte ohne passende `treeId` werden als neue Baeume angelegt.

Damit kann man erst eine Liste importieren und spaeter GPS-Daten nachreichen.

## Neue Baustelle nur aus KML

Wenn keine bestehende Baustelle gewaehlt ist und nur eine KML hochgeladen wird, erstellt das System eine neue Baustelle.
Der Baustellenname kommt vom Dateinamen der KML.

## Was der Import nicht macht

- Er loescht keine Baeume.
- Er setzt keine erledigten Baeume zurueck.
- Er entfernt keine vorhandenen Materialien wie Konen, Bauzaun oder Halteverbot.
- Er ersetzt keine Workzone-Historie.

## Importdaten manuell loeschen

Admin kann in `/app/baustellen` pro Baustelle unter `Verwaltung` zwei Aktionen ausfuehren:

- `Importdaten loeschen`: loescht die Baumliste, KML-/Dokument-Referenzen und gespeicherte Kartenkoordinaten dieser Baustelle. Die Baustelle selbst bleibt bestehen und kann danach sauber neu importiert werden.
- `Baustelle loeschen`: loescht die komplette Baustelle.

Diese Aktionen sind bewusst getrennt:

- Fuer einen Test oder fehlerhaften Re-Import reicht normalerweise `Importdaten loeschen`.
- `Baustelle loeschen` ist fuer Baustellen gedacht, die komplett entfernt werden sollen.

## Warum so

Baustellen-Daten kommen oft spaeter oder in mehreren Dateien.
Diese Logik erlaubt sichere Teilimporte, ohne dass bereits geleistete Arbeit oder Live-Daten kaputtgehen.

## Geplante Erweiterung: NFC / Baum-Chip

Diese Funktion ist noch nicht aktiv, aber fachlich schon vorgegeben:

- Ein spaeterer NFC-/Chip-Scan soll denselben Baum ueber seine bestehende Baum-ID / `treeId` wiederfinden.
- Wenn der erkannte Baum bereits in der aktuellen Baustelle existiert, soll die Workzone direkt zu diesem Baum springen.
- Wenn kein passender Baum vorhanden ist, darf die UI kontrolliert `Baum hinzufuegen` anbieten.
- Diese Erweiterung darf die Importregeln nicht aendern: Re-Import bleibt idempotent, erledigte Arbeit bleibt erhalten und abgeschlossene Dokumentation darf durch spaetere Scans nicht inkonsistent werden.
