import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

test.beforeEach(async () => { await resetWorkshopFixture(); });

test("Muster keeps its continuous canvas, with stationary compact workshop controls above an unobstructed list", async ({ page, context }, info) => {
  const baseURL = String(info.project.use.baseURL);
  await context.addCookies([{ name: "bk_lang", value: "de", url: baseURL }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) for (const [width, height] of [[1440, 900], [390, 844], [320, 700], [740, 360]]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: baseURL }]);
    await page.setViewportSize({ width, height });
    for (const route of ["/demo/workshop", "/demo/workshop?tab=tools", "/demo/workshop?tab=fleet", "/demo/wood", "/demo/workzone"]) {
      await page.goto(route);
      const workspace = page.getByTestId("demo-workspace");
      const marker = route.includes("workshop") ? page.getByTestId("workshop-demo").locator(":scope > header") : route.endsWith("wood") ? page.getByTestId("wood-workspace").locator(":scope > header") : page.getByTestId("workzone-canvas");
      await expect(marker).toBeVisible();
      if (route.includes("workshop")) await expect(page.getByRole("button", { name: (route.includes("tools") || route.includes("fleet")) ? "Gerät erfassen" : "Defekt melden", exact: true })).toBeEnabled();
      await expect.poll(async () => workspace.evaluate(el => el.scrollTop)).toBe(0);
      const header = (await page.getByTestId("baum-demo-topbar").boundingBox())!;
      const content = (await workspace.locator(":scope > div > div").first().boundingBox())!;
      const before = (await marker.boundingBox())!;
      const headerBottom = header.y + header.height;
      expect(content.y).toBeGreaterThanOrEqual(headerBottom - 1);
      const clip = (await workspace.boundingBox())!;
      expect(clip.y).toBeLessThanOrEqual(1);
      expect(clip.height).toBeGreaterThanOrEqual(height - 1);
      if (route.includes("workshop") || route.endsWith("wood")) {
        const list = page.getByTestId(route.endsWith("wood") ? "wood-scroll-region" : "workshop-scroll-region");
        await expect(list).toBeVisible();
        const toolbar = page.getByTestId(route.endsWith("wood") ? "wood-workspace" : "workshop-demo").locator(":scope > header");
        const geometry = await toolbar.evaluate(el => {
          const r = el.getBoundingClientRect(); return { y: r.y, height: r.height };
        });
        const bounds = (await list.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(geometry.y + geometry.height - 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect(page.getByRole("link", { name: "by RediON", exact: true })).toBeInViewport();
        expect((await marker.boundingBox())!.y).toBeCloseTo(before.y, 0);
        expect(await workspace.evaluate(el => el.scrollTop)).toBe(0);
        await list.evaluate(el => { el.scrollTop = 0; });
        const card = route.endsWith("wood") ? list.getByRole("button", { name: /Buchenholz 33 cm · Musterauftrag/ }).first() : route === "/demo/workshop" ? list.getByRole("button", { name: /^Details öffnen:/ }).first() : list.locator("article").first();
        await card.scrollIntoViewIfNeeded();
        // A short viewport may initially show the repair-column heading. Scroll
        // the card into the list, then measure and hit-test the visible part in
        // one frame, rather than sampling a point above an off-screen card.
        expect(await card.evaluate(el => {
          const r = el.getBoundingClientRect(), list = el.closest('[data-testid$="scroll-region"]')!.getBoundingClientRect();
          const top = Math.max(r.top, list.top), bottom = Math.min(r.bottom, list.bottom, innerHeight);
          const hit = document.elementFromPoint(r.x + r.width / 2, (top + bottom) / 2);
          return bottom > top && (hit === el || hit !== null && el.contains(hit));
        })).toBe(true);
      } else {
      await workspace.evaluate(el=>{el.scrollTop=el.scrollHeight;});
      expect(await workspace.evaluate(el=>el.scrollTop)).toBe(0);
      expect((await marker.boundingBox())!.y).toBeCloseTo(before.y,0);
      const hit=await marker.evaluate(el=>{const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+7);return {painted:target===el||target!==null&&el.contains(target),outerStill:document.documentElement.scrollHeight<=innerHeight+1,fits:document.documentElement.scrollWidth<=innerWidth}});
      expect(hit).toEqual({painted:true,outerStill:true,fits:true});
      }
      if (route.includes("tools") || route.includes("fleet")) {
        const fleet = route.includes("fleet");
        await expect(page.locator(`[data-baum-environment="${fleet ? "fleet" : "inventory"}"]`)).toHaveCount(1);
        const backdrop = await page.locator('[data-baum-studio="forest-crystal-v1"]').evaluate(el => getComputedStyle(el).backgroundImage);
        expect(backdrop).toContain(`${fleet ? "fleet-yard" : "tool-warehouse"}-${theme === "light" ? "day" : "night"}.webp`);
        if (width === 390) await page.screenshot({ path: info.outputPath(`${fleet ? "fleet" : "inventory"}-continuous-${theme}-phone.png`) });
      }
    }
  }
  expect(errors).toEqual([]);
});
