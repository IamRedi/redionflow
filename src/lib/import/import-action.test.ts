import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  company: vi.fn(), authorize: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), transaction: vi.fn(), upload: vi.fn(), finalize: vi.fn(), abort: vi.fn(),
  treeFind: vi.fn(), treeCreate: vi.fn(), treeUpdate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/company", () => ({ getOrCreateDefaultCompany: mocks.company }));
vi.mock("@/lib/auth/authorization", () => ({ getAdminCompanyId: mocks.authorize }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { companyProfile: { findUnique: mocks.company }, baustelle: { findFirst: mocks.find, create: mocks.create, update: mocks.update }, $transaction: mocks.transaction } }));
vi.mock("@/lib/realtime/event-hub", () => ({ notifyRealtimeUpdate: vi.fn() }));
vi.mock("@/lib/storage/object-storage", () => ({ planPendingImport: (_companyId: string, entityId: string) => ({ entityId }), pendingImportReferences: () => ["synthetic-document"], uploadPendingImport: mocks.upload, finalizePendingImport: mocks.finalize, abortPendingImport: mocks.abort }));
import { importProjectData } from "@/app/(admin)/app/baustellen/import/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue("synthetic-company");
  mocks.company.mockResolvedValue({ id: "synthetic-company" });
  mocks.find.mockResolvedValue(null);
  mocks.create.mockImplementation(async ({ data }) => ({ id: data.id }));
  mocks.upload.mockResolvedValue("synthetic-document");
  mocks.treeFind.mockResolvedValue([]);
  mocks.treeCreate.mockImplementation(async ({ data }) => ({ id: `synthetic-${data.treeId}`, ...data }));
  mocks.transaction.mockImplementation(async fn => fn({ baustelle: { create: mocks.create, update: mocks.update, findFirst: async () => ({ documents: [] }) }, treeItem: { findMany: mocks.treeFind, create: mocks.treeCreate, update: mocks.treeUpdate } }));
});
function form(name: string, type: string, bytes: Buffer | string) {
  const data = new FormData(); data.set("lang", "en"); data.set("dataFile", new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], name, { type })); return data;
}
it.each(["xlsx", "xls", "csv"])("characterizes actual action valid %s import values and blank filtering", async ext => {
  const mime = ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ext === "xls" ? "application/vnd.ms-excel" : "text/csv";
  const result = await importProjectData(form(`trees.${ext}`, mime, readFileSync(`tests/fixtures/spreadsheets/trees.${ext}`)));
  expect(result).toMatchObject({ ok: true, importedCount: 2, baustelleId: expect.any(String) });
  expect(result).toMatchObject({ baustelleId: mocks.create.mock.calls[0][0].data.id });
  expect(mocks.upload.mock.calls[0][0].entityId).toBe(mocks.create.mock.calls[0][0].data.id);
  expect(mocks.treeCreate.mock.calls.map(([call]) => call.data)).toMatchObject([
    { treeId: "001", species: "Eiche", diameter: 42 }, { treeId: "002", species: "Buche", diameter: 13 },
  ]);
});
it.each(["empty.xlsx", "corrupt.xlsx"])("malformed/empty %s refuses before company/site/tree mutation", async name => {
  const bytes = name === "empty.xlsx" ? readFileSync("tests/fixtures/spreadsheets/empty.xlsx") : Buffer.from([0x50,0x4b,3,4,0xff,0xff]);
  expect(await importProjectData(form(name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes))).toMatchObject({ ok: false });
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
});
it("unsupported file extension refuses without writes", async () => {
  expect(await importProjectData(form("trees.exe", "application/octet-stream", "Baumnummer,Art\n001,Eiche"))).toMatchObject({ ok: false });
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
});

it.each([
  { label: "wrong MIME", name: "trees.xlsx", type: "image/png", bytes: () => readFileSync("tests/fixtures/spreadsheets/trees.xlsx") },
  { label: "disguised HTML", name: "trees.xlsx", type: "", bytes: () => Buffer.from("<html><script>alert(1)</script></html>") },
  { label: "oversized upload", name: "trees.xlsx", type: "", bytes: () => Buffer.alloc(20_000_001) },
  { label: "expanded ZIP budget", name: "trees.xlsx", type: "", bytes: () => {
    const bytes = readFileSync("tests/fixtures/spreadsheets/trees.xlsx");
    const directory = bytes.indexOf(Buffer.from([0x50,0x4b,1,2])); bytes.writeUInt32LE(64_000_001, directory + 24); return bytes;
  } },
])("$label refuses before any company/site/tree/storage mutation", async ({ name, type, bytes }) => {
  expect(await importProjectData(form(name, type, bytes()))).toMatchObject({ ok: false });
  for (const mutation of [mocks.company, mocks.create, mocks.update, mocks.transaction, mocks.upload, mocks.treeCreate, mocks.treeUpdate]) expect(mutation).not.toHaveBeenCalled();
});
it("a second invalid document cannot partially create a site from the valid first spreadsheet", async () => {
  const data = form("trees.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", readFileSync("tests/fixtures/spreadsheets/trees.xlsx"));
  data.set("kmlFile", new File(["not XML"], "data.kml", { type: "application/vnd.google-earth.kml+xml" }));
  expect(await importProjectData(data)).toMatchObject({ ok: false });
  expect(mocks.company).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
});
it("unauthorized callers never enter spreadsheet parsing", async () => {
  mocks.authorize.mockResolvedValue(null);
  const data = form("corrupt.xlsx", "", Buffer.from([0x50,0x4b,3,4,0xff]));
  expect(await importProjectData(data)).toMatchObject({ ok: false });
  expect(mocks.company).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
});

it("CRC-valid container with an incomplete worksheet cannot partially import rows", async () => {
  const zip = XLSX.CFB.read(readFileSync("tests/fixtures/spreadsheets/trees.xlsx"), { type: "buffer" });
  const sheet = zip.FileIndex[zip.FullPaths.findIndex((path: string) => path.endsWith("xl/worksheets/sheet1.xml"))];
  sheet.content = Buffer.from(Buffer.from(sheet.content).toString("utf8").replace("</worksheet>", ""));
  sheet.size = sheet.content.length;
  const bytes: Buffer = XLSX.CFB.write(zip, { type: "buffer", fileType: "zip" });
  expect(await importProjectData(form("malformed.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes))).toMatchObject({ ok: false });
  for (const mutation of [mocks.company, mocks.create, mocks.update, mocks.transaction, mocks.upload, mocks.treeCreate, mocks.treeUpdate]) expect(mutation).not.toHaveBeenCalled();
});
