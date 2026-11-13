import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";
import { prisma, resetWorkshopFixture } from "./shared-fixture";

const api = "/api/demo/baumdienst/offices", key = "baumdienst-offices:v1";
async function snapshot(r: APIRequestContext, query = "") { const reply = await r.get(api + query); expect(reply.status()).toBe(200); return reply.json(); }
async function role(r: APIRequestContext, origin: string, value: string) { expect((await r.post(api + "/actor", { headers: { Origin: origin }, data: { role: value } })).status()).toBe(200); }
async function command(r: APIRequestContext, origin: string, value: unknown) {
  const s = await snapshot(r), data = { requestId: randomUUID(), revision: s.revision, command: value };
  return { response: await r.post(api, { headers: { Origin: origin }, data }), data };
}
async function clearOffice() {
  // Called only after resetWorkshopFixture's exact disposable host/database/company guard.
  await prisma.baumdienstDemoWorkspace.deleteMany({ where: { key } });
  await prisma.baustelle.deleteMany({ where: { id: { startsWith: "bdf-office-" } } });
}
test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture(); await clearOffice();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", r => r.abort());
});
test.afterEach(async () => { await clearOffice(); });

test("private office originals become explicit worksite links without duplication; roles and retries stay separated", async ({ request, browser, page }, info) => {
  const origin = String(info.project.use.baseURL);
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  await role(request, origin, "finance");
  const folder = await command(request, origin, { type: "folder", name: "DEMO · Personal" }); expect(folder.response.status()).toBe(200);
  expect((await command(request, origin, { type: "folder", name: "demo · personal" })).response.status()).toBe(409);
  const task = await command(request, origin, { type: "task", title: "DEMO · private payroll note", text: "fictional office note" }); expect(task.response.status()).toBe(200);
  const fileId = randomUUID(), bytes = Buffer.from("DEMO fictional archive original\n");
  const upload = async (id: string, revision: number) => request.post(api + "/files", { headers: { Origin: origin }, multipart: { requestId: id, revision: String(revision), folderId: folder.data.requestId, shared: "false", file: { name: "DEMO-office.txt", mimeType: "text/plain", buffer: bytes } } });
  const revision = (await snapshot(request)).revision;
  expect((await upload(fileId, revision)).status()).toBe(200);
  expect((await upload(fileId, revision)).status()).toBe(200);
  expect((await upload(randomUUID(), (await snapshot(request)).revision)).status()).toBe(409);
  const own = await snapshot(request); expect(own.files.map((f: { id: string }) => f.id)).toEqual([fileId]);
  expect(own.tasks).toHaveLength(1);
  const original = await request.get(own.files[0].url); expect(await original.body()).toEqual(bytes);
  await role(request, origin, "manager");
  const boss = await snapshot(request); expect(boss.tasks).toHaveLength(0); expect(boss.files).toHaveLength(0);
  expect((await request.get(api + "/files/" + fileId)).status()).toBe(403);
  const visitor = await snapshot(request, "?room=finance"); expect(visitor.own).toBe(false); expect(visitor.workers).toHaveLength(0); expect(visitor.documents).toHaveLength(0);
  expect((await request.post(api, { headers: { Origin: "https://other.invalid" }, data: folder.data })).status()).toBe(403);
  expect((await request.post(api, { headers: { Origin: origin }, data: { ...folder.data, actor: "finance" } })).status()).toBe(400);
  await role(request, origin, "operations");
  expect((await snapshot(request)).workers).toHaveLength(0);
  const privateSite = { type: "site", name: "DEMO · archive site", address: "Musterweg 1", description: "fictional", method: "CLIMBING", fileIds: [fileId], shareWithSite: true };
  expect((await command(request, origin, privateSite)).response.status()).toBe(403);
  await role(request, origin, "finance");
  expect((await command(request, origin, privateSite)).response.status()).toBe(403);
  // An explicitly shared second document is available to operations; the private original stays private.
  const sharedId = randomUUID();
  expect((await request.post(api + "/files", { headers: { Origin: origin }, multipart: { requestId: sharedId, revision: String((await snapshot(request)).revision), shared: "true", file: { name: "DEMO-site.txt", mimeType: "text/plain", buffer: bytes } } })).status()).toBe(200);
  await role(request, origin, "reception");
  const inquiry = await command(request, origin, { type: "inquiry", client: "DEMO Musterkunde", contact: "", address: "Musterweg 1", description: "Baumpflege" }); expect(inquiry.response.status()).toBe(200);
  await role(request, origin, "operations");
  const siteCommand = { ...privateSite, fileIds: [sharedId], inquiryId: inquiry.data.requestId };
  expect((await command(request, origin, { ...siteCommand, shareWithSite: false })).response.status()).toBe(400);
  const site = await command(request, origin, siteCommand); expect(site.response.status()).toBe(200);
  const result = await site.response.json(); expect(result.ref).toMatch(/^bdf-office-/);
  const replay = await request.post(api, { headers: { Origin: origin }, data: site.data }); expect((await replay.json()).replay).toBe(true);
  expect((await request.post(api, { headers: { Origin: origin }, data: { ...site.data, command: { ...siteCommand, name: "changed" } } })).status()).toBe(409);
  expect((await command(request, origin, siteCommand)).response.status()).toBe(409);
  expect(await prisma.baumdienstDemoFile.count({ where: { workspaceKey: key } })).toBe(2);
  const workerContext = await browser.newContext({ baseURL: origin });
  try {
    expect((await workerContext.request.post("/api/demo/baumdienst/actor", { headers: { Origin: origin }, data: { key: before.directory.workers[0].key } })).status()).toBe(200);
    expect((await workerContext.request.get(api)).status()).toBe(403);
    expect((await workerContext.request.post(api + "/actor", { headers: { Origin: origin }, data: { role: "manager" } })).status()).toBe(403);
    expect((await workerContext.request.get(api + "/files/" + sharedId)).status()).toBe(403);
    const linked = await workerContext.request.get(`${api}/files/${sharedId}?site=${result.ref}`); expect(linked.status()).toBe(200);
    expect(createHash("sha256").update(await linked.body()).digest("hex")).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect((await workerContext.request.get(`${api}/files/${fileId}?site=${result.ref}`)).status()).toBe(403);
  } finally { await workerContext.close(); }
  await role(request, origin, "finance");
  expect((await command(request, origin, { type: "archive", kind: "document", id: sharedId, archived: true })).response.status()).toBe(200);
  expect((await request.get(`${api}/files/${sharedId}?site=${result.ref}`)).status()).toBe(200);
  await page.goto(`/demo/baustellen/${result.ref}`); await page.locator("summary").filter({ hasText: "Ordner & Archiv" }).click();
  await expect(page.getByRole("link", { name: "DEMO-site.txt", exact: true })).toHaveAttribute("href", `${api}/files/${sharedId}?site=${result.ref}`);
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json(); expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision);
});

