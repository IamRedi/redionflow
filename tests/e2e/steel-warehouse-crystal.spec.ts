import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { assetCopy } from '../../src/components/company-assets/copy';

const baseline = process.env.STEEL_WAREHOUSE_CRYSTAL_BASELINE === 'true';
test('crystal warehouse and item cards preserve stock, handovers and access', async ({ page, context, baseURL }, info) => {
  assertE2ETestDatabase(process.env); test.setTimeout(180000);
  const origin = validateE2ETarget(baseURL!).baseURL, c = assetCopy('sq');
  const out = process.env.STEEL_WAREHOUSE_CRYSTAL_EVIDENCE_DIR ?? info.outputDir;
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let companyId: string | undefined;
  try {
    const email = `warehouse-ui-${Date.now()}@example.test`; await page.goto('/signup?mode=bau');
    for (const [name, value] of Object.entries({ displayName: 'Synthetic Assets · DEMO', fullName: 'Synthetic Administrator', email, password: 'Synthetic-Warehouse-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    if (!baseline) { await page.goto('/app/inventory'); await expect(page.locator('[data-studio-warehouse]')).toHaveCount(0); }
    const seed = await seedSteelAssetsWorkshop(companyId, `crystal-${Date.now()}`);
    const records = async () => JSON.stringify({
      stock: await prisma.companyInventoryItem.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }),
      handovers: await prisma.companyAssetHandover.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }),
      grants: await prisma.accessGrant.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }),
    });
    const before = await records();
    const fits = async () => { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); for (const dialog of await page.getByRole('dialog').all()) expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); };
    const shot = async (name: string) => page.screenshot({ path: `${out}/${baseline ? 'before' : 'after'}-${name}.png` });
    for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 1000], [390, 844], [320, 740], [760, 360]]) {
      await page.setViewportSize({ width, height }); await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
      await page.goto('/workzone/inventory'); await expect(page.getByTestId('asset-warehouse')).toBeVisible();
      for (const [category, name] of [[c.tools, seed.tool.name], [c.clothing, seed.clothing.name], [c.equipment, seed.equipment.name]]) {
        await page.getByRole('tab', { name: category, exact: true }).click();
        let item = page.locator('#warehouse-items').getByRole('button').filter({ hasText: name }); await expect(item).toBeVisible(); await fits();
        await shot(`warehouse-${theme}-${width}-${category}`);
        // PR181 groups clothing without changing custody; keep this visual check compatible.
        if (await item.getAttribute('data-testid') === 'clothing-group') { await item.click(); item = page.getByTestId('clothing-unit').first(); await expect(item).toBeVisible(); }
        await item.click(); const detail = page.getByTestId('asset-detail'); await expect(detail.getByRole('heading', { name, exact: true })).toBeVisible(); await fits();
        if (!baseline && width <= 480) expect(await detail.locator('[data-studio-item-header]>div:nth-child(2)').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(130);
        await shot(`item-${theme}-${width}-${category}`);
        await page.getByRole('dialog').last().getByRole('button', { name: c.close, exact: true }).click(); await expect(item).toBeFocused();
      }
    }
    if (!baseline) {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/app/inventory');
      await expect(page.locator('[data-studio-warehouse]')).toBeVisible(); await fits(); await shot('admin-warehouse');
      await page.evaluate(() => document.documentElement.style.fontSize = '200%'); await fits(); await shot('warehouse-text-zoom');
      await page.evaluate(() => document.documentElement.style.fontSize = '');
      expect(await records()).toBe(before); expect(errors).toEqual([]);
    }
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});

test('office information is replaced by the existing schedule on the reception wall', async ({ page, context, baseURL }, info) => {
  assertE2ETestDatabase(process.env); const origin = validateE2ETarget(baseURL!).baseURL;
  const companyId = 'office-e2e-company', id = 'office-e2e-megi';
  await prisma.companyProfile.upsert({ where: { id: companyId }, update: {}, create: { id: companyId, displayName: 'Office Studio · DEMO', legalName: 'Synthetic office only', mode: 'bau', country: 'AL' } });
  const admin = await prisma.user.upsert({ where: { id }, update: {}, create: { id, companyProfileId: companyId, name: 'Office Demo', email: 'office-warehouse-ui@example.test', role: 'ADMIN' } });
  await prisma.worker.upsert({ where: { id: 'office-e2e-worker-megi' }, update: {}, create: { id: 'office-e2e-worker-megi', companyProfileId: companyId, firstName: 'Office', lastName: 'Demo', crewRole: 'OFFICE' } });
  await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', id, admin.sessionEpoch), url: origin }, { name: 'bk_lang', value: 'sq', url: origin }]);
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 1000], [390, 844], [320, 740], [760, 360]]) {
    await page.setViewportSize({ width, height }); await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
    for (const route of ['/workzone/offices/me', '/workzone/offices']) {
      await page.goto(route); await expect(page.getByTestId('office-floating-nav')).toBeVisible();
      if (!baseline) {
        await expect(page.locator('summary[aria-label="Rreth aplikacionit"]')).toHaveCount(0);
        if (route.endsWith('/offices')) {
          const plaque = page.getByTestId('office-wall-hours'); await expect(plaque).toBeVisible(); await expect(plaque).toContainText('08:00'); await expect(plaque).toContainText('16:00');
          const r = (await plaque.boundingBox())!; expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(width + 1); expect(r.y).toBeGreaterThanOrEqual(44); expect(r.y + r.height).toBeLessThanOrEqual(height);
        } else await expect(page.getByTestId('office-wall-hours')).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${process.env.STEEL_WAREHOUSE_CRYSTAL_EVIDENCE_DIR ?? info.outputDir}/${baseline ? 'before' : 'after'}-office-${route.endsWith('/me') ? 'room' : 'reception'}-${theme}-${width}.png` });
    }
  }
});
