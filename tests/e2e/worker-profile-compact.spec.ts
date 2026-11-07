import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';

const baseline = process.env.WORKER_PROFILE_BASELINE === 'true';
const evidence = (name: string) => process.env.WORKER_PROFILE_EVIDENCE_DIR
  ? `${process.env.WORKER_PROFILE_EVIDENCE_DIR}/${name}` : test.info().outputPath(name);

test('worker profile keeps summaries compact and documents available on demand', async ({ page, context, browser, baseURL }) => {
  test.setTimeout(150_000);
  assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let companyId: string | undefined;
  let workerContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const email = `compact-profile-${Date.now()}@example.test`;
    await page.goto('/signup?mode=bau');
    for (const [name, value] of Object.entries({ displayName: 'Synthetic profile', fullName: 'Synthetic Administrator', email, password: 'Synthetic-Profile-Only-2026!' }))
      await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    const seed = await seedSteelAssetsWorkshop(companyId, `profile-${Date.now()}`);
    await prisma.worker.update({ where: { id: seed.worker.id }, data: { firstName: 'Arben', lastName: 'Profili · DEMO', position: 'Inxhinier' } });
    const profileUrl = `/workzone/admin-workers/${seed.worker.id}`;
    for (const theme of ['light', 'dark']) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
      for (const width of [1440, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(profileUrl);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: evidence(`${baseline ? 'before' : 'after'}-profile-${theme}-${width}.png`) });
        if (baseline) continue;
        await expect(page.getByTestId('worker-documents')).toHaveCount(0);
        const metrics = page.getByTestId('worker-profile-metrics');
        expect((await metrics.boundingBox())!.height).toBeLessThanOrEqual(72);
        await expect(metrics.getByRole('link')).toHaveCount(3);
        for (const link of await metrics.getByRole('link').all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.getByTestId('worker-documents-open').click();
        const dialog = page.getByRole('dialog', { name: 'Dokumentet', exact: true });
        await expect(dialog).toBeVisible();
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: evidence(`after-documents-${theme}-${width}.png`) });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(page.getByTestId('worker-documents-open')).toBeFocused();
      }
    }
    if (baseline) return;

    await page.getByTestId('worker-documents-open').click();
    const documents = page.getByTestId('worker-documents');
    await documents.locator('input[type=file]').setInputFiles({ name: 'Synthetic profile.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic profile document\n%%EOF') });
    await expect(documents.getByRole('link', { name: /Synthetic profile/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('worker-documents-open')).toContainText('1');
    await page.getByTestId('worker-documents-open').click();
    await expect(documents.getByRole('link', { name: /Synthetic profile/ })).toBeVisible();
    await documents.getByRole('button', { name: 'Fshi dokumentin', exact: true }).click();
    await documents.getByRole('button', { name: 'Fshi', exact: true }).click();
    await expect(documents.getByRole('link')).toHaveCount(0);
    expect((await prisma.worker.findUniqueOrThrow({ where: { id: seed.worker.id } })).documents).toEqual([]);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByTestId('worker-documents-open').click();
    await expect(page.getByRole('button', { name: 'Mbyll', exact: true })).toBeVisible();
    expect(await page.getByRole('dialog', { name: 'Dokumentet', exact: true }).evaluate(el => el.scrollHeight > el.clientHeight ? getComputedStyle(el).maxHeight !== 'none' : true)).toBe(true);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByTestId('worker-documents-open')).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

    workerContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
    await workerContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
    await workerContext.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
    const workerPage = await workerContext.newPage();
    await workerPage.goto('/workzone/login');
    await workerPage.locator('input[name=name]').fill('Arben');
    await workerPage.locator('input[name=loginCode]').fill(seed.workerCode);
    await workerPage.locator('button[type=submit]').click();
    await expect(workerPage).toHaveURL(/\/workzone\/profile$/);
    await expect(workerPage.getByTestId('worker-documents-open')).toBeVisible();
    await workerPage.getByTestId('worker-documents-open').click();
    await expect(workerPage.getByTestId('worker-documents').locator('input[type=file]')).toHaveCount(1);
    await workerPage.keyboard.press('Escape');
    await expect(workerPage.getByTestId('worker-documents-open')).toBeFocused();
    await workerPage.getByTestId('worker-profile-metrics').getByRole('link').first().click();
    await expect(workerPage).toHaveURL(/\/workzone\/profile\/day\//);
    expect(errors).toEqual([]);
  } finally {
    await workerContext?.close();
    if (companyId) await cleanupSteelAssetsWorkshop(companyId);
  }
});
