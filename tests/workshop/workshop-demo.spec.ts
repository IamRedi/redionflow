import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { workshopCopy } from "../../src/lib/workshop/copy";
import { resetWorkshopFixture } from "./shared-fixture";

test.beforeEach(async ({ context, page }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  await context.route("https://nominatim.openstreetmap.org/**", route => route.abort());
  await page.goto("/demo/workshop");
  await expect(page.getByTestId("workshop-demo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
});

test("repair, parts, release, issue/return, shared document, reload and history export", async ({ page, request }, info) => {
  const seed = await (await request.get("/api/demo/baumdienst/workshop")).json();
  expect((await request.post("/api/demo/baumdienst/workshop", {headers:{Origin:String(info.project.use.baseURL)}, data:{requestId:randomUUID(), revision:seed.revision, command:{type:"policy", autoConfirm:true}}})).status()).toBe(200);
  await page.reload(); await expect(page.getByRole("button",{name:"Defekt melden",exact:true})).toBeEnabled();
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.getByRole("button", { name: "Defekt melden", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Gerät / Fahrzeug", { exact: true }).selectOption("crane");
  await dialog.getByLabel("Defektbeschreibung").fill("DEMO · Bremswarnleuchte prüfen");
  await dialog.getByLabel("Verantwortlich").fill("Demo-Werkstatt");
  await dialog.getByRole("button", { name: "In Werkstatt annehmen" }).click();
  await page.getByRole("button", { name: "Details öffnen: Kran-LKW · MU-BD 401", exact: true }).click();
  await dialog.getByRole("button", { name: "Reparatur starten", exact: true }).click();
  await page.getByRole("button", { name: "Details öffnen: Kran-LKW · MU-BD 401", exact: true }).click();
  await dialog.getByLabel("Ersatzteile", { exact: true }).selectOption("hydraulic");
  await dialog.getByLabel("Menge", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Teil verwenden" }).click();
  await expect(dialog.getByText("96,00", { exact: false }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Teil verwenden" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nicht genügend");
  await dialog.getByLabel("Durchgeführte Arbeiten").fill("DEMO: Leitung ersetzt und Funktion geprüft.");
  await dialog.getByLabel("Funktionsprüfung erfolgreich").check();
  await dialog.getByRole("button", { name: "Reparatur abschließen", exact: true }).click();
  await page.getByRole("button", { name: "Details öffnen: Kran-LKW · MU-BD 401", exact: true }).click();
  await dialog.getByRole("button", { name: "Für Einsatz freigeben", exact: true }).click();
  await expect(dialog.getByText("In der gemeinsamen Demo gespeichert.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("link", { name: "Flotte", exact: true }).click();
  const crane = page.locator("article").filter({ has: page.getByRole("heading", { name: "Kran-LKW", exact: true }) });
  await expect(crane).toContainText("Verfügbar");
  await crane.getByRole("button", { name: "Details öffnen" }).click();
  await dialog.getByRole("button", { name: "An Mitarbeiter geben", exact: true }).click();
  await dialog.getByLabel("Mitarbeiter wählen", { exact: true }).selectOption({ label: "Jonas Becker" });
  await dialog.getByRole("button", { name: "Anfrage senden", exact: true }).click();
  await page.reload(); await expect(crane).toContainText("Jonas Becker");
  await crane.getByRole("button", { name: "Details öffnen" }).click();
  await dialog.getByRole("button", { name: "Ins Lager zurückgeben", exact: true }).click();
  await dialog.getByRole("button", { name: "Anfrage senden", exact: true }).click();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("link", { name: "Dokumente", exact: true }).click();
  await page.getByLabel("Gerät / Fahrzeug", { exact: true }).last().selectOption("crane");
  const content = "DEMO · Werkstatt-Protokoll, keine echten Daten.";
  await page.getByLabel("Beispieldokument hinzufügen", { exact: true }).setInputFiles({ name: "DEMO-Pruefprotokoll.txt", mimeType: "text/plain", buffer: Buffer.from(content) });
  await expect(page.getByText("DEMO-Pruefprotokoll.txt", { exact: true })).toBeVisible();
  await page.reload();
  const docRow = page.locator("li").filter({ hasText: "DEMO-Pruefprotokoll.txt" });
  const documentDownload = page.waitForEvent("download"); await docRow.getByRole("link", { name: "Herunterladen" }).click();
  const documentPath = await (await documentDownload).path();
  expect(await readFile(documentPath!, "utf8")).toBe(content);
  await page.getByTestId("workshop-scroll-region").locator("summary").filter({ hasText: workshopCopy("de").shared }).click();
  const exported = page.waitForEvent("download"); await page.getByRole("button", { name: "Demodaten exportieren", exact: true }).click();
  const { state } = JSON.parse(await readFile((await (await exported).path())!, "utf8"));
  expect(state.assets.find((a: { id: string }) => a.id === "crane").events.length).toBeGreaterThan(5);
  expect(state.parts.find((p: { id: string }) => p.id === "hydraulic").stock).toBe(1);
  expect(state.movements).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Demo zurücksetzen", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("documents-shared.png"), fullPage: true });
});

test("six locales, desktop/touch themes, overflow, focus and usable primary controls", async ({ page, context }, info) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  for (const lang of ["de", "en", "sq", "it", "pl", "ro"]) {
    await context.addCookies([{ name: "bk_lang", value: lang, url: String(info.project.use.baseURL) }]); await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: workshopCopy(lang).title, exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
  }
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  for (const theme of ["light", "dark"]) for (const width of [1440, 768, 390, 320]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.setViewportSize({ width, height: width > 800 ? 1000 : 844 });
    for (const tab of ["orders", "fleet", "tools", "parts", "documents", "history"]) {
      await page.goto(`/demo/workshop?tab=${tab}`);
      await expect(page.getByTestId("workshop-demo")).toBeVisible();
      const primary = page.getByRole("button", {name: tab === "tools" || tab === "fleet" ? "Gerät erfassen" : "Defekt melden", exact:true});
      await expect(primary).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const size = await primary.boundingBox(); expect(size!.height).toBeGreaterThanOrEqual(44);
      const colors = await primary.evaluate(el => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
      const luminance = (value: string) => { const rgb = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(n => { const x = n / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
      const [fg, bg] = colors.map(luminance); expect((Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)).toBeGreaterThanOrEqual(4.5);
      if ((width === 1440 || width === 390) && (tab === "orders" || tab === "tools")) await page.screenshot({ path: info.outputPath(`${tab}-${theme}-${width}.png`), fullPage: true });
    }
    await page.goto("/demo/workshop");
    const opener = page.getByRole("button", { name: "Details öffnen: Motorsäge · WG-101", exact: true });
    await opener.click(); await expect(page.getByRole("dialog")).toBeVisible();
    const box = await page.getByRole("dialog").boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(15); expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15);
    await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
    const signature = page.getByRole("link", { name: "by RediON", exact: true }); await expect(signature).toHaveCount(1); await expect(signature).toHaveAttribute("href", "https://www.redioncekrezi.de/");
    expect((await signature.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/demo/workshop");
  await page.getByLabel("Mehr",{exact:true}).click();
  await page.getByRole("button", { name: "Hell/Dunkel", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.getByTestId("workshop-demo").locator("svg g").evaluateAll(els => els.some(el => getComputedStyle(el).animationName !== "none"))).toBe(false);
  expect(errors).toEqual([]);
});

test("native presentation, shared Workzone header and the existing detail pages", async ({ page, context }, info) => {
  for (const lang of ["sq", "en", "de", "it"]) {
    await context.addCookies([{ name: "bk_lang", value: lang, url: String(info.project.use.baseURL) }]);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto("/");
      const workshop = page.locator("#werkstatt-demo"); await expect(workshop).toContainText(workshopCopy(lang).demoHint);
      await expect(workshop.getByRole("link")).toHaveAttribute("href", "/demo/workshop");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (lang === "de") { await workshop.screenshot({ path: info.outputPath(`native-workshop-${width}.png`) }); await page.locator("#produkt").screenshot({ path: info.outputPath(`native-cards-${width}.png`) }); }
    }
  }
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
  for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 1000 }); await context.addCookies([{ name: "bk_theme", value: theme, url: String(info.project.use.baseURL) }]);
    await page.goto("/demo/workzone");
    const strip = page.getByTestId("baum-demo-topbar"); await expect(strip).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const workerSize = await strip.getByRole("button").first().boundingBox(); expect(workerSize!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath(`workzone-${theme}-${width}.png`), fullPage: true });
    const site = await page.locator('a[href^="/demo/baustellen/"]').first().getAttribute("href");
    await strip.getByLabel("Mehr", {exact:true}).click();
    await expect(strip.getByRole("combobox", {name:"Demo ausprobieren als"})).toBeVisible();
    await strip.getByLabel("Mehr", {exact:true}).click();
    await page.goto("/demo/dashboard"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (site) { await page.goto(site); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  }
});

test("old browser storage never overwrites the shared demo", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("redionflow:baumdienst:workshop-demo:v1", "invalid demo JSON"));
  await page.reload();
  await expect(page.getByRole("button", { name: "Defekt melden", exact: true })).toBeEnabled();
  await expect(page.getByTestId("workshop-demo").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Demo zurücksetzen", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("redionflow:baumdienst:workshop-demo:v1"))).toBe("invalid demo JSON");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});
