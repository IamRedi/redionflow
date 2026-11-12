import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { assetCopy } from '../../src/components/company-assets/copy';

const baseline = process.env.STEEL_WORKSHOP_CLEAR_GLASS_BASELINE === 'true';
test('workshop empty bays stay compact, populated jobs stay usable and records do not change', async ({ page, context, baseURL }, info) => {
  assertE2ETestDatabase(process.env); test.setTimeout(180000);
  const origin = validateE2ETarget(baseURL!).baseURL, c = assetCopy('sq');
  const out = process.env.STEEL_WORKSHOP_CLEAR_GLASS_EVIDENCE_DIR ?? info.outputDir;
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let companyId: string | undefined;
  try {
    const email = `workshop-ice-${Date.now()}@example.test`; await page.goto('/signup?mode=bau');
    for (const [name, value] of Object.entries({ displayName: 'Synthetic Assets · DEMO', fullName: 'Synthetic Administrator', email, password: 'Synthetic-Workshop-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    const seed = await seedSteelAssetsWorkshop(companyId, `ice-${Date.now()}`);
    const job = async (index: number, phase: string) => {
      const asset = await prisma.companyOperationalAsset.create({ data: { companyProfileId: companyId!, machineId: seed.machines[index].id } });
      return prisma.companyAssetRepair.create({ data: { companyProfileId: companyId!, assetId: asset.id, phase, problem: `Synthetic ${phase} · DEMO`, reportedByKey: 'synthetic', reportedByName: 'Synthetic Operator', ...(phase === 'ready' ? { tested: true, repairNote: 'Synthetic tested repair' } : {}) } });
    };
    for (const index of [2, 3, 4]) await job(index, 'ready');
    const records = async () => JSON.stringify({ repairs: await prisma.companyAssetRepair.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), machines: await prisma.machine.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), grants: await prisma.accessGrant.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }) });
    for (const mode of ['empty-bays', 'mixed-bays']) {
      if (mode === 'mixed-bays') { await job(0, 'reported'); await job(1, 'repairing'); }
      const before = await records();
      for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [390, 844], [320, 740], [760, 360]]) {
        await page.setViewportSize({ width, height }); await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
        await page.goto('/app/workshop'); const space = page.getByTestId('workshop-workspace');
        await expect(page.getByTestId('workshop-history-preview')).toContainText('Aurora machine 5');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (!baseline) {
          const empty = space.locator('[data-studio-workshop-phase][data-workshop-empty=true]');
          await expect(empty).toHaveCount(mode === 'empty-bays' ? 3 : 1);
          for (const bay of await empty.all()) expect(await bay.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(56);
          for (const message of await space.getByText(c.noRepair, { exact: true }).all()) await expect(message).not.toBeVisible();
          await expect(space.locator('[data-studio-workshop-phase=ready]')).toHaveCSS('backdrop-filter', 'none');
          if (width < 1024) await expect(space.getByRole('navigation').getByRole('button').nth(1).locator('span').first()).toHaveCSS('white-space', 'normal');
        }
        await page.screenshot({ path: `${out}/${baseline ? 'before' : 'after'}-${mode}-${theme}-${width}.png` });
        const history = page.getByTestId('workshop-history-preview'); await history.getByTestId('workshop-repair-card').first().click();
        await expect(page.getByTestId('asset-detail').getByTestId('service-repair')).toBeVisible();
        await page.keyboard.press('Escape'); await expect(history.getByTestId('workshop-repair-card').first()).toBeFocused();
        if (!baseline && mode === 'mixed-bays' && width === 390) {
          await space.getByTestId('workshop-search').locator('input').fill('ZZ 002 DM');
          await expect(space.getByTestId('workshop-active-bays').getByTestId('workshop-repair-card')).toHaveCount(1);
          await space.getByTestId('workshop-search').locator('input').fill('');
          await expect(history.getByTestId('workshop-repair-card')).toHaveCount(3);
        }
      }
      expect(await records()).toBe(before);
    }
    if (!baseline) {
      await prisma.companyAssetRepair.updateMany({ where: { companyProfileId: companyId }, data: { phase: 'cancelled' } });
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/app/workshop');
      await expect(page.getByTestId('workshop-workspace')).toHaveAttribute('data-workshop-state', 'empty');
      await expect(page.getByTestId('workshop-history-grid')).not.toBeVisible();
      await page.screenshot({ path: `${out}/after-completely-empty-phone.png` });
      expect(errors).toEqual([]);
    }
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});
