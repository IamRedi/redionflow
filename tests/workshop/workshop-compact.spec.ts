import { expect, test } from "@playwright/test";
import { prisma, resetWorkshopFixture } from "./shared-fixture";
import { workshopDay } from "../../src/lib/workshop/demo-model";

test("compact fleet cards bind HU/SP/UVV to existing machine dates; office and monitor keep one clean workspace", async ({ page, context, request }, info) => {
  await resetWorkshopFixture();
  const baseURL = String(info.project.use.baseURL);
  await context.addCookies([{ name: "bk_lang", value: "de", url: baseURL }]);
  const original = await prisma.machine.findMany({ where: { targe: { in: ["MU-BD 201", "MU-BD 101"] } }, select: { id: true, targe: true, tuvDate: true, spDate: true, uvvDate: true } });
  expect(original).toHaveLength(2);
  const day = workshopDay(new Date().toISOString());
  const date = (offset: number) => new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000);
  const chipper = original.find(m => m.targe === "MU-BD 201")!, truck = original.find(m => m.targe === "MU-BD 101")!;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    await prisma.machine.update({ where: { id: chipper.id }, data: { tuvDate: date(60), spDate: date(15), uvvDate: date(-1) } });
    await prisma.machine.update({ where: { id: truck.id }, data: { tuvDate: null, spDate: null, uvvDate: null } });
    const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
    for (const theme of ["light", "dark"]) for (const [width, height] of [[1440, 900], [390, 844], [320, 700], [740, 360]]) {
      await context.addCookies([{ name: "bk_theme", value: theme, url: baseURL }]);
      await page.setViewportSize({ width, height }); await page.goto("/demo/workshop?tab=fleet");
      await expect(page.getByRole("button", { name: "Gerät erfassen", exact: true })).toBeEnabled();
      const cards = page.getByTestId("fleet-asset-card"); await expect(cards).toHaveCount(4);
      const a = (await cards.nth(0).boundingBox())!, b = (await cards.nth(1).boundingBox())!;
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      expect(a.width).toBeLessThanOrEqual(221);
      if (width < 640) expect(b.x).toBeGreaterThan(a.x + a.width);
      const card = cards.filter({ has: page.getByRole("heading", { name: "Häcksler", exact: true }) });
      for (const [key, state] of [["hu", "ok"], ["sp", "due"], ["uvv", "expired"]]) await expect(card.locator(`[data-fleet-check="${key}"]`)).toHaveAttribute("data-state", state);
      const unknown = cards.filter({ has: page.getByRole("heading", { name: "LKW 7,5 t", exact: true }) });
      await expect(unknown.locator('[data-state="unknown"]')).toHaveCount(3);
      await expect(card.getByTestId("fleet-check-lights")).not.toContainText(day);
      await card.getByRole("button", { name: "Details öffnen", exact: true }).click();
      const dialog = page.getByRole("dialog"), details = dialog.locator("details").filter({ has: page.getByTestId("fleet-check-details") });
      await details.locator("summary").click(); await expect(dialog.getByTestId("fleet-check-details")).toBeVisible();
      await expect(dialog.locator('[data-fleet-check="uvv"]')).toHaveAttribute("data-state", "expired");
      await page.keyboard.press("Escape"); await page.screenshot({ path: info.outputPath(`fleet-compact-${theme}-${width}.png`) });
      for (const route of ["/demo/control", "/demo/tv?view=dashboard"]) {
        await page.goto(route);
        const main = page.getByTestId("demo-workspace"); await expect(main).toBeVisible();
        const layout = await main.evaluate(el => ({ fits: el.scrollWidth <= el.clientWidth + 1, outer: document.documentElement.scrollHeight <= innerHeight + 1 }));
        expect(layout).toEqual({ fits: true, outer: true });
        const background = await page.locator('[data-baum-studio="forest-crystal-v1"]').evaluate(el => getComputedStyle(el).backgroundImage);
        expect(background).toContain(`control-office-${theme === "light" ? "day" : "night"}.webp`);
        if (route.includes("/tv")) {
          await expect(page.getByTestId("baum-demo-topbar")).toBeHidden();
          await expect(page.locator("[data-demo-tv] button, [data-demo-tv] nav")).toHaveCount(0);
        }
        await main.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect(page.getByRole("link", { name: "by RediON", exact: true })).toBeInViewport();
        const footer = await page.getByTestId("baumdienst-demo-footer").evaluate(el => getComputedStyle(el).backgroundColor);
        expect(footer).toBe("rgba(0, 0, 0, 0)");
      }
    }
    const after = await (await request.get("/api/demo/baumdienst/workshop")).json();
    expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision); expect(errors).toEqual([]);
  } finally {
    for (const { id, tuvDate, spDate, uvvDate } of original) await prisma.machine.update({ where: { id }, data: { tuvDate, spDate, uvvDate } });
  }
});
