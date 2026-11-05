/**
 * Element lists from the drawing office (Tekla Structures exports, as AL-Steel
 * receives them): "Lista assemblaggi" (assemblies: B/12 BEAM, C/40 COLUMN) and
 * "Lista parti" (cut parts: plate 1001, profile c/83). The files are .xls that
 * are really HTML tables, or real Excel; both are read the same way.
 *
 * Columns are found by their header text (Italian, English or Albanian), so a
 * re-ordered export still reads correctly. The "Totale" row ends the list.
 */
import * as XLSX from "xlsx";

export type ElementListKind = "assembly" | "part";

export type ParsedElement = {
  mark: string;
  kind: string | null;
  profile: string | null;
  material: string | null;
  quantity: number;
  lengthMm: number | null;
  weightKg: number | null;
  areaM2: number | null;
};

export type ParsedElementList = {
  list: ElementListKind;
  projectNumber: string | null;
  projectName: string | null;
  elements: ParsedElement[];
  totalPieces: number;
  totalKg: number;
};

type Cell = string | number | boolean | null | undefined;

const text = (value: Cell) => (value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim());

function num(value: Cell) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value).replace(/\s/g, "");
  if (!raw) return null;
  // "1.234,56" (comma decimals) or "1234.56".
  const normal = /,\d{1,3}$/.test(raw) ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  const parsed = Number(normal);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Header cell → field. Matching ignores case, accents and broken encodings (Q.t� = Q.tà). */
function fieldOf(header: string): keyof ParsedElement | "weightTotal" | "areaTotal" | null {
  const h = header
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9()/.² ]/g, "");
  if (/^(assemb|assembly|mark|pozicion|elementi)/.test(h)) return "mark";
  if (/^(parte|part|pjes)/.test(h)) return "mark";
  if (/^(q\.?t|qty|quantit|sasi)/.test(h)) return "quantity";
  if (/^(nome|name|emri|tipi)/.test(h)) return "kind";
  if (/^(profilo|profile|profil)/.test(h)) return "profile";
  if (/^(material)/.test(h)) return "material";
  if (/^(lungh|length|gjat)/.test(h)) return "lengthMm";
  if (/^(peso|weight|pesh)/.test(h)) return /tot/.test(h) ? "weightTotal" : "weightKg";
  if (/^(area|siperf)/.test(h)) return /tot/.test(h) ? "areaTotal" : "areaM2";
  return null;
}

function detectList(header: string): ElementListKind | null {
  const h = header.toLowerCase();
  if (/^(assemb|assembly)/.test(h)) return "assembly";
  if (/^(parte?|part)\b/.test(h)) return "part";
  return null;
}

/** No "Assemb." / "Parte" label: assemblies carry a name (BEAM, COLUMN), parts do not. */
function guessList(columns: Array<ReturnType<typeof fieldOf>>): ElementListKind {
  return columns.includes("kind") ? "assembly" : "part";
}

export class ElementListError extends Error {}

/**
 * For the log when a file is not read: sheet names and the first cells of
 * the first rows (column titles, marks), never more, so the reason shows
 * without keeping the file.
 */
export function describeWorkbook(data: Uint8Array): string {
  try {
    const workbook = XLSX.read(data, { type: "array" });
    return workbook.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[name]!, { header: 1, raw: false, defval: "" }).filter((row) => row.some((cell) => text(cell)));
      const head = rows.slice(0, 3).map((row) => row.slice(0, 6).map((cell) => text(cell).slice(0, 16)).join("|"));
      return `${name}[${rows.length}]: ${head.join(" / ")}`;
    }).join("; ").slice(0, 600);
  } catch (error) {
    return `unreadable: ${String(error).slice(0, 120)} · first bytes ${Array.from(data.slice(0, 8)).map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}`;
  }
}

