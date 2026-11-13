import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";
import { woodCopy } from "../../src/lib/workshop/wood-copy";

test("plain workspace labels leave the scenery clear; wood lists and opened cards share the ice material without data writes", async ({ page, context, request }, info) => {
  await resetWorkshopFixture();
  const base = String(info.project.use.baseURL), c = woodCopy("de");
  await context.addCookies([{ name: "bk_lang", value: "de", url: base }]);
  const inventory = await (await request.get("/api/demo/baumdienst/workshop")).json();
  const wood = await (await request.get("/api/demo/baumdienst/wood")).json();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) for (const width of [1440, 390]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: base }]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo/workshop?tab=tools");
    const root = page.getByTestId("workshop-demo");
    await expect(page.getByRole("button", { name: "Gerät erfassen", exact: true })).toBeEnabled();
    const command = root.locator(":scope > header > div").first();
    expect(await command.evaluate(el => { const s = getComputedStyle(el); return { bg: s.backgroundColor, image: s.backgroundImage, border: s.borderTopWidth, blur: s.backdropFilter }; })).toEqual({ bg: "rgba(0, 0, 0, 0)", image: "none", border: "0px", blur: "none" });
    expect(await root.locator("h1").evaluate(el => getComputedStyle(el).textShadow)).not.toBe("none");
    const card = root.locator("article").first(), material = await card.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(await card.locator("[data-ui-status]").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await card.getByRole("button", { name: "Details öffnen", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.getByRole("dialog").evaluate(el => getComputedStyle(el).backgroundImage)).toBe(material);
    await page.keyboard.press("Escape");
    await page.goto("/demo/wood");
    const job = page.getByRole("button", { name: /Buchenholz 33 cm · Musterauftrag/ });
    await expect(job).toBeVisible();
    const woodMaterial = await job.evaluate(el => getComputedStyle(el).backgroundImage);
    await job.click();
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate(el => getComputedStyle(el).backgroundImage)).toBe(woodMaterial);
    expect(await dialog.evaluate(el => getComputedStyle(el).backdropFilter)).toBe("blur(12px)");
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.keyboard.press("Escape"); await expect(job).toBeFocused();
    for (const tab of ["intakes", "stock", "catalog", "production"] as const) {
      await page.getByRole("navigation", { name: c.title, exact: true }).getByRole("button", { name: c[tab], exact: true }).click();
      const list = page.getByTestId("wood-scroll-region");
      await expect(list).toHaveAttribute("aria-label", c[tab]);
      expect(await page.getByTestId("demo-workspace").evaluate(el => el.scrollTop === 0 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await list.focus(); await page.keyboard.press("Control+End");
      await expect(page.getByRole("link", { name: "by RediON", exact: true })).toBeInViewport();
      await expect(page.getByRole("link", { name: "by RediON", exact: true })).toHaveCount(1);
      await page.getByRole("searchbox", { name: c.label, exact: true }).fill("DEMO-NO-MATCH-476194");
      await expect(list.getByText(c.empty, { exact: true })).toBeVisible();
      expect(await list.getByText(c.empty, { exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      const end = await list.evaluate(el => ({ list: el.getBoundingClientRect().bottom, footer: el.querySelector('[data-testid="baumdienst-demo-footer"]')!.getBoundingClientRect().bottom }));
      expect(Math.abs(end.list - end.footer)).toBeLessThan(2);
      await page.getByRole("searchbox", { name: c.label, exact: true }).fill("");
    }
    await page.screenshot({ path: info.outputPath(`wood-fixed-${theme}-${width}.png`) });
  }
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json();
  expect(after.revision).toBe(inventory.revision); expect(after.state).toEqual(inventory.state);
  const woodAfter = await (await request.get("/api/demo/baumdienst/wood")).json();
  for (const key of ["revision", "definitions", "intakes", "jobs", "outputs", "dispatches", "events", "media"]) expect(woodAfter[key]).toEqual(wood[key]);
  expect(errors).toEqual([]);
});
