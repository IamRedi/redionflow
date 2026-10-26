import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { readSpreadsheetRows, workbookRows } from "./spreadsheet";
import { readFleetSpreadsheet } from "../../../scripts/lib/fleet-parser";

const fixture = (name: string) => readFileSync(`tests/fixtures/spreadsheets/${name}`);
it.each(["xlsx", "xls"] as const)("characterizes valid %s first-sheet formatted date/number/string/unknown columns", format => {
  const rows = readSpreadsheetRows(fixture(`trees.${format}`), format);
  expect(rows).toEqual([
    { " Baumnummer ": "001", Art: "Eiche", StU: "42.00", Datum: "2024-01-02", "Unbekannte Spalte": " keep " },
    { " Baumnummer ": "002", Art: "Buche", StU: "12.5", Datum: "", "Unbekannte Spalte": "" },
    { " Baumnummer ": "", Art: "", StU: "", Datum: "", "Unbekannte Spalte": "" },
  ]);
});
it("characterizes CSV quoted values and existing numeric coercion", () => {
  expect(readSpreadsheetRows(fixture("trees.csv").toString("utf8"), "csv")).toEqual([
    { Baumnummer: "001", Art: "Eiche", StU: "42", Notiz: "quoted, text" },
    { Baumnummer: "002", Art: "Buche", StU: "12.5", Notiz: "" },
  ]);
});
it("characterizes empty workbook and absent first-sheet name", () => {
  expect(readSpreadsheetRows(fixture("empty.xlsx"), "xlsx")).toEqual([]);
  expect(() => workbookRows({ SheetNames: [], Sheets: {} })).toThrow("no first sheet");
});
it("characterizes declared but missing first sheet as no rows", () => {
  expect(workbookRows({ SheetNames: ["Missing"], Sheets: {} })).toEqual([]);
});
it("rejects corrupt ZIP workbook instead of returning partial rows", () => {
  expect(() => readSpreadsheetRows(Buffer.from([0x50,0x4b,3,4,0xff,0xff]), "xlsx")).toThrow();
});
it("characterizes fleet headers, month/year text and null defaults", () => {
  expect(readFleetSpreadsheet("tests/fixtures/spreadsheets/fleet.xlsx")).toEqual([
    { "Kategorie intern": "LKW", "Marke / Handels-\r\nbezeichnung / Modell": "Synthetic Model", "Kennz.": "E TEST 01", "Erstzul.": "01/2020", HU: "10/26" },
  ]);
});

it("characterizes existing file size/type rejection on upload fixtures", async () => {
  const { validateManagedUpload } = await import("../storage/upload-validation");
  const bytes = fixture("trees.xlsx");
  await expect(validateManagedUpload(new File([new Uint8Array(bytes)], "trees.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "baustelle-documents")).resolves.toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await expect(validateManagedUpload(new File([new Uint8Array(bytes)], "trees.xlsx", { type: "image/png" }), "baustelle-documents")).rejects.toThrow("Declared");
  await expect(validateManagedUpload(new File([new Uint8Array(20_000_001)], "trees.xlsx"), "baustelle-documents")).rejects.toThrow("too_large");
  await expect(validateManagedUpload(new File(["<script>"], "trees.xlsx"), "baustelle-documents")).rejects.toThrow("bytes");
});
