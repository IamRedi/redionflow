import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resetWorkshopFixture } from "./shared-fixture";
import { DEMO_BRAND_TARGET } from "../../src/lib/workshop/media";

test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }]);
});

test("office chat sits beside the monitor, keeps one scrolling history and a reachable composer in both themes", async ({ page, context, request }, info) => {
  const origin = String(info.project.use.baseURL), before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  await context.route("**/api/demo/baumdienst/offices?*", async route => {
    const response = await route.fetch(), data = await response.json();
    await route.fulfill({ response, json: { ...data, ai: { enabled: true, used: 1, limit: 20 }, turns: Array.from({ length: 12 }, (_, i) => ({ id: randomUUID(), owner: "manager", question: `DEMO Frage ${i + 1}`, answer: "Fiktive gespeicherte Antwort. ".repeat(24), status: "completed", at: new Date().toISOString(), model: "mock" })) } });
  });
  let finish: (() => void) | undefined;
  await context.route("**/api/demo/baumdienst/offices/assistant", async route => {
    await new Promise<void>(resolve => { finish = resolve; });
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "aiUnavailable" }) });
  });
  for (const theme of ["light", "dark"]) for (const [width, height] of [[1440, 900], [390, 844], [320, 700], [740, 360], [390, 360]]) {
    await context.addCookies([{ name: "bk_theme", value: theme, url: origin }]);
    await page.setViewportSize({ width, height }); await page.goto("/demo/offices/manager");
    const monitor = page.locator('[data-office-object="assistant"]'); await monitor.click();
    const panel = page.getByTestId("office-assistant-panel"), input = panel.getByRole("textbox", { name: "Deine Frage", exact: true });
    await expect(panel).toBeVisible(); await expect(panel.getByText("DEMO Frage 12", { exact: true })).toBeVisible();
    const box = (await panel.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(11); expect(box.y).toBeGreaterThanOrEqual(11); expect(box.x + box.width).toBeLessThanOrEqual(width - 11); expect(box.y + box.height).toBeLessThanOrEqual(height - 11);
    if (width === 1440) expect(box.x).toBeGreaterThanOrEqual((await monitor.boundingBox())!.x + (await monitor.boundingBox())!.width + 12);
    const thread = page.getByTestId("office-chat-thread"); expect(await thread.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await expect(input).toBeInViewport(); await expect(panel.getByRole("button", { name: "Assistent fragen", exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "Schließen", exact: true })).toBeInViewport();
    if (width === 390 && height === 844 && theme === "light") {
      await input.fill("DEMO nur UI, kein Provider"); await panel.getByRole("button", { name: "Assistent fragen", exact: true }).click();
      await expect(input).toBeDisabled(); await expect.poll(() => !!finish).toBe(true); finish!();
      await expect(panel.getByRole("alert")).toBeVisible(); await expect(input).toBeEnabled(); await expect(input).toHaveValue("DEMO nur UI, kein Provider");
    }
    if (width === 390 && height === 844 && theme === "dark") {
      await page.addStyleTag({ content:"html{font-size:200% !important}" });
      expect(await panel.locator('[data-chat-message="assistant"]').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(26);
      await expect(input).toBeInViewport(); await expect(panel.getByRole("button", { name:"Assistent fragen", exact:true })).toBeInViewport();
      expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`assistant-${theme}-${width}-${height}.png`) });
    await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0); await expect(monitor).toBeFocused();
    expect(await page.getByTestId("demo-workspace").evaluate(el => el.scrollHeight <= el.clientHeight + 1 && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  }
  const after = await (await request.get("/api/demo/baumdienst/workshop", { maxRetries: 1 })).json(); expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision);
});

test("Workzone retains the original logo after hydration without deleting a company photo", async ({ page, request }, info) => {
  const initial = await (await request.get("/api/demo/baumdienst/workshop")).json(), id = randomUUID(), origin = String(info.project.use.baseURL);
  const uploaded = await request.post("/api/demo/baumdienst/files", { headers:{ Origin:origin }, multipart:{ requestId:id, revision:String(initial.revision), kind:"asset", target:DEMO_BRAND_TARGET, file:{ name:"DEMO-logo.png", mimeType:"image/png", buffer:await readFile(path.resolve("public/branding/logo-512.png")) } } });
  // The upload receipt and stored original intentionally have different identities.
  expect(uploaded.status()).toBe(200); const before = await uploaded.json(), photo = before.photos.find((p: {id:string;target:string}) => p.target === DEMO_BRAND_TARGET && !initial.photos.some((existing: {id:string}) => existing.id === p.id));
  expect(photo).toBeTruthy(); const original = await (await request.get(photo.url)).body();
  await page.goto("/demo/workshop?tab=tools"); await expect(page.getByRole("button", { name: "Gerät erfassen", exact: true })).toBeEnabled();
  const brand = page.getByRole("link", { name: "BaumdienstFlow · Workzone", exact: true });
  await expect(brand.getByRole("img")).toHaveAttribute("src", photo.url);
  await brand.click(); await expect(brand).toHaveAttribute("data-brand-source", "original"); await expect(brand.getByRole("img")).toHaveAttribute("src", /branding%2Flogo-256.webp/);
  await page.reload(); await expect(page.getByRole("navigation", { name:"Demo", exact:true }).getByRole("link", { name:"Büros", exact:true })).toBeVisible(); await expect(brand).toHaveAttribute("data-brand-source", "original"); await expect(brand.getByRole("img")).toHaveAttribute("src", /branding%2Flogo-256.webp/); await expect(brand.getByText("AI", { exact:true })).toHaveCount(0);
  await page.goto("/demo/workshop?tab=tools"); await expect(brand.getByRole("img")).toHaveAttribute("src", photo.url);
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json(); expect(after.photos).toEqual(before.photos); expect(after.revision).toBe(before.revision);
  expect(await (await request.get(photo.url)).body()).toEqual(original);
});
