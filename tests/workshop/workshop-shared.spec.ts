import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { resetWorkshopFixture, prisma } from "./shared-fixture";
import { DEMO_WORKSPACE_KEY, demoSiteKey } from "../../src/lib/workshop/shared-store";

const api = "/api/demo/baumdienst/workshop", files = "/api/demo/baumdienst/files";
test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  await context.route("https://nominatim.openstreetmap.org/**", route => route.abort());
});

test("two independent browsers share repairs, photos and documents without browser storage", async ({ page, browser }, info) => {
  const baseURL = String(info.project.use.baseURL);
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  await phone.addCookies([{ name: "bk_lang", value: "de", url: baseURL }]);
  const mobile = await phone.newPage();
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); mobile.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto("/demo/workshop"); await mobile.goto("/demo/workshop");
    await expect(page.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
    await expect(mobile.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Defekt melden", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Gerät / Fahrzeug", { exact: true }).selectOption("crane");
    await dialog.getByLabel("Defektbeschreibung").fill("DEMO · Geräteübergreifender Test");
    await dialog.getByRole("button", { name: "In Werkstatt annehmen", exact: true }).click();
    await expect(mobile.getByText("DEMO · Geräteübergreifender Test", { exact: true })).toBeVisible({ timeout: 15000 });
    await mobile.getByRole("button", { name: "Details öffnen: Kran-LKW · MU-BD 401", exact: true }).click();
    await mobile.getByRole("dialog").getByRole("button", { name: "Reparatur starten", exact: true }).click();
    await expect(page.getByTestId("workshop-demo")).toHaveAttribute("data-revision", "2", { timeout: 15000 });
    await page.getByRole("button", { name: "Details öffnen: Kran-LKW · MU-BD 401", exact: true }).click();
    await dialog.getByLabel("Ersatzteile", { exact: true }).selectOption("hydraulic");
    await dialog.getByRole("button", { name: "Teil verwenden", exact: true }).click();
    await expect(dialog.getByText("48,00", { exact: false }).first()).toBeVisible();
    await dialog.getByRole("button", { name: "Fotos: Kran-LKW", exact: true }).click();
    const photo = await sharp({ create: { width: 1400, height: 800, channels: 3, background: "#b4cdb8" } }).png().toBuffer();
    await page.getByRole("dialog").last().locator('input[data-photo-input="upload"]').setInputFiles({ name: "DEMO-Foto.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByRole("dialog").last().locator("figcaption").filter({ hasText: "DEMO-Foto.webp" })).toBeVisible();
    const photoDownload = page.waitForEvent("download");
    await page.getByRole("dialog").last().getByRole("link", { name: "Herunterladen", exact: true }).click();
    const photoBytes = await readFile((await (await photoDownload).path())!);
    expect((await sharp(photoBytes).metadata()).format).toBe("webp");
    await page.getByRole("dialog").last().getByRole("button", { name: "Schließen", exact: true }).click();
    const document = Buffer.from("DEMO · Gemeinsamer Reparaturnachweis, keine echten Daten.");
    await dialog.getByLabel("Beispieldokument hinzufügen", { exact: true }).setInputFiles({ name: "DEMO-Gemeinsam.txt", mimeType: "text/plain", buffer: document });
    await expect(dialog.locator("span.break-all").filter({ hasText: "DEMO-Gemeinsam.txt" })).toBeVisible();
    await dialog.getByLabel("Durchgeführte Arbeiten", { exact: true }).fill("DEMO · Teil ersetzt und erfolgreich geprüft.");
    await dialog.getByLabel("Funktionsprüfung erfolgreich", { exact: true }).check();
    await dialog.getByRole("button", { name: "Reparatur abschließen", exact: true }).click();
    await mobile.reload();
    await mobile.getByRole("button", { name: "Details öffnen: Kran-LKW · MU-BD 401", exact: true }).click();
    const md = mobile.getByRole("dialog");
    await expect(md.locator("span.break-all").filter({ hasText: "DEMO-Gemeinsam.txt" })).toBeVisible();
    await expect(md.locator('img[src^="/api/demo/baumdienst/files/"]')).toHaveCount(1);
    await expect.poll(() => md.locator('img[src^="/api/demo/baumdienst/files/"]').evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await md.getByRole("button", { name: "Für Einsatz freigeben", exact: true }).click();
    await expect(md.getByText("In der gemeinsamen Demo gespeichert.", { exact: true })).toBeVisible();
    const link = await md.getByRole("link", { name: "Herunterladen", exact: true }).getAttribute("href");
    const downloaded = await mobile.request.get(link!); expect(await downloaded.body()).toEqual(document);
    await md.getByRole("button", { name: "Schließen", exact: true }).click();
    await mobile.screenshot({ path: info.outputPath("shared-phone.png") });
    expect(await mobile.evaluate(() => localStorage.getItem("redionflow:baumdienst:workshop-demo:v1"))).toBeNull();
    await page.reload();
    const response = await page.request.get(api), snapshot = await response.json();
    expect(snapshot.state.jobs.find((j: { assetId: string }) => j.assetId === "crane").releasedAt).toBeTruthy();
    expect(snapshot.state.parts.find((p: { id: string }) => p.id === "hydraulic").stock).toBe(2);
    expect(snapshot.state.movements).toHaveLength(1);
    expect(snapshot.state.documents.find((d: { name: string }) => d.name === "DEMO-Gemeinsam.txt").data).toBeUndefined();
    expect(errors).toEqual([]);
  } finally { await phone.close(); }
});

test("stock writes serialize across clients and receipt retries never double-book", async ({ request }, info) => {
  const headers = { Origin: String(info.project.use.baseURL) };
  const first = await request.get(api); const seed = await first.json();
  expect((await (await request.get(api)).json()).updatedAt).toBe(seed.updatedAt);
  expect(first.headers()["cache-control"]).toContain("no-store");
  expect((await request.get(api, { headers: { "If-None-Match": first.headers().etag } })).status()).toBe(304);
  const command = { type: "part", partId: "hydraulic", jobId: "WS-101", qty: 2 };
  const a = { requestId: randomUUID(), revision: seed.revision, command }, b = { ...a, requestId: randomUUID() };
  const replies = await Promise.all([request.post(api, { headers, data: a }), request.post(api, { headers, data: b })]);
  expect(replies.map(r => r.status()).sort()).toEqual([200, 409]);
  const winner = replies[0].ok() ? a : b;
  const retry = await request.post(api, { headers, data: winner }); expect(retry.status()).toBe(200);
  const snapshot = await retry.json();
  expect(snapshot.revision).toBe(1); expect(snapshot.state.movements).toHaveLength(1);
  expect(snapshot.state.parts.find((p: { id: string }) => p.id === "hydraulic").stock).toBe(1);
  const changedReceipt = await request.post(api, { headers, data: { ...winner, command: { ...command, qty: 1 } } }); expect(changedReceipt.status()).toBe(409);
  const underflow = await request.post(api, { headers, data: { ...a, requestId: randomUUID(), revision: 1 } }); expect(underflow.status()).toBe(400);
  expect((await underflow.json()).error).toBe("stock");
});

test("a lost response body retries its original receipt and confirms only one stock movement", async ({ page }) => {
  await page.goto("/demo/workshop?tab=parts");
  let posts = 0;
  await page.route(`**${api}`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    if (posts === 1) { const response = await route.fetch(); expect(response.status()).toBe(200); await route.fulfill({ status: 200, contentType: "application/json", body: "{" }); }
    else await route.continue();
  });
  const chain = page.locator("article").filter({ has: page.getByRole("heading", { name: "Sägekette", exact: true }) });
  await chain.getByRole("button", { name: "Bestand auffüllen", exact: true }).click();
  await expect(page.getByText("In der gemeinsamen Demo gespeichert.", { exact: true })).toBeVisible();
  expect(posts).toBe(2);
  const snapshot = await (await page.request.get(api)).json();
  expect(snapshot.state.parts.find((p: { id: string }) => p.id === "chain").stock).toBe(3);
  expect(snapshot.state.movements).toHaveLength(1);
});

test("uploads are bounded, decoded, cross-device downloadable and retained across base reset", async ({ request }, info) => {
  const headers = { Origin: String(info.project.use.baseURL) };
  const seed = await (await request.get(api)).json();
  const photo = await sharp({ create: { width: 1800, height: 1100, channels: 3, background: "#acb9ad" } }).withMetadata({ exif: { IFD0: { Artist: "DEMO metadata to remove" } } }).jpeg().toBuffer();
  const site = await prisma.baustelle.findFirstOrThrow({ select: { id: true, name: true, address: true } });
  const fields = { requestId: randomUUID(), revision: String(seed.revision), kind: "site", target: site.id };
  const uploaded = await request.post(files, { headers, multipart: { ...fields, file: { name: "DEMO-Baustelle.jpg", mimeType: "image/jpeg", buffer: photo } } });
  expect(uploaded.status()).toBe(200); const snapshot = await uploaded.json();
  const file = snapshot.photos[0]; expect(file.target).toBe(demoSiteKey(site));
  const media = await request.get(file.url); expect(media.status()).toBe(200); expect(media.headers()["content-type"]).toBe("image/webp");
  const bytes = await media.body(), meta = await sharp(bytes).metadata();
  expect(bytes.length).toBeLessThanOrEqual(180000); expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1024); expect(meta.exif).toBeUndefined();
  const duplicate = await request.post(files, { headers, multipart: { ...fields, file: { name: "DEMO-Baustelle.jpg", mimeType: "image/jpeg", buffer: photo } } });
  expect(duplicate.status()).toBe(200); expect((await duplicate.json()).photos).toHaveLength(1);
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('TRUNCATE TABLE "CompanyProfile" CASCADE');
    expect(await tx.baumdienstDemoWorkspace.count({ where: { key: DEMO_WORKSPACE_KEY } })).toBe(1);
    expect(await tx.baumdienstDemoFile.count({ where: { id: file.id } })).toBe(1);
    throw new Error("ROLLBACK_FIXTURE_RESET_PROBE");
  }, { timeout: 15000, maxWait: 10000 }).catch(error => { if (!(error instanceof Error) || error.message !== "ROLLBACK_FIXTURE_RESET_PROBE") throw error; });
  expect((await request.get(file.url)).status()).toBe(200);
  expect((await (await request.get(api)).json()).photos).toHaveLength(1);
  const invalid = await request.post(files, { headers, multipart: { ...fields, requestId: randomUUID(), revision: "1", kind: "asset", target: "crane", file: { name: "disguised.jpg", mimeType: "image/jpeg", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>bad</script></svg>') } } });
  expect(invalid.status()).toBe(400);
  const foreign = await request.post(files, { headers, multipart: { ...fields, requestId: randomUUID(), revision: "1", target: "not-owned", file: { name: "DEMO.jpg", mimeType: "image/jpeg", buffer: photo } } });
  expect(foreign.status()).toBe(404);
  expect(await prisma.baumdienstDemoFile.count({ where: { workspaceKey: DEMO_WORKSPACE_KEY } })).toBe(1);
});

test("write requests fail closed for cross-origin, overrides, invalid revisions and oversized payloads", async ({ request }, info) => {
  await request.get(api);
  const body = { requestId: randomUUID(), revision: 0, command: { type: "restock", partId: "chain", qty: 1 } };
  expect((await request.post(api, { data: body })).status()).toBe(403);
  expect((await request.post(api, { headers: { Origin: "https://unrelated.example" }, data: body })).status()).toBe(403);
  const headers = { Origin: String(info.project.use.baseURL) };
  expect((await request.post(api, { headers, data: { ...body, companyProfileId: "other" } })).status()).toBe(400);
  expect((await request.post(api, { headers, data: { ...body, revision: 123 } })).status()).toBe(409);
  expect((await request.post(api, { headers, data: { ...body, padding: "x".repeat(15000) } })).status()).toBe(413);
  expect((await request.put(api, { headers, data: { state: {} } })).status()).toBe(405);
  expect((await request.get(`${files}/00000000-0000-4000-8000-000000000000`)).status()).toBe(404);
  expect((await (await request.get(api)).json()).revision).toBe(0);
});

test("oversized multipart files fail without retaining upload slots or partial records", async ({ request }, info) => {
  const seed = await (await request.get(api)).json();
  const headers = { Origin: String(info.project.use.baseURL) };
  for (let i = 0; i < 3; i++) {
    const rejected = await request.post(files, { headers, multipart: { requestId: randomUUID(), revision: String(seed.revision), kind: "document", target: "crane", file: { name: "DEMO-too-large.txt", mimeType: "text/plain", buffer: Buffer.alloc(1_000_001, "x") } } });
    expect(rejected.status()).toBe(413);
  }
  expect(await prisma.baumdienstDemoFile.count({ where: { workspaceKey: DEMO_WORKSPACE_KEY } })).toBe(0);
  const valid = await request.post(files, { headers, multipart: { requestId: randomUUID(), revision: String(seed.revision), kind: "document", target: "crane", file: { name: "DEMO-valid-after-rejection.txt", mimeType: "text/plain", buffer: Buffer.from("DEMO · Valid sample") } } });
  expect(valid.status()).toBe(200);
  expect(await prisma.baumdienstDemoFile.count({ where: { workspaceKey: DEMO_WORKSPACE_KEY } })).toBe(1);
});

test("long Unicode file names remain safely downloadable", async ({ request }, info) => {
  const seed = await (await request.get(api)).json();
  const response = await request.post(files, { headers: { Origin: String(info.project.use.baseURL) }, multipart: { requestId: randomUUID(), revision: String(seed.revision), kind: "document", target: "crane", file: { name: `${"a".repeat(119)}🌳.txt`, mimeType: "text/plain", buffer: Buffer.from("DEMO unicode filename") } } });
  expect(response.status()).toBe(200);
  const snapshot = await response.json(), document = snapshot.state.documents.find((d: { assetId: string }) => d.assetId === "crane");
  const result = await request.get(`${files}/${document.fileId}`);
  expect(result.status()).toBe(200); expect(await result.text()).toBe("DEMO unicode filename");
  expect(result.headers()["content-disposition"]).toContain("filename*=UTF-8''");
});
