import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

const api = "/api/demo/baumdienst/workshop";
test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
});

test("one forest material spans the workspace, with reachable navigation and no inventory writes", async ({ page, context, request }, info) => {
  const before = await (await request.get(api)).json();
  for (const theme of ["light", "dark"]) for (const width of [1440, 390]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/demo/control", "/demo/wood", "/demo/workshop?tab=tools", "/demo/workshop?tab=fleet", "/demo/workshop", "/demo/dashboard", "/demo/workzone"]) {
      await page.goto(route);
      const shell = page.locator('[data-baum-studio="forest-crystal-v1"]');
      await expect(shell).toBeVisible();
      const environment = route === "/demo/workshop" ? "repair-workshop" : route.includes("tab=tools") ? "tool-warehouse" : route.includes("tab=fleet") ? "fleet-yard" : null;
      if (environment) {
        const background = await shell.evaluate(el => getComputedStyle(el).backgroundImage);
        expect(background).toContain(`${environment}-${theme === "dark" ? "night" : "day"}.webp`);
        if (theme === "light") expect(background).not.toContain("linear-gradient");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const surface = shell.locator('main [data-ui-surface="card"],main :is(section,article,div,details,button)[class~="border"][class*="bg-card"],[data-testid="muster-site-card"]').first();
      await expect(surface).toBeVisible();
      expect(await surface.evaluate(el => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
      expect(await surface.evaluate(el => getComputedStyle(el).backdropFilter)).toContain("2px");
      if (route === "/demo/workshop?tab=tools") await expect(page.getByRole("navigation", { name: "Demo", exact: true }).getByRole("link", { name: "Inventar", exact: true })).toHaveAttribute("aria-current", "page");
    }
    const team = await page.getByTestId("baum-team-strip").boundingBox();
    const more = page.getByLabel("Profil", { exact: true });
    const settings = (await more.boundingBox())!;
    expect(settings.x).toBeGreaterThanOrEqual(team!.x + team!.width - 1);
    expect(settings.height).toBeGreaterThanOrEqual(44);
    for (const action of await page.getByTestId("muster-site-card").first().getByRole("link").all()) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await more.click();
    await expect(page.getByRole("combobox", { name: "Demo ausprobieren als" })).toBeVisible();
    await more.click();
    await page.screenshot({ path: info.outputPath(`forest-workzone-${theme}-${width}.png`) });
  }
  const after = await (await request.get(api)).json();
  expect(after.revision).toBe(before.revision);
  expect(after.state).toEqual(before.state);
});

test("dialog portals retain the identity, focus and primary touch targets in both themes", async ({ page, context, request }, info) => {
  const before = await (await request.get(api)).json();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.goto("/demo/workshop?tab=tools");
    const register = page.getByRole("button", { name: "Gerät erfassen", exact: true });
    await expect(register).toBeEnabled();
    expect((await register.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const material = await page.getByTestId("workshop-demo").locator("article").first().evaluate(el => getComputedStyle(el).backgroundImage);
    await register.click();
    await page.getByRole("dialog").getByRole("button", { name: "Name / neuer Barcode", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => Boolean(el.closest('[data-baum-studio]')))).toBe(false);
    expect(await dialog.evaluate(el => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
    expect(await dialog.evaluate(el => getComputedStyle(el).backgroundImage)).toBe(material);
    expect(await dialog.evaluate(el => getComputedStyle(el).backdropFilter)).toBe("blur(12px)");
    const name = dialog.getByLabel("Bezeichnung", { exact: true });
    await name.fill("DEMO · Nur visueller Entwurf");
    await name.press("Tab");
    await page.screenshot({ path: info.outputPath(`forest-dialog-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(register).toBeFocused();
  }
  const after = await (await request.get(api)).json();
  expect(after.revision).toBe(before.revision);
  expect(after.state).toEqual(before.state);
});

test("forced colors keep cards and controls readable without translucent effects", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/demo/control");
  const card = page.locator('[data-demo-shell="muster"] section.border.bg-card').first();
  await expect(card).toBeVisible();
  expect(await card.evaluate(el => getComputedStyle(el).backgroundImage)).toBe("none");
  expect(await card.evaluate(el => getComputedStyle(el).backdropFilter)).toBe("none");
});
