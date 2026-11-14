import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelProduction } from '../fixtures/steel-production';

test('steel workspace uses the screen, compact calendar, quiet footer and company fuel log', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(240_000);
  const baseline = process.env.DENSITY_BASELINE === 'true';
  const email = `density-${Date.now()}@example.test`, errors: string[] = [];
  let companyId: string | undefined, otherCompanyId: string | undefined;
  page.on('pageerror', e => errors.push(e.message));
  await context.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e5eddf"/><path d="M0 200L256 30" stroke="white" stroke-width="16"/><text x="15" y="240" font-size="10">DEMO MAP · synthetic tile</text></svg>' }));
  await context.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [] }));
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }]);
    await page.goto('/signup?mode=bau');
    for (const [key, value] of Object.entries({ displayName: 'Mira Steel · DEMO', fullName: 'Admin Demo', email, password: 'Synthetic-Steel-Demo-123!' })) await page.locator(`input[name="${key}"]`).fill(value);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    companyId = user.companyProfileId!;
    await seedSteelProduction(companyId, '2026-10');
    await prisma.worker.createMany({ data: Array.from({ length: 24 }, (_, i) => ({ companyProfileId: companyId!, firstName: `Demo ${i + 1}`, lastName: `Crew ${i + 1}` })) });
    const machines = [];
    for (let i = 0; i < 18; i++) machines.push(await prisma.machine.create({ data: { companyProfileId: companyId, name: `Kamioni demo ${i + 1}`, nickname: 'Kamioni demo', targe: `DEMO-${i + 1}`, hourlyRateCents: 0, ...(i === 0 ? { gpsEnabled: true, lastGpsLat: 52.49, lastGpsLng: 13.38, lastGpsAt: new Date() } : {}) } }));
    await prisma.fuelReceipt.createMany({ data: Array.from({ length: 65 }, (_, i) => ({ companyProfileId: companyId!, machineId: machines[i % 2].id, requestId: `synthetic-density-${i}`, uploadedByUserId: user.id, uploadedByName: 'Admin Demo', uploadedAt: new Date(Date.UTC(2026, 9, 31, 12, 0, -i)), fueledByUserId: user.id, fueledByName: 'Operator Demo', fueledAt: new Date('2026-10-31T11:00Z'), confirmedAt: new Date('2026-10-31T12:00Z'), timeZone: 'Europe/Tirane', receiptTime: '2026-10-31T12:00', timeSource: 'manual', stationAddress: 'Stacioni demonstrues', liters: 42, amount: 7000, currency: 'ALL', fileName: 'synthetic-receipt.png', mime: 'image/png', size: 1, data: Buffer.from('synthetic'), sha256: 'synthetic', gpsStatus: 'matched', gpsLat: 52.49, gpsLng: 13.38, gpsRecordedAt: new Date('2026-10-31T10:59Z'), gpsDeltaSeconds: -60, gpsEvidence: [{ recordedAt: '2026-10-31T10:59Z' }, { recordedAt: '2026-10-31T11:01Z' }] })) });
    otherCompanyId = (await prisma.companyProfile.create({ data: { legalName: 'Other Synthetic Company', displayName: 'Other Synthetic Company', mode: 'bau' } })).id;
    const foreignMachine = await prisma.machine.create({ data: { companyProfileId: otherCompanyId, name: 'Foreign vehicle', hourlyRateCents: 0 } });
    await prisma.fuelReceipt.create({ data: { companyProfileId: otherCompanyId, machineId: foreignMachine.id, requestId: 'foreign-density', uploadedByUserId: 'foreign-user', uploadedByName: 'FOREIGN-RECEIPT', timeZone: 'Europe/Tirane', currency: 'ALL', fileName: 'synthetic.png', mime: 'image/png', size: 1, data: Buffer.from('x'), sha256: 'synthetic' } });
    for (const theme of ['light', 'dark']) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      for (const [width, height] of [[1440, 950], [360, 800], [760, 360], [320, 640]]) {
        await page.setViewportSize({ width, height });
        await page.goto('/app/dashboard?month=2026-10&day=2026-10-14');
        await expect(page.getByTestId('steel-dashboard')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const state = await page.evaluate(() => {
          const root = document.querySelector('[data-testid="steel-dashboard"]')!, credit = document.querySelector('a[aria-label="by RediON"]')!, footer = credit.closest('footer')!;
          const day = document.querySelector('[data-testid="production-day-2026-10-14"]')!;
          const r = root.getBoundingClientRect(), f = footer.getBoundingClientRect(), c = credit.getBoundingClientRect();
          const main=document.querySelector('[data-testid="app-workspace-scroll"]')!.getBoundingClientRect();
          const dock=document.querySelector('[data-testid="fleet-rail"]')?.closest('aside')?.getBoundingClientRect();
          const occupiedRight=dock&&dock.left>=main.right?innerWidth-dock.left:0;
          return { width: innerWidth, rightGap: main.right-r.right, unusedOuterRight:innerWidth-main.right-occupiedRight, outerHeight: document.documentElement.scrollHeight, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, dayHeight: day.getBoundingClientRect().height, footerHeight: f.height, footerBg: getComputedStyle(footer).backgroundColor, creditOffset: Math.abs(c.x + c.width / 2 - f.x - f.width / 2), bodyHeight: document.body.getBoundingClientRect().height, bodyOverflow: getComputedStyle(document.body).overflow };
        });
        console.log('DENSITY', JSON.stringify({ baseline, theme, ...state }));
        await page.screenshot({ path: info.outputPath(`${baseline ? 'before' : 'after'}-dashboard-${theme}-${width}.png`) });
        await page.getByTestId('production-day-2026-10-14').scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`${baseline ? 'before' : 'after'}-calendar-${theme}-${width}.png`) });
        if (!baseline) {
          expect(state.overflow).toBe(false);
          expect(state.outerHeight).toBeLessThanOrEqual(height + 1);
          expect(state.rightGap).toBeLessThanOrEqual(32);
          expect(state.unusedOuterRight).toBeLessThanOrEqual(32);
          expect(state.dayHeight).toBeLessThanOrEqual(76);
          expect(state.footerHeight).toBeLessThanOrEqual(48);
          expect(state.footerBg).toBe('rgba(0, 0, 0, 0)');
          expect(state.creditOffset).toBeLessThan(1);
          await expect(page.getByTestId('flow-global-tools')).not.toContainText('Bau');
          await expect(page.getByRole('link', { name: 'by RediON', exact: true })).toHaveCount(1);
          await expect(page.getByRole('link', { name: 'by RediON', exact: true }).locator('..')).toHaveText('byRediON');
          await expect(page.getByTestId('steel-dashboard')).not.toContainText(/0[1-4] \/ /);
          const scroll = page.getByTestId('app-workspace-scroll');
          await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
          await expect(page.getByTestId('production-evidence-toggle')).toBeVisible();
          await expect(page.getByRole('link', { name: 'by RediON', exact: true })).toBeInViewport();
        }
        await page.goto('/workzone?view=map');
        const index = page.getByTestId('workzone-map-index');
        await expect(index).toBeVisible();
        await page.screenshot({ path: info.outputPath(`${baseline ? 'before' : 'after'}-map-${theme}-${width}.png`) });
        if (!baseline) {
          await expect(page.getByTestId('fleet-rail').locator('a[href="/workzone/fuel"]')).toHaveCount(0);
          expect(await index.evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('none');
          const state = await page.evaluate(() => ({ outer: document.documentElement.scrollHeight, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth }));
          expect(state.outer).toBeLessThanOrEqual(state.height + 1);
          expect(state.overflow).toBe(false);
          const last = index.getByRole('button', { name: 'Zmadhim: Kamioni demo · DEMO-18', exact: true });
          await index.scrollIntoViewIfNeeded();
          await index.focus();
          await page.keyboard.press('End');
          await last.scrollIntoViewIfNeeded();
          await expect(last).toBeInViewport();
          if (width === 1440) {
            await page.getByTestId('fleet-dock-open').click();
            await page.getByTestId('fleet-card-grid').getByRole('button').first().click();
            await expect(page.getByTestId('fleet-machine-card').getByRole('link', { name: 'Ngarko karburant', exact: true })).toHaveAttribute('href', /\/workzone\/fuel\?machine=/);
            await page.keyboard.press('Escape');await page.keyboard.press('Escape');
          }
        }
      }
      if (!baseline) {
        for (const [width, height] of [[1920, 1080], [360, 800]]) {
          await page.setViewportSize({ width, height });
          await page.goto('/display/dashboard?month=2026-10&day=2026-10-14');
          await expect(page.getByTestId('production-day-2026-10-14')).toBeVisible();
          await expect(page.getByTestId('production-evidence-toggle')).toHaveCount(0);
          await expect(page.getByRole('link', { name: 'by RediON', exact: true })).toHaveCount(1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`after-monitor-${theme}-${width}.png`) });
        }
      }
    }
    if (!baseline) {
      await page.setViewportSize({ width: 1440, height: 950 });
      await page.goto('/app/admin#machines');
      await page.getByRole('link', { name: 'Karburanti', exact: true }).click();
      await expect(page).toHaveURL(/\/app\/machines\/fuel$/);
      await expect(page.locator('input[type="file"]')).toHaveCount(0);
      const cards = page.getByTestId('fuel-receipt-card');
      await expect(cards).toHaveCount(60);
      await expect(cards.first()).toContainText('Operator Demo');
      await expect(cards.first()).toContainText('Admin Demo');
      await expect(cards.first()).toContainText('Stacioni demonstrues');
      await expect(cards.first()).toContainText('7000 ALL');
      await page.screenshot({ path: info.outputPath('after-fuel-log-desktop.png') });
      const older = page.getByRole('button', { name: 'Faturat më të vjetra', exact: true });
      await older.scrollIntoViewIfNeeded();
      const lastBefore = (await cards.nth(59).boundingBox())!.y;
      await older.click();
      await expect(cards).toHaveCount(65);
      await expect(page.getByTestId('app-workspace-scroll')).not.toContainText('FOREIGN-RECEIPT');
      expect(Math.abs((await cards.nth(59).boundingBox())!.y - lastBefore)).toBeLessThan(2);
      await cards.last().scrollIntoViewIfNeeded();
      await expect(cards.last()).toBeInViewport();
      await page.setViewportSize({ width: 360, height: 800 });
      await cards.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('after-fuel-log-mobile.png') });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const credit = page.getByRole('link', { name: 'by RediON', exact: true });
      await credit.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(credit).toBeFocused();
      expect(await credit.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
      await page.goto('/app/dashboard?month=2026-10&day=2026-10-14');
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
      expect(await page.getByTestId('flow-global-tools').evaluate(el => [...el.querySelectorAll('a,button')].filter(n => n.getClientRects().length).every(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }))).toBe(true);
      await page.getByTestId('production-evidence-toggle').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('production-evidence-toggle')).toBeInViewport();
      await page.screenshot({ path: info.outputPath('after-text-zoom-200.png') });
      await page.goto('/landing');
      await expect(page.getByRole('link', { name: 'by RediON', exact: true })).toHaveCount(1);
      await page.getByRole('link', { name: 'by RediON', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('after-landing-footer.png') });
    }
    expect(errors).toEqual([]);
  } finally {
    if (companyId) { await prisma.user.deleteMany({ where: { companyProfileId: companyId } }); await prisma.companyProfile.delete({ where: { id: companyId } }); }
    if (otherCompanyId) await prisma.companyProfile.delete({ where: { id: otherCompanyId } });
  }
});