test("finance reads canonical hours; saved calculator drafts and newly created sites survive reload and base resets", async ({ request, browser, page }, info) => {
  const origin = String(info.project.use.baseURL), worker = await prisma.worker.findFirstOrThrow();
  const session = await prisma.workSession.create({ data: { workerId: worker.id, startTime: new Date("2001-01-12T07:00:00Z"), endTime: new Date("2001-01-12T15:30:00Z"), breakMinutes: 30, totalHours: 8 } });
  try {
    await role(request, origin, "finance"); const finance = await snapshot(request, "?month=2001-01");
    const w = finance.workers.find((w: { id: string }) => w.id === worker.id); expect(w.hours).toBe(8); expect(w.sessionCount).toBe(1); expect(w.provisional).toBe(false);
    expect((await snapshot(request, "?month=2001-02")).workers.find((w: { id: string }) => w.id === worker.id).hours).toBe(0);
    await role(page.context().request, origin, "finance"); await page.goto("/demo/offices/finance"); await page.getByRole("button", { name: "Im Büro arbeiten", exact: true }).click(); await page.getByRole("button", { name: "Personal & Stunden", exact: true }).click();
    const d = page.getByRole("dialog"); await d.getByLabel("Berichtsmonat", { exact: true }).fill("2001-01");
    await expect(d.getByRole("link", { name: `${worker.firstName} ${worker.lastName}`, exact: true })).toHaveAttribute("href", `/demo/workers/${worker.id}`);
    await expect(d.locator("article").filter({ has: page.getByRole("link", { name: `${worker.firstName} ${worker.lastName}`, exact: true }) })).toContainText("8 h");
    const quote = { type: "quote", quote: { title: "DEMO · Baumpflege", client: "DEMO Kunde", laborCents: 10000, machineCents: 0, materialCents: 0, externalCents: 0, overhead: { bgkPct: 0, agkPct: 0, riskPct: 0, profitPct: .1, vatPct: .19, bgkBase: "EK_TOTAL", riskProfitMode: "SEPARATE", applyVatByDefault: true } } };
    expect((await command(request, origin, quote)).response.status()).toBe(403);
    await role(request, origin, "clients"); expect((await command(request, origin, quote)).response.status()).toBe(200);
    const client = await snapshot(request); expect(client.quotes[0].totals.offer.grossCents).toBe(13090); expect(client.workers).toHaveLength(0);
    await role(request, origin, "operations"); expect((await snapshot(request)).quotes).toHaveLength(0);
    const site = await command(request, origin, { type: "site", name: "DEMO · durable site", address: "Musterweg 2", description: "saved source", method: "TRUCK_CRANE", fileIds: [], shareWithSite: false }); expect(site.response.status()).toBe(200); const { ref } = await site.response.json();
    await prisma.baustelle.update({ where: { id: ref }, data: { description: "existing edit wins" } });
    await snapshot(request); expect((await prisma.baustelle.findUniqueOrThrow({ where: { id: ref } })).description).toBe("existing edit wins");
    await prisma.baustelle.delete({ where: { id: ref } }); await snapshot(request);
    const restored = await prisma.baustelle.findUniqueOrThrow({ where: { id: ref } }); expect(restored.name).toBe("DEMO · durable site"); expect(restored.type).toBe("TRUCK_CRANE");
    const phone = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
    try { await role(phone.request, origin, "clients"); const saved = await snapshot(phone.request); expect(saved.quotes[0].totals.offer.grossCents).toBe(13090); expect(saved.sites.some((s: { id: string }) => s.id === ref)).toBe(true); }
    finally { await phone.close(); }
    expect(await prisma.workSession.findUnique({ where: { id: session.id } })).not.toBeNull();
  } finally { await prisma.workSession.delete({ where: { id: session.id } }); }
});

