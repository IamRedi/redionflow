import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

test.beforeEach(async () => { await resetWorkshopFixture(); });

test("all four Muster workspaces paint and receive input beneath transparent chrome without a clipping seam", async ({ page, context }, info) => {
  const baseURL = String(info.project.use.baseURL);
  await context.addCookies([{ name: "bk_lang", value: "de", url: baseURL }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) for (const [width, height] of [[1440, 900], [390, 844], [320, 700], [740, 360]]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: baseURL }]);
    await page.setViewportSize({ width, height });
    for (const route of ["/demo/workshop", "/demo/workshop?tab=tools", "/demo/wood", "/demo/workzone"]) {
      await page.goto(route);
      const workspace = page.getByTestId("demo-workspace");
      const marker = route.includes("workshop") ? page.getByTestId("workshop-demo").locator(":scope > header") : route.endsWith("wood") ? page.getByTestId("wood-workspace").locator(":scope > header") : page.getByTestId("workzone-canvas");
      await expect(marker).toBeVisible();
      if (route.includes("workshop")) await expect(page.getByRole("button", { name: route.includes("tools") ? "Gerät erfassen" : "Defekt melden", exact: true })).toBeEnabled();
      await expect.poll(async () => workspace.evaluate(el => el.scrollTop)).toBe(0);
      const header = (await page.getByTestId("baum-demo-topbar").boundingBox())!;
      const content = (await workspace.locator(":scope > div > div").first().boundingBox())!;
      const before = (await marker.boundingBox())!;
      const headerBottom = header.y + header.height;
      expect(content.y).toBeGreaterThanOrEqual(headerBottom - 1);
      const clip = (await workspace.boundingBox())!;
      expect(clip.y).toBeLessThanOrEqual(1);
      expect(clip.height).toBeGreaterThanOrEqual(height - 1);
      const targetScroll = before.y - headerBottom + 14;
      expect(targetScroll).toBeGreaterThan(0);
      await workspace.evaluate((el, top) => { el.scrollTop = top; }, targetScroll);
      await expect.poll(async () => (await marker.boundingBox())!.y).toBeLessThan(headerBottom - 8);
      // A point just inside the header's empty bottom padding must see the
      // actual scrolling content, not the background or an invisible header.
      const after = (await marker.boundingBox())!;
      const hit = await marker.evaluate((el, point) => {
        const target = document.elementFromPoint(point.x, point.y);
        return { painted: target === el || (target !== null && el.contains(target)), outerStill: document.documentElement.scrollHeight <= innerHeight + 1, fits: document.documentElement.scrollWidth <= innerWidth };
      }, { x: after.x + after.width / 2, y: headerBottom - 6 });
      expect(hit).toEqual({ painted: true, outerStill: true, fits: true });
      if (route.includes("tools")) {
        await expect(page.locator('[data-baum-environment="inventory"]')).toHaveCount(1);
        const backdrop = await page.locator('[data-baum-studio="forest-crystal-v1"]').evaluate(el => getComputedStyle(el).backgroundImage);
        expect(backdrop).toContain(`tool-warehouse-${theme === "light" ? "day" : "night"}.webp`);
        if (width === 390) await page.screenshot({ path: info.outputPath(`inventory-continuous-${theme}-phone.png`) });
      }
    }
  }
  expect(errors).toEqual([]);
});
