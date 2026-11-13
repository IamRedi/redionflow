import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";
test.beforeEach(async () => { await resetWorkshopFixture(); });

test("fixed workshop keeps its controls, scrolls the natural legal footer, and preserves small-save position", async ({ page, context }, info) => {
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 360 }]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize(size);
    for (const route of ["/demo/workshop", "/demo/workshop?tab=tools", "/demo/workshop?tab=fleet", "/demo/workshop?tab=parts", "/demo/workshop?tab=documents", "/demo/workshop?tab=history", "/demo/wood", "/demo/workzone", "/demo/dashboard"]) {
      await page.goto(route);
      const workspace = page.getByTestId("demo-workspace");
      await expect(workspace).toBeVisible();
      const workshop = route.startsWith("/demo/workshop") || route === "/demo/wood";
      const wood = route === "/demo/wood";
      const scroller = workshop ? page.getByTestId(wood ? "wood-scroll-region" : "workshop-scroll-region") : workspace;
      await expect(scroller).toBeVisible();
      if (workshop) {
        await expect(page.getByRole("button", { name: wood ? "Auftrag erstellen" : (route.includes("tab=tools") || route.includes("tab=fleet")) ? "Gerät erfassen" : "Defekt melden", exact: true })).toBeEnabled();
        const teamHeader = (await page.getByTestId("baum-demo-topbar").boundingBox())!;
        const initialContent = (await workspace.locator(":scope > div > div").first().boundingBox())!;
        expect(initialContent.y).toBeGreaterThanOrEqual(teamHeader.y + teamHeader.height - 1);
        expect((await workspace.boundingBox())!.y).toBeLessThanOrEqual(1);
      }
      const signature = page.getByRole("link", { name: "by RediON", exact: true });
      await expect(signature).toHaveCount(1);
      const footer = (await signature.boundingBox())!;
      expect(Math.abs(footer.x + footer.width / 2 - size.width / 2)).toBeLessThan(2);
      expect((await workspace.boundingBox())!.height).toBeGreaterThan(120);
      const dimensions = await workspace.evaluate(el => ({ width: el.getBoundingClientRect().width, outer: document.documentElement.scrollHeight, viewport: innerHeight, wide: document.documentElement.scrollWidth <= innerWidth }));
      expect(dimensions.width).toBeGreaterThan(size.width - 24);
      expect(dimensions.outer).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.wide).toBe(true);
      await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect.poll(async () => scroller.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
      const footerAfter = (await signature.boundingBox())!;
      expect(footerAfter.y + footerAfter.height).toBeLessThanOrEqual(size.height + 1);
      const scrollTop = await scroller.evaluate(el => el.scrollTop);
      if (scrollTop > 5) expect(footer.y - footerAfter.y).toBeGreaterThan(5);
      await expect(page.getByRole("link", { name: "Datenschutz", exact: true })).toHaveAttribute("href", "/demo/privacy");
      await scroller.evaluate(el => { el.scrollTop = 0; });
      if (scrollTop > 100) expect((await signature.boundingBox())!.y).toBeGreaterThan(size.height);
      const scrollers = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")].filter(el => {
        const s = getComputedStyle(el); return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      }).map(el => el.getAttribute("data-testid") || el.tagName));
      expect(scrollers.filter(id => id !== (workshop ? wood ? "wood-scroll-region" : "workshop-scroll-region" : "demo-workspace") && !(workshop && id === "HEADER"))).toEqual([]);
      if (workshop) {
        expect(await workspace.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        const toolbar = page.getByTestId(wood ? "wood-workspace" : "workshop-demo").locator(":scope > header");
        if (size.height >= 844) {
          expect(await toolbar.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
          expect((await toolbar.boundingBox())!.height).toBeLessThan(size.width > 1000 ? 140 : 180);
        }
        await expect(toolbar.getByRole("navigation").locator("a,button")).toHaveCount(wood ? 4 : 6);
        if (!wood) await expect(page.getByTestId("workshop-status-line").locator("dd")).toHaveCount(3);
        const targets = await toolbar.getByRole("navigation").locator("a,button").evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
        expect(targets.every(height => height >= 44)).toBe(true);
        expect((await scroller.boundingBox())!.height).toBeGreaterThan(55);
      }
      if (route === "/demo/workshop") await page.screenshot({ path: info.outputPath(`shell-${theme}-${size.width}-${size.height}.png`) });
    }
  }
  // Text-only zoom retains readable wrapping without trapping the workspace.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/workshop");
  await expect(page.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const zoomWorkspace = page.getByTestId("workshop-scroll-region");
  expect((await zoomWorkspace.boundingBox())!.height).toBeGreaterThan(120);
  await zoomWorkspace.focus();
  await page.keyboard.press("Control+End");
  await expect.poll(async () => zoomWorkspace.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("link", { name: "by RediON", exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("shell-text-zoom.png") });
  await page.goto("/demo/workshop?tab=parts");
  await expect(page.getByRole("button", { name: "Bestand auffüllen", exact: true }).last()).toBeEnabled();
  const workspace = page.getByTestId("workshop-scroll-region");
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
