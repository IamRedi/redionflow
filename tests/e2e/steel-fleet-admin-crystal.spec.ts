import { expect, test, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { assetCopy } from '../../src/components/company-assets/copy';

const baseline = process.env.STEEL_FLEET_ADMIN_CRYSTAL_BASELINE === 'true';
test('fleet, machine cards and administration keep real records and actions behind compact crystal UI', async ({ page, context, baseURL }, info) => {
  assertE2ETestDatabase(process.env); test.setTimeout(300000);
  const origin = validateE2ETarget(baseURL!).baseURL, c = assetCopy('sq');
  const out = process.env.STEEL_FLEET_ADMIN_CRYSTAL_EVIDENCE_DIR ?? info.outputDir;
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let companyId: string | undefined;
  const fit = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const dialog of await page.getByRole('dialog').all()) expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  };
  const shot = async (name: string) => page.screenshot({ path: `${out}/${baseline ? 'before' : 'after'}-${name}.png` });
  try {
    const email = `fleet-ui-${Date.now()}@example.test`; await page.goto('/signup?mode=bau');
    for (const [name, value] of Object.entries({ displayName: 'Synthetic Assets · DEMO', fullName: 'Synthetic Administrator', email, password: 'Synthetic-Fleet-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email } }); companyId = admin.companyProfileId!;
    if (!baseline) { await page.goto('/app/settings'); await expect(page.locator('[data-studio-admin]')).toHaveCount(0); }
    const seed = await seedSteelAssetsWorkshop(companyId, `fleet-ui-${Date.now()}`);
    await prisma.machine.update({ where: { id: seed.machines[0].id }, data: { model: 'Synthetic model', insuranceDate: new Date('2027-05-20T00:00:00Z') } });
    for (const [i, phase] of ['reported', 'received', 'repairing', 'ready'].entries()) {
      const asset = await prisma.companyOperationalAsset.create({ data: { companyProfileId: companyId, machineId: seed.machines[i + 2].id } });
      await prisma.companyAssetRepair.create({ data: { companyProfileId: companyId, assetId: asset.id, phase, problem: `Synthetic ${phase} · DEMO`, reportedByKey: 'synthetic', reportedByName: 'Synthetic Operator', ...(phase === 'ready' ? { tested: true, repairNote: 'Synthetic complete repair' } : {}) } });
    }
    const photo = await sharp({ create: { width: 160, height: 100, channels: 3, background: '#e4dac7' } }).png().toBuffer();
    await prisma.fuelReceipt.create({ data: { companyProfileId: companyId, machineId: seed.machines[0].id, requestId: randomUUID(), uploadedByUserId: admin.id, uploadedByName: 'Synthetic Administrator', fueledByName: 'Synthetic Operator', fueledByWorkerId: seed.worker.id, timeZone: 'Europe/Tirane', currency: 'ALL', liters: 40, amount: 2500, confirmedAt: new Date(), fueledAt: new Date('2026-11-10T10:00:00Z'), fileName: 'synthetic-receipt-demo.png', mime: 'image/png', size: photo.length, data: photo, sha256: createHash('sha256').update(photo).digest('hex'), gpsStatus: 'resolved', gpsLat: 41.123, gpsLng: 19.456 } });
    await prisma.auditLog.create({ data: { companyProfileId: companyId, actorType: 'ADMIN', actorId: admin.id, action: 'synthetic.visual-review-only', payload: { demo: true, note: 'Synthetic audit evidence with a long reference for narrow screens', reference: 'SYNTHETIC-REFERENCE-ONLY-ABCDEFGHIJKLMNOPQRSTUVWXYZ-123456789' } } });
    const records = async () => JSON.stringify({ machines: await prisma.machine.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), receipts: await prisma.fuelReceipt.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), repairs: await prisma.companyAssetRepair.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), grants: await prisma.accessGrant.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }) });
    const before = await records();
    for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 1000], [390, 844], [320, 740], [760, 360]]) {
      await page.setViewportSize({ width, height }); await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]); await page.goto('/workzone');
      await page.getByTestId('fleet-dock-open').click(); const picker = page.getByTestId('fleet-picker');
      await expect(picker.locator('[data-machine-id]')).toHaveCount(12); if (width < 500) expect(await picker.getByTestId('fleet-card-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
      await fit(); await shot(`fleet-${theme}-${width}`);
      await picker.getByTestId('fleet-search').fill('ZZ 001 DM'); await expect(picker.locator('[data-machine-id]')).toHaveCount(1); await picker.locator('[data-machine-id]').click();
      const card = page.getByTestId('fleet-machine-card'); await expect(card).toBeVisible(); await expect(card).toContainText('ZZ 001 DM');
      const maps = card.locator('a[href*="google.com/maps"]'); await expect(maps).toHaveAttribute('href', /41\.123/); await expect(maps).toHaveAttribute('href', /19\.456/);
      await expect(card.locator(`a[href="/workzone/fuel?machine=${seed.machines[0].id}"]`)).toBeVisible(); await fit(); await shot(`machine-${theme}-${width}`);
      await card.getByTestId('fleet-machine-edit').click(); const editor = page.getByTestId('machine-editor'); await expect(editor).toBeVisible(); await expect(editor.locator('input[name=insuranceDate]')).toHaveValue('2027-05-20'); await fit(); await shot(`machine-edit-${theme}-${width}`);
      await editor.getByRole('button', { name: c.cancel, exact: true }).click(); await expect(editor).toHaveCount(0);
      await card.getByTestId('fleet-machine-workshop').click(); await expect(page.getByTestId('asset-detail')).toBeVisible(); await fit(); await shot(`machine-service-${theme}-${width}`); await page.keyboard.press('Escape');
      // These are independent read-only entries; no provider sync, clock or repair commands.
      const routes: [string, string][] = [['workshop', '/app/workshop'], ['personnel', '/app/admin'], ['gps', '/app/fleet-gps'], ['gps-detail', `/app/fleet-gps/${seed.machines[0].id}`], ['vehicle-file', `/app/admin/machines/${seed.machines[0].id}`], ['fuel', '/app/machines/fuel'], ['sites', '/app/baustellen'], ['settings', '/app/settings'], ['audit', '/app/audit']];
      for (const [name, route] of routes) {
        if (width !== 1440 && width !== 390 && !['workshop', 'settings', 'audit', 'fuel'].includes(name)) continue;
        await page.goto(route); await expect(page.locator('[data-testid=app-workspace-scroll]')).toBeVisible();
        if (name === 'workshop') await expect(page.getByTestId('workshop-history-preview')).toContainText('Aurora machine 6');
        if (!baseline) { await expect(page.locator('[data-studio-admin]')).toBeVisible(); await fit(); }
        await shot(`admin-${name}-${theme}-${width}`);
        if (!baseline && name === 'workshop') { await expect(page.getByTestId('workshop-workspace').getByRole('heading', { level: 1 })).toHaveCSS('background-image', /linear-gradient/); await expect(page.getByTestId('workshop-history-preview')).toContainText('Aurora machine 6'); await expect(page.getByTestId('workshop-workspace')).toHaveCSS('background-image', /workshop\.webp/); }
      }
    }
    if (!baseline) {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/app/settings'); await page.evaluate(() => document.documentElement.style.fontSize = '200%'); await fit(); await shot('settings-text-zoom'); await page.evaluate(() => document.documentElement.style.fontSize = '');
      const scroll = page.getByTestId('app-workspace-scroll'); await scroll.evaluate(el => el.scrollTop = el.scrollHeight); const footer = scroll.getByRole('link', { name: 'by RediON', exact: true }); await expect(footer).toBeInViewport();
      await scroll.evaluate(el => el.scrollTop = 0); await expect(footer).not.toBeInViewport(); expect(await records()).toBe(before); expect(errors).toEqual([]);
    }
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});
