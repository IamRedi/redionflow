import * as XLSX from "xlsx";
import { MAX_SPREADSHEET_BYTES, validateXlsxContainer } from "./spreadsheet-container";

const MAX_ROWS = 100_000;
const MAX_COLUMNS = 512;
const MAX_CELLS = 2_000_000;

export type SpreadsheetFormat = "xlsx" | "xls" | "csv";
export type SpreadsheetRow = Record<string, string | number | null | undefined>;

/** Shared first-sheet semantics for the server upload and the operator fleet CLI. */
export function workbookRows(workbook: XLSX.WorkBook, empty: "" | null = ""): SpreadsheetRow[] {
  const name = workbook.SheetNames[0];
  if (!name) throw new Error("Spreadsheet has no first sheet.");
  const sheet = workbook.Sheets[name];
  const ref = sheet?.["!fullref"] ?? sheet?.["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    const columns = range.e.c - range.s.c + 1;
    if (range.e.r >= MAX_ROWS || range.e.c >= MAX_COLUMNS || rows * columns > MAX_CELLS) throw new Error("Spreadsheet dimensions exceed import limits.");
  }
  return XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, { defval: empty, raw: false });
}

export function readSpreadsheetRows(input: Buffer | string, format: SpreadsheetFormat, empty: "" | null = "") {
  if (Buffer.byteLength(input) > MAX_SPREADSHEET_BYTES) throw new Error("Spreadsheet exceeds import size limit.");
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const zip = bytes.subarray(0, 4).equals(Buffer.from([0x50,0x4b,3,4]));
  const zipAutodetected = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] < 9 && bytes[3] < 9;
  const ole = bytes.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
  // SheetJS autodetects binary containers independently of the supplied format.
  // Reject mismatches before it can bypass ZIP preflight (including fleet CLI).
  if ((format === "xlsx" && !zip) || (format === "xls" && !ole) || (format === "csv" && (zipAutodetected || ole))) {
    throw new Error("Spreadsheet bytes do not match the declared type.");
  }
  if (format === "xlsx") validateXlsxContainer(bytes);
  const workbook = format === "csv"
    ? XLSX.read(input, { type: "string", raw: false, sheetRows: MAX_ROWS + 1 })
    : XLSX.read(input, { type: "buffer", cellDates: false, sheetRows: MAX_ROWS + 1 });
  return workbookRows(workbook, empty);
}
