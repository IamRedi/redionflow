import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelProduction } from '../fixtures/steel-production';
import { dayKey, shiftMonth } from '../../src/lib/dashboard/steel-metrics';

test('steel admin team stays in its own space and scrolls away from the charts', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(180_000);
  const month = shiftMonth(dayKey(new Date(), 'Europe/Tirane').slice(0, 7), -1);
  const email = `steel-strip-${Date.now()}@example.test`;
  let companyId: string | undefined;
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }]);
    await page.goto('/signup?mode=bau');
    await page.locator('input[name="displayName"]').fill('Mira Steel · DEMO');
    await page.locator('input[name="fullName"]').fill('Admin Demo');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Synthetic-Steel-Demo-123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    await seedSteelProduction(companyId, month);
    await prisma.worker.createMany({ data: Array.from({ length: 40 }, (_, i) => ({
      companyProfileId: companyId!, firstName: `Demo${String(i + 1).padStart(2, '0')}`, lastName: `Crew${String(i + 1).padStart(2, '0')}`,
    })) });
    await prisma.user.createMany({ data: ['A', 'B', 'C'].map(letter => ({
      companyProfileId: companyId!, name: `Office Demo ${letter}`, email: `office-${letter}-${companyId}@example.test`, role: 'ADMIN' as const,
    })) });
    for (const theme of ['light', 'dark'] as const) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      for (const [width, height, device] of [[1920, 1080, 'desktop'], [1024, 900, 'tablet'], [390, 844, 'phone'], [320, 760, 'small-phone']] as const) {
        await page.setViewportSize({ width, height });
        await page.goto(`/app/dashboard?month=${month}&day=${month}-14`);
        const header = page.getByTestId('admin-topbar'), strip = page.getByTestId('flow-team-strip');
        await expect(strip.getByRole('button')).toHaveCount(40);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const geometry = await header.evaluate(el => {
          const team = el.querySelector('[data-testid="flow-team-strip"]')!.getBoundingClientRect();
          const logo = el.querySelector('button')!.getBoundingClientRect();
          const rect = el.getBoundingClientRect();
          return { height: rect.height, teamRight: team.right, separated: team.left >= logo.right || team.right <= logo.left || team.top >= logo.bottom || team.bottom <= logo.top };
        });
        expect(geometry.height).toBeLessThan(200);
        expect(geometry.separated).toBe(true);
        expect(geometry.teamRight).toBeLessThanOrEqual(width);
        await page.screenshot({ path: info.outputPath(`steel-team-${theme}-${device}-top.png`) });
        if (device === 'desktop' || device === 'phone') {
          await strip.getByRole('button', { name: /^Demo01 Crew01/ }).click();
          await expect(header.getByRole('button', { name: 'Profili', exact: true })).toBeVisible();
        }
        await page.evaluate(() => window.scrollTo(0, 850));
        await expect.poll(() => header.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
        await expect(header.getByRole('button', { name: 'Profili', exact: true })).toHaveCount(0);
        const chart = page.locator('svg[role="img"]').first();
        await chart.scrollIntoViewIfNeeded();
        expect(await chart.evaluate(el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return hit === el || el.contains(hit);
        })).toBe(true);
        await page.screenshot({ path: info.outputPath(`steel-team-${theme}-${device}-scrolled.png`) });
      }
    }
  } finally {
    if (companyId) {
      await prisma.user.deleteMany({ where: { companyProfileId: companyId } });
      await prisma.companyProfile.delete({ where: { id: companyId } });
    }
  }
});
