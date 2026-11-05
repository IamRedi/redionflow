import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelProduction } from '../fixtures/steel-production';
import { dayKey, shiftMonth } from '../../src/lib/dashboard/steel-metrics';

test('production dashboard follows the theme with readable text and distinct charts', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(180_000);
  const month = shiftMonth(dayKey(new Date(), 'Europe/Tirane').slice(0, 7), -1);
  const email = `steel-theme-${Date.now()}@example.test`;
  let companyId: string | undefined;
  try {
    await context.addCookies([
      { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
      { name: 'bk_theme', value: 'light', url: info.project.use.baseURL! },
    ]);
    await page.goto('/signup?mode=bau');
    await page.locator('input[name="displayName"]').fill('Mira Steel · DEMO');
    await page.locator('input[name="fullName"]').fill('Admin Demo');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Synthetic-Steel-Demo-123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    await seedSteelProduction(companyId, month);
    const palettes: string[][] = [];
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.goto(`/app/dashboard?month=${month}&day=${month}-14`);
      if (theme === 'dark') {
        // Exercise the existing server-cookie toggle, not a test-only DOM class.
        await page.getByRole('button', { name: 'Drite/Erresire', exact: true }).click();
      }
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      await page.getByTestId('production-evidence-toggle').click();
      const root = page.getByTestId('steel-dashboard');
      const audit = async () => root.evaluate(element => {
        type RGB = [number, number, number, number];
        const rgba = (raw: string): RGB => {
          const nums = raw.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
          return [nums[0], nums[1], nums[2], nums[3] ?? 1];
        };
        const over = (a: RGB, b: RGB): RGB => [a[0] * a[3] + b[0] * (1 - a[3]), a[1] * a[3] + b[1] * (1 - a[3]), a[2] * a[3] + b[2] * (1 - a[3]), 1];
        const luminance = (rgb: RGB) => rgb.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
        const ratio = (a: RGB, b: RGB) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
        const backgrounds = (el: Element | null): RGB[] => {
          if (!el) return [[255, 255, 255, 1]];
          const style = getComputedStyle(el), base = rgba(style.backgroundColor);
          const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => rgba(m[0])).filter(c => c[3] > 0);
          if (!stops.length && base[3] === 0) return backgrounds(el.parentElement);
          const lower = base[3] === 1 ? [base] : backgrounds(el.parentElement).map(b => over(base, b));
          return stops.length ? [...(base[3] ? lower : []), ...stops.flatMap(s => lower.map(b => over(s, b)))] : lower;
        };
        const failures: Array<{ text: string; ratio: number; color: string; backgrounds: RGB[] }> = [];
        let tested = 0;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent?.trim(), el = walker.currentNode.parentElement;
          if (!text || !el || !el.getClientRects().length) continue;
          const style = getComputedStyle(el);
          if (style.visibility !== 'visible' || style.display === 'none') continue;
          const bg = backgrounds(el), color = el.tagName.toLowerCase() === 'text' ? style.fill : style.color;
          const fg = rgba(color), minimum = Math.min(...bg.map(b => ratio(over(fg, b), b)));
          tested++;
          if (minimum < 4.5) failures.push({ text: text.slice(0, 50), ratio: minimum, color, backgrounds: bg });
        }
        const svg = element.querySelector('svg[role="img"]')!;
        const strokes = [...svg.querySelectorAll('path')].map(p => getComputedStyle(p).stroke);
        const chartMinimum = Math.min(...strokes.flatMap(s => backgrounds(svg).map(b => ratio(rgba(s), b))));
        return { tested, failures, strokes, chartMinimum, scheme: getComputedStyle(element).colorScheme };
      });
      for (const [width, height, device] of [[1440, 1050, 'desktop'], [390, 844, 'phone']] as const) {
        await page.setViewportSize({ width, height });
        const result = await audit();
        expect(result.scheme).toBe(theme);
        expect(result.tested).toBeGreaterThan(150);
        expect(result.failures, `${theme}/${device} text contrast`).toEqual([]);
        expect(new Set(result.strokes).size).toBe(3);
        expect(result.chartMinimum).toBeGreaterThanOrEqual(3);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (device === 'desktop') palettes.push(result.strokes);
        await page.screenshot({ path: info.outputPath(`steel-dashboard-${theme}-${device}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/display/dashboard?month=${month}&day=${month}-14`);
      await expect(root).toBeVisible();
      const monitor = await audit();
      expect(monitor.scheme).toBe(theme);
      expect(monitor.failures, `${theme}/monitor text contrast`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`steel-dashboard-${theme}-monitor.png`), fullPage: true });
    }
    expect(palettes[0]).not.toEqual(palettes[1]);
  } finally {
    if (companyId) {
      await prisma.user.deleteMany({ where: { companyProfileId: companyId } });
      await prisma.companyProfile.delete({ where: { id: companyId } });
    }
  }
});
