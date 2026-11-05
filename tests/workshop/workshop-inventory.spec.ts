import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetWorkshopFixture, prisma } from "./shared-fixture";
import { DEMO_WORKSPACE_KEY } from "../../src/lib/workshop/shared-store";
import type { WorkshopSnapshot } from "../../src/lib/workshop/shared-contract";
import { createWorkshopDemo } from "../../src/lib/workshop/demo-data";
const api = "/api/demo/baumdienst/workshop";
test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  await context.route("https://nominatim.openstreetmap.org/**", route => route.abort());
});

test("phone inventory → site/worker → workshop → deliberate release → new assignment; desktop sees the same record", async ({ page, browser, request }, info) => {
  const start = await (await request.get(api)).json() as WorkshopSnapshot;
  const worker = start.directory.workers.find(w => w.name === "Jonas Becker")!;
  const site = start.directory.sites.find(s => s.name.includes("Stadtpark"))!;
  const desktop = await browser.newContext({ baseURL: String(info.project.use.baseURL), viewport: { width: 1440, height: 900 } });
  await desktop.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  const other = await desktop.newPage();
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); other.on("pageerror", e => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/demo/baustellen/${site.id}`);
    const scope = page.getByRole("region", { name: "Geräte & Werkzeuge" });
    await scope.getByRole("button", { name: "Gerät zuordnen", exact: true }).click();
    await scope.getByLabel("Verfügbares Gerät").selectOption("blower");
    await scope.getByLabel("Mitarbeiter (optional)").selectOption(worker.key);
    await scope.getByRole("button", { name: "Zuordnen", exact: true }).click();
    await expect(scope).toContainText("Laubbläser · WG-103");
    await other.goto(`/demo/workers/${worker.id}`);
    await expect(other.getByRole("region", { name: "Geräte & Werkzeuge" })).toContainText("Laubbläser · WG-103");
    await page.goto("/demo/workshop?tab=tools");
    const blower = page.locator("article").filter({ has: page.getByRole("heading", { name: "Laubbläser", exact: true }) });
    await blower.getByRole("button", { name: "Details öffnen", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: site.name })).toHaveAttribute("href", `/demo/baustellen/${site.id}`);
    await dialog.getByRole("button", { name: "Defekt melden", exact: true }).click();
    await dialog.getByLabel("Defektbeschreibung").fill("DEMO · Geräusch im Gebläse");
    await dialog.getByRole("button", { name: "In Werkstatt annehmen", exact: true }).click();
    await other.reload();
    await expect(other.getByRole("region", { name: "Geräte & Werkzeuge" })).toContainText("In Werkstatt");
    await page.getByRole("button", { name: "Details öffnen: Laubbläser · WG-103", exact: true }).click();
    await expect(dialog.getByRole("link", { name: site.name })).toBeVisible();
    await dialog.getByRole("button", { name: "Reparatur starten", exact: true }).click();
    await page.getByRole("button", { name: "Details öffnen: Laubbläser · WG-103", exact: true }).click();
    await dialog.getByLabel("Durchgeführte Arbeiten").fill("DEMO · Funktion geprüft");
    await dialog.getByLabel("Funktionsprüfung erfolgreich").check();
    await dialog.getByRole("button", { name: "Reparatur abschließen", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const beforeRelease = await (await request.get(api)).json() as WorkshopSnapshot;
    const denied = await request.post(api, { headers: { Origin: String(info.project.use.baseURL) }, data: { requestId: randomUUID(), revision: beforeRelease.revision, command: { type: "assign", assetId: "blower", siteKey: site.key } } });
    expect(denied.status()).toBe(400);
    await page.getByRole("button", { name: "Details öffnen: Laubbläser · WG-103", exact: true }).click();
    await dialog.getByRole("button", { name: "Für Einsatz freigeben", exact: true }).click();
    await expect(dialog).toContainText("In der gemeinsamen Demo gespeichert.");
    await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await page.goto(`/demo/workshop?tab=tools&asset=blower&detail=1&site=${site.key}`);
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Zuordnen", exact: true }).click();
    await expect(dialog.getByLabel("Baustelle (optional)")).toHaveValue(site.key);
    await dialog.getByRole("button", { name: "Zuordnen", exact: true }).click();
    await page.goto(`/demo/baustellen/${site.id}`);
    await expect(page.getByRole("region", { name: "Geräte & Werkzeuge" })).toContainText("Laubbläser · WG-103");
    await page.screenshot({ path: info.outputPath("site-inventory-phone.png"), fullPage: true });
    const result = await (await request.get(api)).json() as WorkshopSnapshot;
    expect(result.state.assets.filter(a => a.id === "blower")).toHaveLength(1);
    expect(result.state.assets.find(a => a.id === "blower")?.placement?.workerKey).toBeUndefined();
    expect(result.state.jobs.find(j => j.assetId === "blower")?.origin?.placement?.workerKey).toBe(worker.key);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await desktop.close(); }
});

test("barcode/NFC identify the same unit without a mutation and stop listening when closed", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const state = { reader: null as null | { onreading: ((e: unknown) => void) | null }, signals: [] as AbortSignal[] };
    Object.assign(window, { inventoryTestNfc: state, NDEFReader: class {
      onreading = null; onreadingerror = null;
      async scan({ signal }: { signal: AbortSignal }) { state.reader = this; state.signals.push(signal); }
    } });
  });
  await page.goto("/demo/workshop?tab=tools");
  await expect(page.getByRole("button", { name: "Scannen", exact: true })).toBeEnabled();
  expect((await page.getByRole("textbox", { name: "Name, Kennzeichen, Code oder Defekt suchen…" }).boundingBox())!.width).toBeGreaterThan(140);
  expect((await page.getByRole("combobox", { name: "Alle Geräte", exact: true }).boundingBox())!.width).toBeLessThan(145);
  const before = await (await request.get(api)).json() as WorkshopSnapshot;
  await page.getByRole("button", { name: "Scannen", exact: true }).click();
  await page.getByLabel("Barcode / NFC-Code").fill("unknown");
  await page.getByRole("button", { name: "Gerät öffnen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Kein passender");
  await page.getByLabel("Barcode / NFC-Code").fill("WG-102");
  await page.getByRole("button", { name: "Gerät öffnen", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Stangensäge · WG-102");
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Scannen", exact: true }).click();
  await page.getByRole("button", { name: "NFC", exact: true }).click();
  await page.evaluate(() => {
    const w = window as unknown as { inventoryTestNfc: { reader: { onreading: (e: unknown) => void } } };
    w.inventoryTestNfc.reader.onreading({ message: { records: [{ recordType: "text", encoding: "utf-8", data: new TextEncoder().encode("WG-102") }] } });
  });
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Stangensäge · WG-102");
  expect(await page.evaluate(() => (window as unknown as { inventoryTestNfc: { signals: AbortSignal[] } }).inventoryTestNfc.signals.every(s => s.aborted))).toBe(true);
  expect(((await (await request.get(api)).json()) as WorkshopSnapshot).revision).toBe(before.revision);
});

test("concurrent assignments keep one location, retry once and retain the previous placement", async ({ request }, info) => {
  const seed = await (await request.get(api)).json() as WorkshopSnapshot;
  const headers = { Origin: String(info.project.use.baseURL) };
  const [first, second] = seed.directory.sites;
  const one = { requestId: randomUUID(), revision: seed.revision, command: { type: "assign", assetId: "crane", siteKey: first.key } };
  const two = { requestId: randomUUID(), revision: seed.revision, command: { type: "assign", assetId: "crane", siteKey: second.key } };
  const replies = await Promise.all([request.post(api, { headers, data: one }), request.post(api, { headers, data: two })]);
  expect(replies.map(r => r.status()).sort()).toEqual([200, 409]);
  const index = replies.findIndex(r => r.status() === 200), winner = index === 0 ? one : two;
  const committed = await replies[index].json() as WorkshopSnapshot;
  expect((await request.post(api, { headers, data: winner })).status()).toBe(200);
  const current = await (await request.get(api)).json() as WorkshopSnapshot;
  expect(current.revision).toBe(committed.revision);
  expect(current.state.assets.find(a => a.id === "crane")?.events).toHaveLength(1);
  const target = winner.command.siteKey === first.key ? second : first;
  const moved = await request.post(api, { headers, data: { requestId: randomUUID(), revision: current.revision, command: { type: "assign", assetId: "crane", siteKey: target.key } } });
  expect(moved.status()).toBe(200);
  const result = await moved.json() as WorkshopSnapshot, asset = result.state.assets.find(a => a.id === "crane")!;
  expect(asset.placement?.siteKey).toBe(target.key); expect(asset.events[0].kind).toBe("transferred");
  expect(asset.events[0].note).toContain(first.name); expect(asset.events[0].note).toContain(second.name);
});

test("upgrade preserves existing data/files and directory changes invalidate its ETag", async ({ request }, info) => {
  const legacy = { ...createWorkshopDemo(), version: 1 as const };
  await prisma.baumdienstDemoWorkspace.create({ data: { key: DEMO_WORKSPACE_KEY, data: legacy, revision: 17 } });
  const file = await prisma.baumdienstDemoFile.create({ data: { id: randomUUID(), workspaceKey: DEMO_WORKSPACE_KEY, kind: "asset", target: "crane", name: "DEMO-retained.webp", mime: "image/webp", data: Buffer.from("DEMO"), bytes: 4 } });
  const first = await request.get(api), snapshot = await first.json() as WorkshopSnapshot;
  expect(snapshot.revision).toBe(18); expect(snapshot.state.version).toBe(2);
  expect(snapshot.state.jobs).toEqual(legacy.jobs); expect(snapshot.state.parts).toEqual(legacy.parts); expect(snapshot.state.documents).toEqual(legacy.documents);
  expect(await prisma.baumdienstDemoFile.count({ where: { id: file.id } })).toBe(1);
  expect(Buffer.from((await prisma.baumdienstDemoFile.findUniqueOrThrow({ where: { id: file.id } })).data)).toEqual(Buffer.from("DEMO"));
  expect((await request.get(api, { headers: { "If-None-Match": first.headers().etag } })).status()).toBe(304);
  const worker = snapshot.directory.workers.find(w => w.name === "Jonas Becker")!;
  try {
    await prisma.worker.update({ where: { id: worker.id }, data: { availability: "SICK" } });
    const next = await request.get(api, { headers: { "If-None-Match": first.headers().etag } });
    expect(next.status()).toBe(200); expect(next.headers().etag).not.toBe(first.headers().etag);
    expect((await next.json() as WorkshopSnapshot).revision).toBe(18);
    const rejected = await request.post(api, { headers: { Origin: String(info.project.use.baseURL) }, data: { requestId: randomUUID(), revision: 18, command: { type: "assign", assetId: "crane", workerKey: worker.key } } });
    expect(rejected.status()).toBe(400);
    const invalid = await request.post(api, { headers: { Origin: String(info.project.use.baseURL) }, data: { requestId: randomUUID(), revision: 18, command: { type: "assign", assetId: "crane", siteKey: "other-company", placement: { siteName: "Override" } } } });
    expect(invalid.status()).toBe(400);
  } finally { await prisma.worker.update({ where: { id: worker.id }, data: { availability: "AVAILABLE" } }); }
});
