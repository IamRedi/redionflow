import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelProduction } from '../fixtures/steel-production';
import { dayRange } from '../../src/lib/workzone/date-utils';
import { dayKey, shiftMonth } from '../../src/lib/dashboard/steel-metrics';

const baseline = process.env.STEEL_CRYSTAL_BASELINE === 'true';
test('planning and production retain their workflows in the shared crystal workspace', async ({ page, context, baseURL }, info) => {
  assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL;
  const out = process.env.STEEL_CRYSTAL_EVIDENCE_DIR ?? info.outputDir;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const email = `crystal-${Date.now()}@example.test`;
  let companyId: string | undefined;
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
    await page.goto('/signup?mode=bau');
    for (const [name, value] of Object.entries({ displayName: 'Mira Steel · DEMO', fullName: 'Admin Demo', email, password: 'Synthetic-Crystal-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    const month = shiftMonth(dayKey(new Date(), 'Europe/Tirane').slice(0, 7), -1);
    const { sites } = await seedSteelProduction(companyId, month);
    const worker = await prisma.worker.create({ data: { companyProfileId: companyId, firstName: 'Mira', lastName: 'Demo', crewRole: 'FIELD_WORKER' } });
    await prisma.worker.create({ data: { companyProfileId: companyId, firstName: 'Arben', lastName: 'Demo', crewRole: 'FACTORY_WORKER' } });
    const machine = await prisma.machine.create({ data: { companyProfileId: companyId, name: 'Excavator Demo', targe: 'ZZ 101 DM', hourlyRateCents: 0 } });
    await prisma.dailyWorkPlan.create({ data: { companyProfileId: companyId, planDate: dayRange(dayKey(new Date(), 'Europe/Tirane')).start, columns: { create: { baustelleId: sites[0].id, title: sites[0].name, assignments: { create: [
      { kind: 'WORKER', workerId: worker.id, labelSnapshot: 'Mira Demo' }, { kind: 'MACHINE', machineId: machine.id, labelSnapshot: 'Excavator Demo · ZZ 101 DM' },
    ] } } } } });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const shot = async (name: string) => page.screenshot({ path: `${out}/${baseline ? 'before' : 'after'}-${name}.png` });
    for (const theme of ['light', 'dark']) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
      for (const [width, height] of [[1440, 1000], [390, 844], [320, 740], [760, 360]]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/app/dashboard?month=${month}&day=${month}-14`);
        const dashboard = page.getByTestId('steel-dashboard');
        await expect(dashboard).toBeVisible(); await fits();
        if (!baseline) {
          const tools = dashboard.getByTestId('dashboard-tools');
          expect((await tools.boundingBox())!.height).toBeLessThanOrEqual(48);
          expect((await tools.boundingBox())!.width).toBeLessThanOrEqual(150);
          for (const control of await tools.locator('button,a').all()) {
            const r = (await control.boundingBox())!;
            expect(r.width).toBeGreaterThanOrEqual(44); expect(r.height).toBeGreaterThanOrEqual(44);
          }
          if (width === 390) await expect(dashboard.getByTestId('metric-cutParts')).toBeInViewport();
        }
        await shot(`dashboard-${theme}-${width}`);
        await page.goto('/workzone/plan');
        await expect(page.getByTestId('daily-plan-editor')).toBeVisible(); await fits();
        await shot(`plan-${theme}-${width}`);
        await page.goto('/workzone');
        await page.locator('button').filter({ has: page.locator('svg.lucide-calendar-days') }).first().click();
        await expect(page.getByRole('heading', { name: /Kalendari|Calendar/ })).toBeVisible(); await fits();
        await shot(`calendar-${theme}-${width}`);
        await page.getByRole('button', { name: /Mbyll|Close/, exact: true }).click();
      }
    }
    if (baseline) return;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/workzone/plan');
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-status')).toContainText(/ruajtur/i);
    await page.getByTestId('plan-close').click(); await expect(page).toHaveURL(/\/workzone$/);
    await page.goto(`/app/dashboard?month=${month}&day=${month}-14`);
    const total = (await page.getByTestId('metric-cutParts').textContent())!;
    await page.getByTestId('dashboard-tools').locator('button').first().click();
    await expect(page.getByTestId('steel-dashboard')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('metric-cutParts')).toHaveText(total);
    await page.locator('select[aria-label]').selectOption({ index: 1 });
    await expect(page).toHaveURL(/project=/);
    await page.goto(`/display/dashboard?month=${month}&day=${month}-14`);
    await expect(page.getByTestId('steel-dashboard')).toBeVisible(); await fits();
    await page.goto('/workzone/plan');
    await page.setViewportSize({ width: 390, height: 400 });
    await expect(page.getByTestId('plan-close')).toBeInViewport();
    await expect(page.getByTestId('plan-save')).toBeInViewport(); await fits();
    await page.setViewportSize({ width: 760, height: 600 });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await fits(); await shot('plan-text-zoom');
    await page.evaluate(() => document.documentElement.style.fontSize = '');
    expect(errors).toEqual([]);
  } finally {
    if (companyId) {
      await prisma.user.deleteMany({ where: { companyProfileId: companyId } });
      await prisma.companyProfile.delete({ where: { id: companyId } });
    }
  }
});
