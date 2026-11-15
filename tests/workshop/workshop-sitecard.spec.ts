import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
});

test("site opens over the same Workzone, trees expand on demand and nested details return focus", async ({ page, context, request }, info) => {
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 528 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 600 }]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize(size); await page.goto("/demo/workzone");
    const canvas = page.getByTestId("workzone-canvas");
    await expect(canvas).toBeVisible();
    await canvas.evaluate(element => element.setAttribute("data-preservation-proof", "same-mounted-canvas"));
    const card = page.getByTestId("muster-site-card").first();
    const link = card.locator('a[href^="/demo/baustellen/"]');
    const href = (await link.getAttribute("href"))!;
    const title = await card.locator("[data-site-name]").innerText();
    const box = await card.boundingBox();
    await link.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(title);
    await expect(dialog.getByTestId("muster-site-detail")).toHaveAttribute("data-site-panel", "overview");
    await expect(dialog.getByTestId("muster-site-overview")).toBeVisible();
    await expect(dialog.getByTestId("muster-tree-grid")).toHaveCount(0);
    await expect(page).toHaveURL(/\/demo\/workzone$/);
    await expect(canvas).toHaveAttribute("data-preservation-proof", "same-mounted-canvas");
    expect(await dialog.evaluate(element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && element.scrollWidth <= element.clientWidth; })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await expect.poll(() => dialog.getByTestId("muster-site-detail").evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    for (const entry of await dialog.locator("[data-site-entry]").all()) await expect(entry).toBeInViewport({ ratio: 1 });
    await page.screenshot({ animations: "disabled", path: info.outputPath(`site-${theme}-${size.width}-${size.height}.png`) });
    const toggle = dialog.getByRole("button", { name: /^Bäume/ });
    await toggle.click(); await expect(dialog.getByTestId("muster-site-detail")).toHaveAttribute("data-site-panel", "trees");
    await expect(dialog.getByTestId("muster-site-overview")).toHaveCount(0);
    const grid = dialog.getByTestId("muster-tree-grid"); await expect(grid).toBeVisible();
    await grid.locator("article").last().scrollIntoViewIfNeeded();
    await expect(grid.locator("article").last()).toBeInViewport();
    expect(await grid.evaluate(element => element.scrollTop > 0 && element.scrollHeight > element.clientHeight)).toBe(true);
    expect(await dialog.evaluate(element => element.scrollTop === 0 && element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await expect(dialog.locator(".baum-tree-toolbar")).toBeInViewport({ ratio: 1 });
    const details = grid.getByRole("button", { name: /^Baumdetails/ }).last();
    await details.click(); await expect(page.getByRole("dialog").getByRole("button", { name: "Sicherheitsmaterial", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(details).toBeFocused();
    await dialog.getByRole("button", { name: "Zurück zur Baustelle", exact: true }).click(); await expect(grid).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(link).toBeFocused();
    const afterBox = await card.boundingBox(); expect(afterBox?.x).toBeCloseTo(box!.x, 0); expect(afterBox?.y).toBeCloseTo(box!.y, 0);
    const detail = await request.get(`/api/demo/baumdienst/sites/${href.split("/").pop()}`);
    expect(detail.status()).toBe(200); expect(detail.headers()["cache-control"]).toBe("private, no-store");
  }
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json();
  expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision); expect(errors).toEqual([]);
});

test("deep links, retry, keyboard and enlarged text keep site controls reachable", async ({ page, request }) => {
  const snapshot = await (await request.get("/api/demo/baumdienst/workshop")).json();
  const site = snapshot.directory.sites[0];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/demo/baustellen/${site.id}`);
  await expect(page.getByRole("dialog")).toHaveAccessibleName(site.name);
  await expect(page.getByTestId("workzone-canvas")).toBeAttached();
  await page.addStyleTag({ content: "html {font-size:200% !important;}" });
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const trees = dialog.getByRole("button", { name: /^Bäume/ });
  await trees.press("Enter"); await expect(dialog.getByTestId("muster-site-detail")).toHaveAttribute("data-site-panel", "trees");
  const grid = dialog.getByTestId("muster-tree-grid");
  expect(await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape"); await expect(page).toHaveURL(/\/demo\/workzone$/);
  await page.reload();
  await page.route("**/api/demo/baumdienst/sites/*", route => route.abort());
  const link = page.getByTestId("muster-site-card").first().locator('a[href^="/demo/baustellen/"]');
  await link.click(); await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.unroute("**/api/demo/baumdienst/sites/*");
  await page.getByRole("dialog").getByRole("button", { name: "Aktualisieren", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Bäume/ })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(link).toBeFocused();
  const missing = await request.get("/api/demo/baumdienst/sites/not-owned"); expect(missing.status()).toBe(404);
  expect((await request.get("/api/demo/baumdienst/sites/invalid%21")).status()).toBe(400);
  expect((await request.post(`/api/demo/baumdienst/sites/${site.id}`, { data: {} })).status()).toBe(405);
});


test("tree filters share one clean card and map while the species studio and site sections remain reachable", async ({ page, context, request }, info) => {
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  const site = before.directory.sites.find((entry: { name: string }) => entry.name.includes("Lindenallee"));
  const detail = await (await request.get(`/api/demo/baumdienst/sites/${site.id}`)).json();
  const done = detail.trees.filter((tree: { treeId: string; status: string }) => (before.state.custody.trees[`${site.key}:${tree.treeId}`]?.status || tree.status) === "done").length;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/demo/baustellen/${site.id}`);
    const dialog = page.getByRole("dialog");
    expect(await dialog.getByRole("heading", { name: site.name, exact: true }).evaluate(element => getComputedStyle(element.parentElement!.parentElement!).textAlign)).toBe("center");
    await dialog.getByRole("button", { name: "Bäume", exact: true }).click();
    const grid = dialog.getByTestId("muster-tree-grid"); await expect(grid.locator("article")).toHaveCount(detail.trees.length);
    const completed = dialog.locator('[data-tree-filter="done"]'); await completed.click(); await expect(completed).toHaveAttribute("aria-pressed", "true");
    await expect(grid.locator("article")).toHaveCount(done); expect(await grid.locator("article").evaluateAll(elements => elements.every(element => element.getAttribute("data-tree-status") === "done"))).toBe(true);
    await dialog.getByRole("button", { name: "Karte", exact: true }).click(); await expect(grid).toHaveCount(0); await expect(dialog.getByTestId("muster-tree-map")).toBeVisible();
    const doneCodes = new Set(detail.trees.filter((tree: { treeId: string; status: string }) => (before.state.custody.trees[`${site.key}:${tree.treeId}`]?.status || tree.status) === "done").map((tree: { treeId: string }) => tree.treeId));
    await expect(dialog.locator(".leaflet-marker-icon")).toHaveCount(detail.points.filter((point: { treeId: string }) => doneCodes.has(point.treeId)).length);
    await dialog.locator(".leaflet-marker-icon").first().focus(); await page.keyboard.press("Enter"); await dialog.getByRole("button", { name: "Baumdetails", exact: true }).click(); await expect(page.getByRole("dialog").getByRole("button", { name: "Sicherheitsmaterial", exact: true })).toBeVisible(); await expect(dialog.getByTestId("muster-tree-inline")).toBeFocused(); await expect(page.getByRole("dialog")).toHaveCount(1); await expect(page.getByRole("dialog")).toHaveCSS("pointer-events", "auto"); await page.keyboard.press("Escape"); await expect(dialog.getByRole("heading", { name: "Bäume", exact: true })).toBeVisible();
    await dialog.locator('[data-tree-filter="todo"]').click();
    await expect(dialog.getByTestId("muster-tree-map")).toHaveCount(0);
    await expect(grid.locator("article")).toHaveCount(detail.trees.length - done); expect(await grid.locator("article").evaluateAll(elements => elements.every(element => element.getAttribute("data-tree-status") !== "done"))).toBe(true);
    await dialog.getByRole("button", { name: "Artenstudio", exact: true }).click(); await expect(page.getByRole("dialog").getByRole("button", { name: "Hecken", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
    await dialog.locator('[data-tree-filter="all"]').click(); await expect(grid.locator("article")).toHaveCount(detail.trees.length);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`tree-workspace-${width}.png`) });
    await dialog.getByRole("button", { name: "Zurück zur Baustelle", exact: true }).click();
    for (const section of ["team", "safety", "inventory", "documents", "instructions", "photos", "work"]) {
      const entry = dialog.locator(`[data-site-entry="${section}"]`); await entry.click(); await expect(dialog.getByTestId("muster-site-overview")).toHaveCount(0); await expect(dialog.getByTestId("muster-site-detail")).toHaveAttribute("data-site-panel", section);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await dialog.getByRole("button", { name: "Zurück zur Baustelle", exact: true }).click(); await expect(entry).toBeFocused();
    }
    await page.keyboard.press("Escape");
  }
  await context.addCookies([{ name: "bk_lang", value: "sq", url: String(info.project.use.baseURL) }]);
  for (const theme of ["light", "dark"]) for (const width of [1440, 390]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/demo/baustellen/${site.id}`);
    const dialog = page.getByRole("dialog"); await expect(dialog.getByRole("button", { name: "Pemët", exact: true })).toBeVisible();
    await page.screenshot({ animations: "disabled", path: info.outputPath(`site-sq-${theme}-${width}.png`) });
    await dialog.getByRole("button", { name: "Pemët", exact: true }).click();
    await expect(dialog.getByRole("button", { name: /^Për t’u bërë/ })).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`trees-sq-${theme}-${width}.png`) });
  }
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json(); expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision);
});


test("tree cards flip without moving any slot; tree-lens reader and report retry preserve behavior", async ({ page, context, request }, info) => {
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  const site = before.directory.sites.find((entry: { name: string }) => entry.name.includes("Lindenallee"));
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  let code = "";
  for (const theme of ["light", "dark"]) for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 600 }, { width: 844, height: 390 }]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize(size); await page.goto(`/demo/baustellen/${site.id}`);
    await page.getByRole("button", { name: "Bäume", exact: true }).click();
    const grid = page.getByTestId("muster-tree-grid"), card = grid.locator('article[data-tree-status="todo"]').first();
    code = (await card.getAttribute("data-tree-code"))!;
    const trigger = card.locator(".baum-tree-trigger");
    const inspect = card.getByRole("button", { name: `Artenkarte öffnen · ${code}`, exact: true });
    await expect(inspect.locator("svg[data-tree-inspection-icon]")).toHaveCount(1);
    await inspect.click(); await expect(page.locator('[role="dialog"]')).toHaveCount(2);
    await expect(page.getByRole("dialog").getByTestId("species-reference")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
    await expect(inspect).toBeFocused(); await expect(card.getByTestId("muster-tree-inline")).toHaveCount(0);
    await trigger.scrollIntoViewIfNeeded();
    const slots = () => grid.evaluate(element => { const g = element.getBoundingClientRect(); return [...element.querySelectorAll("article[data-tree-code]")].map(card => { const r = card.getBoundingClientRect(); return [card.getAttribute("data-tree-code"), ...[r.left - g.left, r.top - g.top + element.scrollTop, r.width, r.height].map(n => Number(n.toFixed(2)))]; }); });
    const beforeSlots = await slots(), beforeScroll = await grid.evaluate(element => element.scrollTop), boxBefore = (await card.boundingBox())!;
    const point = await trigger.evaluate(element => { const r = element.getBoundingClientRect(), g = element.closest('[data-testid="muster-tree-grid"]')!.getBoundingClientRect(); return { x: Math.max(r.left,g.left) + Math.min(r.width,40), y: (Math.max(r.top,g.top) + Math.min(r.bottom,g.bottom))/2 }; });
    await page.mouse.click(point.x, point.y);
    expect(await slots()).toEqual(beforeSlots);
    await expect.poll(() => card.locator(".baum-tree-turner").evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11)).toBeLessThan(-.99);
    expect(await slots()).toEqual(beforeSlots); expect(await grid.evaluate(element => element.scrollTop)).toBe(beforeScroll);
    const inline = card.getByTestId("muster-tree-inline"); await expect(inline).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(inline.getByRole("button", { name: "Erledigt", exact: true })).toBeVisible();
    expect((await card.boundingBox())!.width).toBeCloseTo(boxBefore.width, 0); expect((await card.boundingBox())!.height).toBeCloseTo(boxBefore.height, 0);
    for (const label of ["Erledigt", "Problem melden"]) {
      const box = await inline.getByRole("button", { name: label, exact: true }).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.getByRole("dialog").evaluate(element => element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`inline-${theme}-${size.width}.png`) });
    await inline.getByRole("button", { name: "Problem melden", exact: true }).click();
    await inline.getByLabel("Was muss geprüft werden?").fill("DEMO · temporary unsent note");
    await expect(inline.getByLabel("Was muss geprüft werden?")).toBeFocused();
    expect(await slots()).toEqual(beforeSlots);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`report-${theme}-${size.width}.png`) });
    await page.keyboard.press("Escape"); await expect(inline).toHaveCount(0);
    await expect(trigger).toBeFocused(); await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await slots()).toEqual(beforeSlots);
    await trigger.press("Enter"); await expect(card.getByTestId("muster-tree-inline")).toBeVisible();
    await card.getByRole("button", { name: `Schließen · ${code}`, exact: true }).click();
    await expect(trigger).toBeFocused();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedCard = page.locator(`article[data-tree-code="${code}"]`);
  await reducedCard.locator(".baum-tree-trigger").press("Enter");
  await expect(reducedCard.locator(".baum-tree-turner")).toHaveCSS("transition-duration", "0s");
  await page.keyboard.press("Escape"); await page.emulateMedia({ reducedMotion: "no-preference" });
  const readOnly = await (await request.get("/api/demo/baumdienst/workshop")).json();
  expect(readOnly.state).toEqual(before.state); expect(readOnly.revision).toBe(before.revision);
  const card = page.locator(`article[data-tree-code="${code}"]`);
  await card.locator(".baum-tree-trigger").click();
  await card.getByRole("button", { name: "Problem melden", exact: true }).click();
  const draft = card.getByLabel("Was muss geprüft werden?"); await draft.fill("DEMO · branch above footpath, retained after retry");
  const sent: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/demo/baumdienst/workshop") sent.push(request.postDataJSON().requestId); });
  await page.route("**/api/demo/baumdienst/workshop", route => route.request().method() === "POST" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "connection" }) }) : route.continue());
  await card.getByRole("button", { name: "Problem melden", exact: true }).click();
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(draft).toHaveValue("DEMO · branch above footpath, retained after retry");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.unroute("**/api/demo/baumdienst/workshop");
  await card.getByRole("button", { name: "Problem melden", exact: true }).click();
  await expect(card.getByTestId("muster-tree-inline")).toHaveCount(0);
  await expect(card).toHaveAttribute("data-tree-status", "blocked");
  await expect(card.locator(".baum-tree-trigger")).toBeFocused();
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json();
  expect(after.state.custody.treeEvents).toHaveLength(before.state.custody.treeEvents.length + 1);
  expect(sent).toHaveLength(2); expect(sent[0]).toBe(sent[1]); expect(errors).toEqual([]);
});