test("compact inventory and 2.5D Day/Night offices preserve physical controls, private visits and settings footer", async ({ page, context, request }, info) => {
  const origin = String(info.project.use.baseURL), errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  for (const theme of ["light", "dark"]) for (const [width, height] of [[1440, 900], [390, 844], [320, 700], [740, 360]]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: origin }]); await page.setViewportSize({ width, height });
    await page.goto("/demo/workshop?tab=tools"); await expect(page.getByRole("button", { name: "Gerät erfassen", exact: true })).toBeEnabled();
    const cards = page.getByTestId("inventory-asset-card"); expect(await cards.count()).toBeGreaterThanOrEqual(2);
    const allCards = page.locator('[data-testid="inventory-asset-card"], [data-testid="fleet-asset-card"]');
    await expect(allCards).toHaveCount(before.state.assets.length);
    await expect.poll(async () => Math.abs((await allCards.nth(0).boundingBox())!.y - (await allCards.nth(1).boundingBox())!.y)).toBeLessThan(2);
    const a = (await allCards.nth(0).boundingBox())!, b = (await allCards.nth(1).boundingBox())!;
    expect(a.width).toBeLessThanOrEqual(221); expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect((await cards.nth(0).boundingBox())!.width).toBeLessThanOrEqual(221);
    await cards.nth(0).getByRole("button", { name: "Details öffnen", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await page.keyboard.press("Escape");
    await page.screenshot({ path: info.outputPath(`inventory-compact-${theme}-${width}.png`) });
    await page.goto("/demo/offices"); await expect(page.getByTestId("office-reception-scene")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Demo", exact: true })).toHaveCount(0);
    const reception = page.getByTestId("office-reception-scene");
    expect(await reception.locator("[aria-hidden=true]").first().evaluate(el => getComputedStyle(el).backgroundImage)).toContain(`office-reception-${theme === "light" ? "day" : "night"}.webp`);
    await expect(page.locator("[data-office-door]")).toHaveCount(4);
    await page.getByRole("button", { name: "Büroeinstellungen", exact: true }).click();
    const select = page.getByLabel("Fiktive Rolle ausprobieren", { exact: true }); await select.selectOption("finance"); await expect(select).toHaveValue("finance");
    await expect(page.getByRole("dialog").getByRole("link", { name: "by RediON", exact: true })).toHaveAttribute("href", "https://www.redioncekrezi.de/");
    expect(await page.getByTestId("baumdienst-demo-footer").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: /Mein Büro/ }).click();
    await expect(page.locator("[data-office-object]")).toHaveCount(6);
    await expect(page.getByTestId("baumdienst-demo-footer")).toHaveCount(0);
    const room = page.getByTestId("office-room-scene");
    const portrait = width <= 700 && height > 480;
    expect(await room.locator("[aria-hidden=true]").first().evaluate(el => getComputedStyle(el).backgroundImage)).toContain(`office-room-${portrait ? "portrait" : "wide"}-${theme === "light" ? "day" : "night"}.webp`);
    await page.getByRole("button", { name: "Im Büro arbeiten", exact: true }).click();
    await expect(page.getByRole("button", { name: "Personal & Stunden", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Baustelle erstellen", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    if (width === 390 && theme === "light") {
      await page.getByRole("button", { name: "Aufgaben & Notizen", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Titel", { exact: true }).fill("DEMO UI Notiz");
      await dialog.getByLabel("Notizen", { exact: true }).fill("Fiktives Beispiel");
      await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
      await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue("");
      await page.reload(); await expect(page.getByRole("dialog")).toContainText("DEMO UI Notiz");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Büroassistent", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("OpenAI");
      await expect(page.getByRole("dialog").getByRole("button", { name: "Assistent fragen", exact: true })).toBeDisabled();
      await page.keyboard.press("Escape");
    }
    const actions = await page.locator("[data-office-object]").evaluateAll(es => es.map(e => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right })));
    expect(actions.every(a => a.w >= 44 && a.h >= 44 && a.top >= 0 && a.bottom <= height + 1 && a.left >= 0 && a.right <= width + 1)).toBe(true);
    const main = page.getByTestId("demo-workspace");
    expect(await main.evaluate(el => ({ fits: el.scrollWidth <= el.clientWidth + 1, noScroll:el.scrollHeight <= el.clientHeight + 1, outer: document.documentElement.scrollHeight <= innerHeight + 1 }))).toEqual({ fits: true, noScroll:true, outer: true });
    await page.screenshot({ path: info.outputPath(`office-finance-${theme}-${width}.png`) });
    if (width === 390 && theme === "light") {
      await page.addStyleTag({ content: "html{font-size:200% !important}" });
      expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await page.getByRole("button", { name: "Im Büro arbeiten", exact: true }).click();
      await expect(page.getByRole("button", { name: "Personal & Stunden", exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath("office-finance-text-200.png") });
      await page.keyboard.press("Escape");
    }
    await page.goto("/demo/offices/manager"); await expect(page.getByRole("button", { name: "Ordner & Archiv", exact: true })).toHaveCount(0); await expect(page.getByText("Zu Besuch", { exact: true })).toBeVisible();
  }
  await page.goto("/demo/privacy");
  await expect(page.getByTestId("demo-workspace")).toContainText("20 Textversuche");
  await expect(page.getByTestId("demo-workspace")).toContainText("store:false");
  expect(errors).toEqual([]); const after = await (await request.get("/api/demo/baumdienst/workshop")).json(); expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision);
});


test("a rejected persona change stays visible and visiting another room never reveals private controls", async ({ page, context }, info) => {
  const origin = String(info.project.use.baseURL);
  await role(context.request, origin, "manager");
  await page.goto("/demo/offices/manager");
  await page.getByRole("button", { name: "Büroeinstellungen", exact:true }).click();
  await context.route("**/api/demo/baumdienst/offices/actor", r => r.fulfill({ status:403, contentType:"application/json", body:JSON.stringify({ error:"permission" }) }));
  await page.getByLabel("Fiktive Rolle ausprobieren", { exact:true }).selectOption("finance");
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Fiktive Rolle ausprobieren", { exact:true })).toHaveValue("manager");
  await context.unroute("**/api/demo/baumdienst/offices/actor");
  await page.getByLabel("Fiktive Rolle ausprobieren", { exact:true }).selectOption("finance");
  await expect(page.getByLabel("Fiktive Rolle ausprobieren", { exact:true })).toHaveValue("finance");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name:"Mein Büro", exact:true }).click();
  await expect(page.getByRole("heading", { name:"Anna Schneider", exact:true })).toBeVisible();
  await expect(page.locator("[data-office-object]")).toHaveCount(6);
  await page.goto("/demo/offices/manager?tab=archive");
  await expect(page.getByRole("button", { name:"Zu Besuch", exact:true })).toBeVisible();
  await expect(page.locator("[data-office-object]")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
