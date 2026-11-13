import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma, resetWorkshopFixture } from "./shared-fixture";
import type { DemoPlanSnapshot } from "../../src/lib/workshop/plan-model";
import type { WorkshopSnapshot } from "../../src/lib/workshop/shared-contract";
const DEMO_PLANS_KEY = "baumdienst-plans:v1";
test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await prisma.baumdienstDemoWorkspace.deleteMany({ where: { key: DEMO_PLANS_KEY } });
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
});
test("original Workzone canvas, reflow, map and plan entries stay usable on desktop and phone", async ({ page, request }, info) => {
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot;
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/demo/workzone");await expect(page.locator('[data-testid^="demo-photo-site-"] img').first()).toBeVisible();
  expect(await page.locator('[data-testid^="demo-photo-site-"] img').evaluateAll(images=>images.every(image=>getComputedStyle(image).objectFit==="cover"))).toBe(true);

    const canvas = page.getByTestId("workzone-canvas"); await expect(canvas).toBeVisible();
    const cards = canvas.getByTestId("muster-site-card"); await expect(cards.first()).toBeVisible();
    const seen=new Set<string>();
    for(let p=0;p<30;p++){
      for(const href of await cards.locator('a[href^="/demo/baustellen/"]').evaluateAll(es=>es.map(e=>e.getAttribute("href")!)))seen.add(href);
      const next=page.getByRole("button",{name:"Nächste Baustellen",exact:true});if(!await next.count()||await next.isDisabled())break;
      const previous=await page.locator('[data-scene-pages] span').innerText();await next.click();await expect(page.locator('[data-scene-pages] span')).not.toHaveText(previous);
    }
    expect(seen.size).toBe(before.directory.sites.length);
    await expect(page.getByRole("link", { name: "Tageplan +", exact: true })).toHaveAttribute("href", /\/demo\/plan\?date=/);
    for (const label of ["Kartenmodus", "Layout neu ordnen"]) {
      const box = await page.getByRole("button", { name: label, exact: true }).boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Layout neu ordnen", exact: true }).click();
    await expect(async () => { const fits = await cards.evaluateAll(elements => elements.every(e => { const parent = e.parentElement!.getBoundingClientRect(), rect = e.getBoundingClientRect(); return rect.left >= parent.left && rect.right <= parent.right + 1; })); expect(fits).toBe(true); }).toPass();
    await page.screenshot({ path: info.outputPath(`workzone-field-${width}.png`) });
    await page.getByRole("button", { name: "Kartenmodus", exact: true }).click(); await expect(page.getByTestId("workzone-fleet-map")).toBeVisible();
    await page.getByRole("button", { name: "Planmodus", exact: true }).click(); await expect(canvas).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot;
  expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision);
});
test("plan assignments, saved versions and worker read-only view persist across devices without changing custody", async ({ page, request, browser }, info) => {
  const base = String(info.project.use.baseURL);
  const workshop = await (await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await page.goto(`/demo/plan?date=${date}`); await page.getByRole("button", { name: "Plan erstellen", exact: true }).click();
  const first = await (await request.get(`/api/demo/baumdienst/plans?date=${date}`)).json() as DemoPlanSnapshot;
  const worker = first.workers.find(w => w.availability === "AVAILABLE" && !w.hasApprovedVacation)!;
  const asset = first.machines.find(m => m.isActive)!; expect(asset).toBeTruthy();
  for (const label of [worker.name, asset.name]) { const box = await page.getByRole("button", { name: label, exact: true }).boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); }
  for (const label of [worker.name, asset.name]) { await page.getByRole("button", { name: label, exact: true }).click(); await page.getByRole("button", { name: "Hier zuordnen", exact: true }).first().click(); await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled(); }
  await page.getByRole("button", { name: "Plan speichern", exact: true }).click();
  await expect.poll(async () => (await (await request.get(`/api/demo/baumdienst/plans?date=${date}`)).json() as DemoPlanSnapshot).plans[0].versions.length).toBe(1);
  const phone = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 } });
  try {
    await phone.addCookies([{ name: "bk_lang", value: "de", url: base }]);
    const changeActor = await phone.request.post("/api/demo/baumdienst/actor", { headers: { Origin: base }, data: { key: worker.id } }); expect(changeActor.ok()).toBe(true);
    const mobile = await phone.newPage(); await mobile.goto(`/demo/plan?date=${date}&view=calendar`);
    await expect(mobile.getByRole("heading", { name: "Kalender und Versionen", exact: true })).toBeVisible(); await expect(mobile.getByRole("main")).toContainText(worker.name); await expect(mobile.getByRole("main")).toContainText(asset.name);
    await expect(mobile.getByRole("button", { name: "Plan speichern", exact: true })).toHaveCount(0);
    const saved = await (await request.get(`/api/demo/baumdienst/plans?date=${date}`)).json() as DemoPlanSnapshot;
    const denied = await phone.request.post("/api/demo/baumdienst/plans", { headers: { Origin: base }, data: { requestId: randomUUID(), revision: saved.revision, command: { type: "clear", date } } }); expect(denied.status()).toBe(403);
    expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mobile.screenshot({ path: info.outputPath("plan-worker-phone.png") });
    const tomorrow = new Date(`${date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await mobile.locator('input[type="date"]').fill(tomorrow.toISOString().slice(0, 10));
    await expect(mobile).toHaveURL(/view=calendar/);
    await expect(mobile.getByRole("heading", { name: "Kalender und Versionen", exact: true })).toBeVisible();
    const badAsset = saved.machines.find(m => !m.isActive)!;
    const blocked = await request.post("/api/demo/baumdienst/plans", { headers: { Origin: base }, data: { requestId: randomUUID(), revision: saved.revision, command: { type: "move", date, columnId: saved.sites[0].id, kind: "MACHINE", itemId: badAsset.id, force: true } } }); expect(blocked.status()).toBe(400);
    const receipt = { requestId: randomUUID(), revision: saved.revision, command: { type: "note", date, columnId: saved.sites[0].id, note: "DEMO · Arbeitsplan" } };
    const a = await request.post("/api/demo/baumdienst/plans", { headers: { Origin: base }, data: receipt }); const b = await request.post("/api/demo/baumdienst/plans", { headers: { Origin: base }, data: receipt }); expect(a.ok()).toBe(true); expect(b.ok()).toBe(true); expect((await a.json()).revision).toBe((await b.json()).revision);
    const stale = await request.post("/api/demo/baumdienst/plans", { headers: { Origin: base }, data: { ...receipt, requestId: randomUUID(), command: { type: "clear", date } } }); expect(stale.status()).toBe(409);
    const crossOrigin = await request.post("/api/demo/baumdienst/plans", { headers: { Origin: "https://other.invalid" }, data: receipt }); expect(crossOrigin.status()).toBe(403);
    await page.reload(); await expect(page.getByRole("main")).toContainText(worker.name);
  } finally { await phone.close(); }
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot;
  expect(after.state).toEqual(workshop.state); expect(after.revision).toBe(workshop.revision);
});
