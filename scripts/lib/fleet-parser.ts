import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { readSpreadsheetRows, type SpreadsheetFormat, type SpreadsheetRow } from "../../src/lib/import/spreadsheet";
import { MAX_SPREADSHEET_BYTES } from "../../src/lib/import/spreadsheet-container";

/** Parse completely before the fleet command opens any company/write workflow. */
export function readFleetSpreadsheet(path: string) {
  const format = extname(path).slice(1).toLowerCase();
  if (!["xlsx","xls","csv"].includes(format)) throw new Error("Unsupported fleet spreadsheet type.");
  if (statSync(path).size > MAX_SPREADSHEET_BYTES) throw new Error("Spreadsheet exceeds import size limit.");
  const bytes = readFileSync(path);
  const rows = readSpreadsheetRows(format === "csv" ? bytes.toString("utf8") : bytes, format as SpreadsheetFormat, null);
  // SheetJS 0.20 normalizes XML CRLF to LF. Keep the fleet command's existing
  // documented model-column key while leaving unrelated columns untouched.
  const legacyModelKey = "Marke / Handels-\r\nbezeichnung / Modell";
  const normalizedModelKey = legacyModelKey.replace(/\r\n/g, "\n");
  return rows.map(row => {
    if (!(normalizedModelKey in row)) return row;
    const compatible: SpreadsheetRow = { ...row, [legacyModelKey]: row[normalizedModelKey] };
    delete compatible[normalizedModelKey];
    return compatible;
  });
}
