import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";
test.beforeEach(async () => { await resetWorkshopFixture(); });

test("workspace uses the viewport, scrolls the natural legal footer, and preserves small-save position", async ({ page, context }, info) => {
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 360 }]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize(size);
    for (const route of ["/demo/workshop", "/demo/workshop?tab=tools", "/demo/workzone", "/demo/dashboard"]) {
      await page.goto(route);
      const workspace = page.getByTestId("demo-workspace");
      await expect(workspace).toBeVisible();
      if (route.startsWith("/demo/workshop")) await expect(page.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
      const signature = page.getByRole("link", { name: "by RediON", exact: true });
      await expect(signature).toHaveCount(1);
      const footer = (await signature.boundingBox())!;
      expect(Math.abs(footer.x + footer.width / 2 - size.width / 2)).toBeLessThan(2);
      expect((await workspace.boundingBox())!.height).toBeGreaterThan(120);
      const dimensions = await workspace.evaluate(el => ({ width: el.getBoundingClientRect().width, outer: document.documentElement.scrollHeight, viewport: innerHeight, wide: document.documentElement.scrollWidth <= innerWidth }));
      expect(dimensions.width).toBeGreaterThan(size.width - 24);
      expect(dimensions.outer).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.wide).toBe(true);
      await workspace.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect.poll(async () => workspace.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
      const footerAfter = (await signature.boundingBox())!;
      expect(footerAfter.y + footerAfter.height).toBeLessThanOrEqual(size.height + 1);
      const scrollTop = await workspace.evaluate(el => el.scrollTop);
      if (scrollTop > 5) expect(footer.y - footerAfter.y).toBeGreaterThan(5);
      await expect(page.getByRole("link", { name: "Datenschutz", exact: true })).toHaveAttribute("href", "/demo/privacy");
      await workspace.evaluate(el => { el.scrollTop = 0; });
      if (scrollTop > 100) expect((await signature.boundingBox())!.y).toBeGreaterThan(size.height);
      const scrollers = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].filter(el => {
        const s = getComputedStyle(el); return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      }).map(el => el.getAttribute("data-testid") || el.tagName));
      expect(scrollers.filter(id => id !== "demo-workspace")).toEqual([]);
      if (route === "/demo/workshop") await page.screenshot({ path: info.outputPath(`shell-${theme}-${size.width}-${size.height}.png`) });
    }
  }
  // Text-only zoom retains readable wrapping without trapping the workspace.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/workshop");
  await expect(page.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const zoomWorkspace = page.getByTestId("demo-workspace");
  expect((await zoomWorkspace.boundingBox())!.height).toBeGreaterThan(120);
  await zoomWorkspace.focus();
  await page.keyboard.press("Control+End");
  await expect.poll(async () => zoomWorkspace.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("link", { name: "by RediON", exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("shell-text-zoom.png") });
  await page.goto("/demo/workshop?tab=parts");
  await expect(page.getByRole("button", { name: "Bestand auffüllen", exact: true }).last()).toBeEnabled();
  const workspace = page.getByTestId("demo-workspace");
  const restock = page.getByRole("button", { name: "Bestand auffüllen", exact: true }).last();
  await restock.scrollIntoViewIfNeeded();
  const before = await workspace.evaluate(el => el.scrollTop);
  expect(before).toBeGreaterThan(50);
  await restock.click();
  await expect(page.getByTestId("workshop-demo").getByRole("status")).toContainText(/gespeichert/i);
  const after = await workspace.evaluate(el => el.scrollTop);
  expect(after).toBeGreaterThan(50);
  expect(Math.abs(after - before)).toBeLessThan(100);
  expect(errors).toEqual([]);
});
