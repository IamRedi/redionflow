import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { expect, it } from "vitest";
import { validateXlsxContainer } from "./spreadsheet-container";
import { readSpreadsheetRows, workbookRows } from "./spreadsheet";
import { readFleetSpreadsheet } from "../../../scripts/lib/fleet-parser";

const fixture = () => readFileSync("tests/fixtures/spreadsheets/trees.xlsx");
it("accepts normal real XLSX container without writing/extracting files", () => {
  expect(() => validateXlsxContainer(fixture())).not.toThrow();
});
it.each(["directory size", "zip64 size", "encryption", "wrong local header", "invalid central header", "entry expansion lie", "local allocation lie"])("rejects corrupt container: %s", kind => {
  const bytes = fixture(); const start = bytes.indexOf(Buffer.from([0x50,0x4b,1,2])); const end = bytes.lastIndexOf(Buffer.from([0x50,0x4b,5,6]));
  if (kind === "directory size") bytes.writeUInt32LE(1, end + 12);
  if (kind === "zip64 size") bytes.writeUInt32LE(0xffffffff, start + 24);
  if (kind === "encryption") bytes.writeUInt16LE(1, start + 8);
  if (kind === "wrong local header") bytes.writeUInt32LE(0, bytes.readUInt32LE(start + 42));
  if (kind === "invalid central header") { const second = start + 46 + bytes.readUInt16LE(start + 28) + bytes.readUInt16LE(start + 30) + bytes.readUInt16LE(start + 32); bytes.writeUInt32LE(0, second); }
  if (kind === "entry expansion lie") bytes.writeUInt32LE(1, start + 24);
  if (kind === "local allocation lie") bytes.writeUInt32LE(0x7fffffff, bytes.readUInt32LE(start + 42) + 22);
  expect(() => validateXlsxContainer(bytes)).toThrow("spreadsheet container");
});
it.each(["A1:A100001", "A1:SS1", "A1:GS10000"])("refuses excessive worksheet dimensions %s before generating rows", ref => {
  expect(() => workbookRows({ SheetNames: ["Data"], Sheets: { Data: { "!ref": ref } } })).toThrow("dimensions");
});
it("isolated real fleet parser preserves XLSX header/date values", () => {
  expect(readFleetSpreadsheet("tests/fixtures/spreadsheets/fleet.xlsx")[0]).toMatchObject({ "Kennz.": "E TEST 01", HU: "10/26", "Erstzul.": "01/2020" });
});
it("fleet parser refuses unsupported extension before reading the path", () => {
  expect(() => readFleetSpreadsheet("tests/fixtures/spreadsheets/trees.csv.exe")).toThrow("Unsupported");
});
it("real fleet parser rejects corrupt XLSX without returning partial rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "baumkalk-fleet-parser-"));
  try {
    const path = join(dir, "corrupt.xlsx");
    writeFileSync(path, Buffer.from([0x50,0x4b,3,4,0xff]));
    expect(() => readFleetSpreadsheet(path)).toThrow("spreadsheet container");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it("accepts ordinary compressed XLSX and checks its real inflated bytes", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Art"], ["Eiche"]]), "Data");
  const bytes: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  expect(readSpreadsheetRows(bytes, "xlsx")).toEqual([{ Art: "Eiche" }]);
  const central = bytes.indexOf(Buffer.from([0x50,0x4b,1,2]));
  bytes.writeUInt32LE((bytes.readUInt32LE(central + 16) ^ 1) >>> 0, central + 16);
  expect(() => validateXlsxContainer(bytes)).toThrow("spreadsheet container");
});

it("refuses ZIP64 central extras even when normal directory sizes hide the override", () => {
  const original = fixture();
  const central = original.indexOf(Buffer.from([0x50,0x4b,1,2]));
  const extraStart = central + 46 + original.readUInt16LE(central + 28);
  const extra = Buffer.alloc(12); extra.writeUInt16LE(1, 0); extra.writeUInt16LE(8, 2); extra.writeBigUInt64LE(0x7fffffffn, 4);
  const bytes = Buffer.concat([original.subarray(0, extraStart), extra, original.subarray(extraStart)]);
  bytes.writeUInt16LE(original.readUInt16LE(central + 30) + extra.length, central + 30);
  const end = bytes.lastIndexOf(Buffer.from([0x50,0x4b,5,6]));
  bytes.writeUInt32LE(bytes.readUInt32LE(end + 12) + extra.length, end + 12);
  expect(() => validateXlsxContainer(bytes)).toThrow("spreadsheet container");
});

it.each(["xls", "csv"] as const)("fleet parser refuses XLSX renamed to %s before returning rows", format => {
  const dir = mkdtempSync(join(tmpdir(), "baumkalk-fleet-type-"));
  try {
    const path = join(dir, `disguised.${format}`);
    writeFileSync(path, fixture());
    expect(() => readFleetSpreadsheet(path)).toThrow("declared type");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it("binary XLS declared as XLSX is refused before ZIP or SheetJS parsing", () => {
  expect(() => readSpreadsheetRows(readFileSync("tests/fixtures/spreadsheets/trees.xls"), "xlsx")).toThrow("declared type");
});
it.each([[0x50,0x4b,5,6], [0x50,0x4b,7,8]].map(prefix => ({ prefix })))("CSV also rejects SheetJS alternate ZIP prefix $prefix", ({ prefix }) => {
  expect(() => readSpreadsheetRows(Buffer.from(prefix).toString("utf8"), "csv")).toThrow("declared type");
});
