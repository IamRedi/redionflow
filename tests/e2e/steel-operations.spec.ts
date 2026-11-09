import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';

const baseline = process.env.STEEL_OPERATIONS_BASELINE === 'true';
const evidence = (name: string) => process.env.STEEL_OPERATIONS_EVIDENCE_DIR ? `${process.env.STEEL_OPERATIONS_EVIDENCE_DIR}/${name}` : test.info().outputPath(name);
test('fuel mistakes, planned shifts and partial material uploads stay bounded', async ({ page, context, baseURL }) => {
  test.setTimeout(180_000);
  assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let companyId: string | undefined;
  try {
    await page.goto('/signup?mode=bau');
    const email = `operations-${Date.now()}@example.test`;
    for (const [name, value] of Object.entries({ displayName: 'Synthetic Operations', fullName: 'Synthetic Chief', email, password: 'Synthetic-Operations-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    const seed = await seedSteelAssetsWorkshop(companyId, `ops-${Date.now()}`);
    await prisma.worker.update({ where: { id: seed.worker.id }, data: { crewRole: 'OFFICE' } });
    const receipt = await prisma.fuelReceipt.create({ data: { companyProfileId: companyId, machineId: seed.machines[0].id, requestId: randomUUID(), uploadedByWorkerId: seed.worker.id, uploadedByName: 'Synthetic Chief', uploadedAt: new Date(), timeZone: 'Europe/Tirane', currency: 'ALL', fileName: 'synthetic.png', mime: 'image/png', size: 100, data: new Uint8Array(await readFile('tests/fixtures/synthetic-fuel-receipt.png')), sha256: 'a'.repeat(64) } });
    for (const width of [1440, 360]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
      await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
      await page.goto('/app/machines/fuel');
      await expect(page.getByTestId('fuel-receipt-card')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: evidence(`${baseline ? 'before' : 'after'}-fuel-${theme}-${width}.png`) });
      if (!baseline) {
        await page.getByRole('button', { name: 'Fshi faturën', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Fshi faturën', exact: true })).toBeVisible();
        await page.screenshot({ path: evidence(`after-fuel-confirm-${theme}-${width}.png`) });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      await page.goto(`/workzone/admin-workers/${seed.worker.id}`);
      await expect(page.getByTestId('worker-profile')).toBeVisible();
      if (!baseline) await expect(page.getByTestId('planned-work-schedule')).toContainText('08:00–16:00');
      await page.screenshot({ path: evidence(`${baseline ? 'before' : 'after'}-schedule-${theme}-${width}.png`) });
    }
    if (baseline) return;
    await page.goto('/app/machines/fuel');
    await page.getByRole('button', { name: 'Fshi faturën', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Fshi faturën', exact: true }).click();
    await expect(page.getByTestId('fuel-receipt-card')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Fatura u fshi' })).toBeVisible();
    expect(await prisma.fuelReceipt.count({ where: { id: receipt.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { companyProfileId: companyId, action: 'fleet.fuel_deleted' } })).toBe(1);
    await page.reload();
    await expect(page.getByTestId('fuel-receipt-card')).toHaveCount(0);
    await page.goto(`/workzone/admin-workers/${seed.worker.id}`);
    await page.getByRole('button', { name: 'Fillo punen', exact: true }).click();
    expect((await page.locator('#startTime').inputValue()).slice(-5)).toBe('08:00');
    expect(await prisma.workSession.count({ where: { workerId: seed.worker.id } })).toBe(0);
    await page.goto(`/workzone/baustellen/${seed.site.id}`);
    await page.getByRole('button', { name: /Lista e fabrikës/ }).click();
    await page.getByTitle('Ngarko listat e reja (kontrollet mbeten)').click();
    const upload = page.getByRole('dialog', { name: 'Ngarko materiale', exact: true });
    await expect(upload.locator('select')).toHaveValue('merge');
    for (const width of [1440, 360]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
      await page.evaluate(value => { document.documentElement.classList.toggle('dark', value === 'dark'); document.documentElement.dataset.theme = value; }, theme);
      expect(await upload.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: evidence(`after-material-import-${theme}-${width}.png`) });
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await upload.getByRole('button', { name: 'Zgjidh skedarët' }).scrollIntoViewIfNeeded();
    await expect(upload.getByRole('button', { name: 'Zgjidh skedarët' })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    const html = '<html><body><table><tr><td>Assemb.</td><td>Q.tà</td><td>Nome</td><td>Profilo</td><td>Peso(kg) un.</td></tr><tr><td>DEMO-NEW</td><td>2</td><td>BEAM</td><td>IPE300</td><td>15</td></tr><tr><td>Totale per</td><td>2</td><td>assemblaggi</td></tr></table></body></html>';
    await page.locator('input[type=file][accept*=".xls"]').setInputFiles({ name: 'synthetic-partial.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from(html) });
    await expect(upload).toHaveCount(0);
    await expect.poll(() => prisma.siteElement.count({ where: { companyProfileId: companyId, baustelleId: seed.site.id } })).toBe(2);
    expect(await prisma.siteElementWork.count({ where: { elementId: seed.element.id } })).toBe(1);
    await expect(page.getByText('DEMO-NEW', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});
