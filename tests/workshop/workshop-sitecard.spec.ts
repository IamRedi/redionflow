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
  for (const theme of ["light", "dark"]) for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 600 }]) {
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
    await expect(dialog.getByRole("button", { name: /^Bäume/ })).toHaveAttribute("aria-expanded", "false");
    await expect(dialog.getByTestId("muster-tree-grid")).toHaveCount(0);
    await expect(page).toHaveURL(/\/demo\/workzone$/);
    await expect(canvas).toHaveAttribute("data-preservation-proof", "same-mounted-canvas");
    expect(await dialog.evaluate(element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && element.scrollWidth <= element.clientWidth; })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`site-${theme}-${size.width}-${size.height}.png`) });
    const toggle = dialog.getByRole("button", { name: /^Bäume/ });
    await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const grid = dialog.getByTestId("muster-tree-grid"); await expect(grid).toBeVisible();
    await grid.locator("article").last().scrollIntoViewIfNeeded();
    await expect(grid.locator("article").last()).toBeInViewport();
    const details = grid.getByRole("button", { name: /^Baumdetails/ }).last();
    await details.click(); await expect(page.getByRole("dialog").getByRole("button", { name: "Sicherheitsmaterial", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(details).toBeFocused();
    await toggle.click(); await expect(grid).toHaveCount(0);
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
  await trees.press("Enter"); await expect(trees).toHaveAttribute("aria-expanded", "true");
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