/** Reads one exported list. Throws ElementListError when it is neither list. */
export function parseElementList(data: ArrayBuffer | Uint8Array): ParsedElementList {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data instanceof Uint8Array ? data : new Uint8Array(data), { type: "array" });
  } catch {
    throw new ElementListError("The file could not be read.");
  }
  let projectNumber: string | null = null;
  let projectName: string | null = null;
  let found: ParsedElementList | null = null;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    // Numbers as numbers for the list, the shown text for the header (keeps "0132").
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: "" });
    const shown = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: false, defval: "" });
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r] ?? [];
      const first = text(row[0]);
      // Project header: "Progetto numero: 0132", "Progetto Pllum Stafuka".
      const label = first.toLowerCase().replace(/[:\s]+$/, "");
      if (/^(progetto numero|project number|nr\.? projekti)/.test(label)) projectNumber = text(shown[r]?.[1]) || projectNumber;
      else if (/^(progetto|project|projekti)$/.test(label)) projectName = text(row[1]) || projectName;
      if (found) continue;
      // The header row: a mark column and a quantity column, wherever they
      // start (an export re-saved in Excel may shift or rename the first cell).
      const columns = row.map((cell) => fieldOf(text(cell)));
      if (!columns.includes("quantity")) continue;
      const markAt = columns.indexOf("mark");
      const list = detectList(first) ?? (markAt >= 0 ? detectList(text(row[markAt])) : null) ?? (markAt >= 0 ? guessList(columns) : null);
      if (!list) continue;
      const lead0 = markAt >= 0 ? markAt : 0;
      const elements: ParsedElement[] = [];
      for (let d = r + 1; d < rows.length; d += 1) {
        const cells = rows[d] ?? [];
        const lead = text(cells[lead0]);
        if (!lead) continue;
        if (/^(totale|total)/i.test(lead)) break;
        const entry: ParsedElement = { mark: lead, kind: null, profile: null, material: null, quantity: 1, lengthMm: null, weightKg: null, areaM2: null };
        let weightTotal: number | null = null;
        let areaTotal: number | null = null;
        columns.forEach((field, c) => {
          const value = cells[c];
          switch (field) {
            case "quantity":
              entry.quantity = Math.max(1, Math.round(num(value) ?? 1));
              break;
            case "kind":
            case "profile":
            case "material":
              entry[field] = text(value) || null;
              break;
            case "lengthMm":
            case "weightKg":
            case "areaM2":
              entry[field] = num(value);
              break;
            case "weightTotal":
              weightTotal = num(value);
              break;
            case "areaTotal":
              areaTotal = num(value);
              break;
            default:
              break;
          }
        });
        // Lists that only give totals still get a per-piece value.
        if (entry.weightKg === null && weightTotal !== null) entry.weightKg = weightTotal / entry.quantity;
        if (entry.areaM2 === null && areaTotal !== null) entry.areaM2 = areaTotal / entry.quantity;
        elements.push(entry);
      }
      found = {
        list,
        projectNumber: null,
        projectName: null,
        elements: dedupe(elements),
        totalPieces: 0,
        totalKg: 0,
      };
    }
  }
  if (!found || found.elements.length === 0) throw new ElementListError("No assembly or part list found in the file.");
  found.projectNumber = projectNumber;
  found.projectName = projectName;
  found.totalPieces = found.elements.reduce((sum, e) => sum + e.quantity, 0);
  found.totalKg = Math.round(found.elements.reduce((sum, e) => sum + (e.weightKg ?? 0) * e.quantity, 0) * 100) / 100;
  return found;
}

/** The same mark twice (split export) becomes one row with the quantities added. */
function dedupe(elements: ParsedElement[]) {
  const byMark = new Map<string, ParsedElement>();
  for (const element of elements) {
    const existing = byMark.get(element.mark);
    if (existing) existing.quantity += element.quantity;
    else byMark.set(element.mark, { ...element });
  }
  return [...byMark.values()];
}

/** B/2 before B/10, C/9 before C/40; parts 1001 before 1010. */
export function compareMarks(a: string, b: string) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}
