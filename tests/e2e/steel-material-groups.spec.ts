import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';
import { elementProcessCopy } from '../../src/components/steel/work-catalog-copy';

test('material groups retain crystal layout and resolve exact part codes without changing confirmed work', async ({ page, context }, info) => {
  test.setTimeout(180000); assertE2ETestDatabase(process.env);
  const baseline = process.env.MATERIAL_GROUPS_BASELINE === 'true';
  const base = String(info.project.use.baseURL);
  const company = await prisma.companyProfile.create({ data: { displayName: 'Materials · DEMO', legalName: 'Synthetic materials only', mode: 'bau', country: 'AL' } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
  try {
    const admin = await prisma.user.create({ data: { companyProfileId: company.id, email: `materials-${company.id}@example.test`, name: 'Planner DEMO', role: 'ADMIN', isActive: true } });
    const seed = await seedSteelWorkCatalog(company.id);
    if (!baseline) await prisma.siteElement.update({ where: { id: seed.elements.beam.id }, data: { assemblyParts: { v: 1, sourceFile: 'composition-demo.xls', importedAt: '2026-11-17T09:00:00Z', parts: [{ mark: 'b/1', quantity: 2 }, { mark: 'MISSING', quantity: 1 }] } } });
    await prisma.siteElement.create({ data: { companyProfileId: company.id, baustelleId: seed.sites.aurora.id, list: 'part', mark: 'b/1', profile: 'SHS40*2', quantity: 8 } });
    await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', admin.id, admin.sessionEpoch), url: base }, { name: 'bk_lang', value: 'sq', url: base }]);
    for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await context.addCookies([{ name: 'bk_theme', value: theme, url: base }]);
      await page.goto(`/workzone/baustellen/${seed.sites.aurora.id}`);
      await page.locator('[data-studio-list-open]').first().click();
      const dialog = page.getByRole('dialog').last();
      await expect(dialog.getByText('B/20', { exact: true }).first()).toBeVisible();
      await expect.poll(() => dialog.evaluate(e => getComputedStyle(e).opacity)).toBe('1');
      expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/${baseline ? 'before' : 'after'}-materials-${theme}-${width}.png` });
      if (!baseline) {
        await expect(dialog.getByTestId('material-groups').getByRole('button')).toHaveCount(3);
        await dialog.getByRole('button').filter({ has: page.getByText('B/20', { exact: true }) }).click();
        const composition = dialog.getByTestId('assembly-composition');
        await expect(composition.getByText('Ende mungon te Single Parts')).toBeVisible();
        await expect(composition.getByText(/composition-demo.xls/)).toBeVisible();
        await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/after-composition-${theme}-${width}.png` });
        await composition.getByRole('button', { name: 'Hap Single Part b/1', exact: true }).click();
        await expect(dialog.getByText('b/1', { exact: true }).first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Kthehu te lista' }).click();
        await expect(dialog.getByTestId('assembly-composition')).toBeVisible();
        await dialog.getByRole('button', { name: 'Kthehu te lista' }).click();
        await dialog.getByTestId('material-groups').getByRole('button', { name: /Elementet/ }).click();
        await dialog.getByRole('button', { name: /Shto element/ }).click();
        const form = page.getByRole('dialog').last();
        await form.getByLabel('Kodi', { exact: true }).fill(`MAN-${theme}-${width}`);
        await form.getByLabel('Emri', { exact: true }).fill('Paketim manual DEMO');
        expect(await form.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/after-manual-${theme}-${width}.png` });
        await form.getByRole('button', { name: 'Shto', exact: true }).click();
        await expect.poll(() => prisma.siteElement.count({ where: { companyProfileId: company.id, isManual: true, mark: `MAN-${theme}-${width}` } })).toBe(1);
        const manual = await prisma.siteElement.findFirstOrThrow({ where: { companyProfileId: company.id, mark: `MAN-${theme}-${width}` } });
        expect(manual.processRoutes).toEqual({ v: 1, factory: [], field: [] });
        expect(manual.factoryDoneAt).toBeNull();
        const editor = page.getByRole('dialog', { name: elementProcessCopy('sq').title, exact: true });
        await expect(editor).toBeVisible();
        await expect(editor.locator('input[type="checkbox"]:checked')).toHaveCount(0);
        expect(await editor.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        await editor.getByRole('checkbox').first().check();
        await editor.getByRole('button', { name: elementProcessCopy('sq').apply, exact: true }).click();
        await expect.poll(async () => (await prisma.siteElement.findUniqueOrThrow({ where: { id: manual.id } })).processRevision).toBe(2);
        await expect(editor).not.toBeVisible();
      }
    }
    expect(await prisma.siteElementWork.count({ where: { companyProfileId: company.id } })).toBe(6);
    expect(errors).toEqual([]);
  } finally {
    // Close our context before removing its synthetic tenant. Persistent realtime
    // connections are not a network-idle readiness signal.
    await context.close();
    await prisma.user.deleteMany({ where: { companyProfileId: company.id } });
    await prisma.companyProfile.delete({ where: { id: company.id } });
  }
});
