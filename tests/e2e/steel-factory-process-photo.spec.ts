import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { removeSecurityTenants } from '../security/fixtures';
import { STEEL_ILLUSTRATION_STYLE_VERSION } from '../../src/lib/steel-work/illustration-style';

test('factory process cards reuse saved visuals and photographic defaults without changing confirmed work', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env); test.setTimeout(120_000);
  const origin = String(info.project.use.baseURL);
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  const company = await prisma.companyProfile.create({ data: { displayName: 'Factory photos DEMO', legalName: 'Synthetic factory photo check', mode: 'bau', country: 'AL' } });
  const foreign = await prisma.companyProfile.create({ data: { displayName: 'Other company DEMO', legalName: 'Synthetic other company', mode: 'bau', country: 'AL' } });
  const admin = await prisma.user.create({ data: { companyProfileId: company.id, name: 'Photo operator DEMO', email: `factory-photo-${company.id}@example.test`, role: 'ADMIN', isActive: true } });
  const other = await prisma.user.create({ data: { companyProfileId: foreign.id, name: 'Other operator DEMO', email: `factory-photo-other-${foreign.id}@example.test`, role: 'ADMIN', isActive: true } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await prisma.baustelle.create({ data: { companyProfileId: company.id, name: 'Punishtja DEMO', type: 'STEEL_WORKSHOP' } });
    const site = await prisma.baustelle.create({ data: { companyProfileId: company.id, name: 'Photo site DEMO', type: 'STEEL_ASSEMBLY' } });
    const at = new Date('2026-01-05T08:00:00Z');
    const generated = await prisma.steelWorkDefinition.create({ data: { companyProfileId: company.id, key: 'fp-photo-drill-demo', kind: 'factory', label: 'Shpime DEMO', sortOrder: 10, visualStatus: 'generated', visualUpdatedAt: at } });
    const uploaded = await prisma.steelWorkDefinition.create({ data: { companyProfileId: company.id, key: 'fp-photo-upload-demo', kind: 'factory', label: 'Lyerje e personalizuar DEMO', sortOrder: 11, visualStatus: 'photo', visualUpdatedAt: at } });
    const fallback = await prisma.steelWorkDefinition.create({ data: { companyProfileId: company.id, key: 'fp-photo-fallback-demo', kind: 'factory', label: 'Shpime pa foto DEMO', sortOrder: 12 } });
    const bytes = readFileSync(new URL('../../public/steel-process-photos-v1/drilling.webp', import.meta.url));
    for (const definition of [generated, uploaded]) await prisma.steelWorkVisual.create({ data: { companyProfileId: company.id, definitionId: definition.id, mime: 'image/webp', data: bytes, scene: { style: STEEL_ILLUSTRATION_STYLE_VERSION } } });
    const element = await prisma.siteElement.create({ data: { companyProfileId: company.id, baustelleId: site.id, list: 'assembly', mark: 'PHOTO/1', quantity: 4, weightKg: 12, processRoutes: { v: 1, factory: ['cutting', generated.key, uploaded.key, fallback.key], field: [] } } });
    await prisma.siteElementWork.create({ data: { companyProfileId: company.id, elementId: element.id, stage: generated.key, pieces: 2, workerIds: [], workerNames: 'Historical crew DEMO', checkedByName: 'Historical checker DEMO', checkedAt: at } });
    const records = () => prisma.siteElement.findMany({ where: { companyProfileId: company.id }, orderBy: { id: 'asc' }, include: { work: { orderBy: { id: 'asc' } } } });
    const before = await records(), quota = await prisma.assistantQuotaBucket.count({ where: { companyProfileId: company.id } });
    await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', admin.id, admin.sessionEpoch), url: origin }, { name: 'bk_lang', value: 'sq', url: origin }]);
    await page.goto('/workzone');
    const card = (key: string) => page.locator(`#fabrika [data-process-key="${key}"]`);
    const src = `/api/steel-work-visuals/${generated.id}?v=${at.getTime()}`;
    await expect(card(generated.key).locator('img')).toHaveAttribute('src', src);
    await expect(card(uploaded.key).locator('img')).toHaveAttribute('src', `/api/steel-work-visuals/${uploaded.id}?v=${at.getTime()}`);
    await expect(card(fallback.key).locator('img')).toHaveAttribute('src', '/steel-process-photos-v1/drilling.webp');
    await expect(card('cutting').locator('img')).toHaveAttribute('src', '/steel-process-photos-v1/cutting.webp');
    const response = await context.request.get(src);
    expect(response.status()).toBe(200); expect(response.headers()['content-type']).toBe('image/webp'); expect(response.headers()['cache-control']).toContain('private');
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(createHash('sha256').update(bytes).digest('hex'));
    for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 950 : 844 });
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
      await card(generated.key).scrollIntoViewIfNeeded();
      await expect.poll(() => card(generated.key).locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/factory-process-photo-${theme}-${width}.png` });
    }
    const newer = new Date(at.getTime() + 60_000);
    await prisma.steelWorkDefinition.update({ where: { id: generated.id }, data: { visualUpdatedAt: newer } });
    await page.reload(); await expect(card(generated.key).locator('img')).toHaveAttribute('src', `/api/steel-work-visuals/${generated.id}?v=${newer.getTime()}`);
    await context.route(`**/api/steel-work-visuals/${generated.id}?*`, route => route.fulfill({ status: 404 }));
    await page.reload(); await expect(card(generated.key).locator('img')).toHaveAttribute('src', '/steel-process-photos-v1/drilling.webp');
    await context.unroute(`**/api/steel-work-visuals/${generated.id}?*`);
    expect(await records()).toEqual(before); expect(await prisma.assistantQuotaBucket.count({ where: { companyProfileId: company.id } })).toBe(quota); expect(errors).toEqual([]);
    await context.clearCookies(); await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', other.id, other.sessionEpoch), url: origin }]);
    expect((await context.request.get(src)).status()).toBe(404);
  } finally { await removeSecurityTenants([company.id, foreign.id]); }
});
