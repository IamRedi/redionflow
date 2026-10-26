import {
  coordsFromJson,
  xmlEscape,
  htmlEscape,
  treeStatusLabel,
  parseTreeMeta,
} from "./format";
import { EXPORT_TEXT, type ExportLang } from "./text";

export function htmlDocument(lang: ExportLang, title: string, intro: string, body: string) {
  return `<!doctype html>
<html lang="${htmlEscape(lang)}">
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      body {
        margin: 28px;
        color: #1f2937;
        background: #ffffff;
      }
      h1, h2 {
        margin: 0 0 12px;
        color: #111827;
      }
      h1 {
        font-size: 24px;
      }
      h2 {
        margin-top: 28px;
        font-size: 18px;
      }
      p, li {
        font-size: 14px;
        line-height: 1.6;
      }
      .meta {
        margin-bottom: 20px;
        padding: 14px 16px;
        border: 1px solid #d1d5db;
        border-radius: 14px;
        background: #f9fafb;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
        font-size: 13px;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f3f4f6;
        font-weight: 700;
      }
      .status {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
      }
      .status-offen { background: #fef3c7; color: #92400e; }
      .status-erledigt { background: #dcfce7; color: #166534; }
      .status-blockiert { background: #fee2e2; color: #991b1b; }
      .col-tight {
        width: 56px;
        text-align: center;
      }
      .col-worker {
        width: 150px;
      }
      .col-extra {
        width: 90px;
        text-align: center;
      }
      @media print {
        body {
          margin: 12mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="meta">
      <h1>${htmlEscape(title)}</h1>
      <p>${htmlEscape(intro)}</p>
    </div>
    ${body}
  </body>
</html>`;
}

export function buildTreeKml(
  baustelle: {
    name: string;
    address: string | null;
    coordinates: unknown;
    treeItems: Array<{
      treeId: string;
      status: string;
      species: string | null;
      diameter: number | null;
      coordinates: unknown;
      notes: string | null;
    }>;
  },
  text: (typeof EXPORT_TEXT)[ExportLang],
) {
  const siteCoords = coordsFromJson(baustelle.coordinates);
  const placemarks = baustelle.treeItems
    .map((tree) => {
      const coords = coordsFromJson(tree.coordinates);
      if (coords.lat == null || coords.lng == null) return "";
      const meta = parseTreeMeta(tree.notes);
      const description = [
        `${text.tree}: ${tree.treeId}`,
        `${text.status}: ${treeStatusLabel(tree.status, text)}`,
        `${text.species}: ${tree.species ?? "-"}`,
        `${text.diameter}: ${tree.diameter ?? "-"}`,
        `${text.action}: ${meta.action || "-"}`,
        `${text.note}: ${meta.note || "-"}`,
        `${text.noParking}: ${meta.haltverbot ? text.yes : text.no}`,
      ].join("\n");

      return `
    <Placemark>
      <name>${xmlEscape(tree.treeId)}</name>
      <styleUrl>#${xmlEscape(tree.status)}</styleUrl>
      <description>${xmlEscape(description)}</description>
      <Point>
        <coordinates>${coords.lng},${coords.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("");

  const sitePlacemark =
    siteCoords.lat != null && siteCoords.lng != null
      ? `
    <Placemark>
      <name>${xmlEscape(baustelle.name)}</name>
      <styleUrl>#baustelle</styleUrl>
      <description>${xmlEscape(baustelle.address ?? "")}</description>
      <Point>
        <coordinates>${siteCoords.lng},${siteCoords.lat},0</coordinates>
      </Point>
    </Placemark>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(baustelle.name)}</name>
    <Style id="todo"><IconStyle><color>ff08b3ea</color><scale>1.1</scale></IconStyle></Style>
    <Style id="done"><IconStyle><color>ff55c522</color><scale>1.1</scale></IconStyle></Style>
    <Style id="blocked"><IconStyle><color>ff4444ef</color><scale>1.1</scale></IconStyle></Style>
    <Style id="baustelle"><IconStyle><color>ffc084fc</color><scale>1.25</scale></IconStyle></Style>
    ${sitePlacemark}
    ${placemarks}
  </Document>
</kml>`;
}
