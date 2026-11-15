import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
});

test("100 and 1,000 tree references keep bounded DOM, all records reachable, fixed flips and cached images", async ({ page, request }, info) => {
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json(), site = before.directory.sites[0];
  const detail = await (await request.get(`/api/demo/baumdienst/sites/${site.id}`)).json();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const metrics: unknown[] = [];
  for (const count of [100, 1000]) for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const trees = Array.from({ length: count }, (_, i) => ({ ...detail.trees[0], id: `stress-${i}`, treeId: `STRESS-${String(i + 1).padStart(4, "0")}`, species: ["Winterlinde", "Spitzahorn", "Sommerlinde"][i % 3], status: i % 3 ? "todo" : "done" }));
    await page.route("**/api/demo/baumdienst/sites/*", route => route.fulfill({ json: { ...detail, trees, points: [] } }));
    await page.setViewportSize(size); const start = Date.now(); await page.goto("/demo/workzone"); await page.locator(`a[href="/demo/baustellen/${site.id}"]`).first().click(); await page.getByRole("button", { name: "Bäume", exact: true }).click();
    const grid = page.getByTestId("muster-tree-grid"); await expect(grid).toHaveAttribute("data-total-items", String(count));
    await expect.poll(() => grid.locator("article").count()).toBeGreaterThan(0);
    const initialMs = Date.now() - start, columns = Number(await grid.getAttribute("data-columns"));
    const limit = columns * (Math.ceil(await grid.evaluate(e => e.clientHeight) / 272) + 4);
    expect(await grid.locator("article").count()).toBeLessThanOrEqual(limit);
    expect(await grid.locator("*").count()).toBeLessThan(2400);
    await expect(grid).toHaveCSS("scrollbar-width", "none"); await expect(page.locator(".baum-tree-toolbar")).toHaveCSS("background-image", "none");
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("combobox", { name: "Sommer · Herbst · Winter", exact: true }).selectOption("winter");
    await expect(grid.locator('[data-reference-season="winter"]').first()).toBeVisible();
    await grid.press("End"); const last = grid.locator(`[data-tree-code="${trees.at(-1)!.treeId}"]`); await expect(last).toBeInViewport(); await expect(last.locator(".baum-tree-trigger")).toBeFocused();
    const lastRects = await grid.locator("article").evaluateAll(nodes => nodes.map(e => { const r = e.getBoundingClientRect(); return [e.getAttribute("data-tree-code"), r.x, r.y, r.width, r.height]; }));
    await last.locator(".baum-tree-trigger").press("Enter"); await expect.poll(() => last.locator(".baum-tree-turner").evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).m11)).toBe(-1);
    expect(await grid.locator("article").evaluateAll(nodes => nodes.map(e => { const r = e.getBoundingClientRect(); return [e.getAttribute("data-tree-code"), r.x, r.y, r.width, r.height]; }))).toEqual(lastRects);
    await page.keyboard.press("Escape"); await expect(last.locator(".baum-tree-trigger")).toBeFocused();
    await grid.press("Home"); await expect(grid.locator('[data-tree-code="STRESS-0001"] .baum-tree-trigger')).toBeFocused();
    const visited = new Set<string>(); let maxMounted = 0;
    for (let step = 0; step < 1200; step++) {
      for (const code of await grid.locator("article").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-tree-code")!))) visited.add(code);
      maxMounted = Math.max(maxMounted, await grid.locator("article").count());
      const finished = await grid.evaluate(async element => { if (element.scrollTop + element.clientHeight >= element.scrollHeight - 2) return true; element.scrollBy(0, Math.max(30, element.clientHeight - 40)); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return false; });
      if (finished) break;
    }
    expect(visited.size).toBe(count); expect(maxMounted).toBeLessThanOrEqual(limit);
    const imageMetrics = await page.evaluate(() => performance.getEntriesByType("resource").filter(e => e.name.includes("variant=photoreal-v2")).map(e => ({ url: e.name, bytes: (e as PerformanceResourceTiming).transferSize })));
    expect(new Set(imageMetrics.map(e => e.url)).size).toBeLessThanOrEqual(3);
    metrics.push({ count, ...size, columns, initialMs, maxMounted, reached: visited.size, images: imageMetrics });
    await page.screenshot({ animations: "disabled", path: info.outputPath(`windowed-${count}-${size.width}.png`) });
    await page.unroute("**/api/demo/baumdienst/sites/*");
  }
  await info.attach("windowing-metrics", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json(); expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision); expect(errors).toEqual([]);
});

test("large inventory and wood catalogues share the existing scroll region and reveal the last item", async ({ page, request }, info) => {
  const inventory = await (await request.get("/api/demo/baumdienst/workshop")).json(), wood = await (await request.get("/api/demo/baumdienst/wood")).json();
  const source = inventory.state.assets.find((asset: { kind: string }) => asset.kind !== "fleet");
  const assets = Array.from({ length: 100 - inventory.state.assets.length }, (_, i) => ({ ...source, id: `windowed-asset-${i}`, code: `W-${i}`, barcode: `W-${i}`, plate: undefined, name: `Windowed asset ${i}`, events: [] }));
  const definition = wood.definitions.find((d: { kind: string }) => d.kind === "wood");
  const definitions = Array.from({ length: 1000 }, (_, i) => ({ ...definition, id: `windowed-definition-${i}`, label: `Windowed phase ${i}` }));
  await page.route("**/api/demo/baumdienst/workshop", route => route.request().method() === "GET" ? route.fulfill({ json: { ...inventory, state: { ...inventory.state, assets: [...inventory.state.assets, ...assets] } } }) : route.abort());
  await page.route("**/api/demo/baumdienst/wood", route => route.request().method() === "GET" ? route.fulfill({ json: { ...wood, definitions } }) : route.abort());
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/demo/workshop?tab=tools");
    const collection = page.locator("[data-windowed-collection]"); await expect.poll(async () => Number(await collection.getAttribute("data-total-items"))).toBeGreaterThanOrEqual(90);
    expect(await collection.locator("[data-collection-index]").count()).toBeLessThan(50);
    await collection.press("End"); await expect(collection.getByRole("heading", { name: `Windowed asset ${assets.length - 1}`, exact: true })).toBeInViewport();
    await page.screenshot({ animations: "disabled", path: info.outputPath(`windowed-inventory-${width}.png`) });
    await page.goto("/demo/wood?view=catalog"); await page.getByRole("button", { name: "Arbeiten & Phasen", exact: true }).click();
    await expect(collection).toHaveAttribute("data-total-items", "1000"); expect(await collection.locator("[data-collection-index]").count()).toBeLessThan(60);
    await collection.press("End"); await expect(collection.getByRole("heading", { name: "Windowed phase 999", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ animations: "disabled", path: info.outputPath(`windowed-wood-${width}.png`) });
  }
});
