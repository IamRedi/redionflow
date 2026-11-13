import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

type MotionFrame = { path: string; theme: boolean; names: string[]; durations: number[]; filters: string[] };
type MotionWindow = Window & { __baumFrames: MotionFrame[]; __documentToken: string };

test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: "bk_lang", value: "de", url: String(info.project.use.baseURL) }, { name: "bk_theme", value: "light", url: String(info.project.use.baseURL) }]);
  await context.route("https://*.tile.openstreetmap.org/**", r => r.abort());
  await context.addInitScript(() => {
    const w = window as unknown as MotionWindow;
    w.__baumFrames = []; w.__documentToken = crypto.randomUUID();
    const original = document.startViewTransition;
    if (!original) return;
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: (...args: unknown[]) => {
      // Observe real browser snapshots/animations; do not replace their behavior.
      const transition = Reflect.apply(original, document, args) as ViewTransition;
      void transition.ready.then(() => {
        const animations = document.getAnimations().filter(a => a instanceof CSSAnimation && a.animationName.startsWith("baum-diffuse-"));
        if (animations.length) w.__baumFrames.push({ path: location.pathname, theme: document.documentElement.classList.contains("dark"), names: animations.map(a => (a as CSSAnimation).animationName), durations: animations.map(a => Number(a.effect?.getTiming().duration)), filters: animations.flatMap(a => (a.effect as KeyframeEffect).getKeyframes().map(f => String(f.filter ?? ""))) });
      }).catch(() => {});
      return transition;
    } });
  });
});

test("deliberate scene and theme changes diffuse without document reload or lost search; office settings stay open", async ({ page, context, request }, info) => {
  const before = await (await request.get("/api/demo/baumdienst/workshop")).json();
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  for (const width of [1440, 390]) {
    await context.addCookies([{ name: "bk_theme", value: "light", url: String(info.project.use.baseURL) }]);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 }); await page.goto("/demo/workzone");
    await expect(page.getByTestId("muster-site-card").first()).toBeVisible();
    const token = await page.evaluate(() => (window as unknown as MotionWindow).__documentToken);
    await page.locator('[data-demo-navigation] a[href="/demo/offices"]').click();
    await expect(page.getByTestId("office-reception-scene")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as MotionWindow).__baumFrames.length)).toBeGreaterThan(0);
    await page.locator('[data-office-door="manager"]').click(); await expect(page.getByTestId("office-room-scene")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as MotionWindow).__baumFrames.some(f => f.path === "/demo/offices/manager"))).toBe(true);
    expect(await page.evaluate(() => (window as unknown as MotionWindow).__documentToken)).toBe(token);
    await page.goto("/demo/workshop?tab=tools");
    const search = "Name, Kennzeichen, Code oder Defekt suchen…";
    await page.getByRole("button", { name: search, exact: true }).click();
    const input = page.getByRole("searchbox", { name: search, exact: true }); await input.fill("Motor");
    const theme = page.locator('form[action="/app/toggle-theme"] button'), doc = await page.evaluate(() => (window as unknown as MotionWindow).__documentToken);
    let posts = 0; page.on("request", r => { if (r.url().endsWith("/app/toggle-theme") && r.method() === "POST") posts++; });
    await theme.click(); await expect(page.locator("html")).toHaveClass(/dark/); await expect(theme).toBeEnabled();
    await expect(input).toHaveValue("Motor"); expect(await page.evaluate(() => (window as unknown as MotionWindow).__documentToken)).toBe(doc); expect(posts).toBe(1);
    expect((await context.cookies()).find(c => c.name === "bk_theme")?.value).toBe("dark");
    await expect.poll(() => page.evaluate(() => (window as unknown as MotionWindow).__baumFrames.some(f => f.theme))).toBe(true);
    const frames = await page.evaluate(() => (window as unknown as MotionWindow).__baumFrames);
    expect(frames.some(f => f.names.includes("baum-diffuse-in") && f.names.includes("baum-diffuse-out"))).toBe(true);
    expect(frames.every(f => f.durations.every(d => d === 420))).toBe(true); expect(frames.some(f => f.filters.includes("blur(2px)"))).toBe(true);
    await page.goto("/demo/offices/manager?tab=settings");
    await expect(page.getByTestId("office-settings")).toBeVisible();
    await page.getByTestId("office-settings").locator('form[action="/app/toggle-theme"] button').click();
    await expect(page.locator("html")).not.toHaveClass(/dark/); await expect(page.getByTestId("office-settings")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`theme-settings-${width}.png`) });
  }
  const after = await (await request.get("/api/demo/baumdienst/workshop")).json(); expect(after.state).toEqual(before.state); expect(after.revision).toBe(before.revision); expect(errors).toEqual([]);
});

test("reduced motion and missing browser API retain working navigation and persisted themes", async ({ page, context }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/demo/workzone");
  await page.locator('[data-demo-navigation] a[href="/demo/offices"]').click(); await expect(page.getByTestId("office-reception-scene")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as MotionWindow).__baumFrames.length)).toBe(0);
  await context.addInitScript(() => Object.defineProperty(document, "startViewTransition", { value: undefined, configurable: true }));
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.goto("/demo/workzone");
  await page.locator('form[action="/app/toggle-theme"] button').click(); await expect(page.locator("html")).toHaveClass(/dark/);
  await page.locator('[data-demo-navigation] a[href="/demo/offices"]').click(); await expect(page.getByTestId("office-reception-scene")).toBeVisible();
  expect((await context.cookies()).find(c => c.name === "bk_theme")?.value).toBe("dark");
  await page.goBack(); await expect(page.getByTestId("muster-site-card").first()).toBeVisible();
  // Native form fallback still persists the same HttpOnly preference without JS.
  const noJs = await context.browser()!.newContext({ javaScriptEnabled: false, baseURL: String(info.project.use.baseURL) });
  try { const plain = await noJs.newPage(); await plain.goto("/demo/workzone"); await plain.locator('form[action="/app/toggle-theme"] button').click(); await expect(plain.locator("html")).toHaveClass(/dark/); } finally { await noJs.close(); }
});

test("failed appearance request reads back once, reports the error and allows a safe retry", async ({ page }) => {
  await page.goto("/demo/workzone"); let posts = 0;
  const handler = async (route: import("@playwright/test").Route) => { posts++; await route.abort(); };
  await page.route("**/app/toggle-theme", handler);
  const button = page.locator('form[action="/app/toggle-theme"] button'); await button.click();
  await expect(page.getByRole("alert").filter({ hasText: "Aktion" })).toBeVisible(); await expect(button).toBeEnabled();
  expect(posts).toBe(1); await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.unroute("**/app/toggle-theme", handler); await button.click(); await expect(page.locator("html")).toHaveClass(/dark/); await expect(button).toBeEnabled();
});
