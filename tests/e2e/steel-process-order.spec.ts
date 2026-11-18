import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { workCatalogCopy, elementProcessCopy } from '../../src/components/steel/work-catalog-copy';

// Match the existing catalogue fixture: Next bundles these JSON dictionaries;
// the native Node ESM browser-test runner reads its own expected labels.
const dictionary: unknown = JSON.parse(readFileSync(new URL('../../src/locales/sq.json', import.meta.url), 'utf8'));
function t(path: string, language: 'sq') {
  if (language !== 'sq') throw new Error('Unsupported fixture language');
  const value = path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, dictionary);
  if (typeof value !== 'string') throw new Error(`Missing fixture label: ${path}`);
  return value;
}

const c = workCatalogCopy('sq'), p = elementProcessCopy('sq');
const dialog = (page: Page) => page.getByRole('dialog').last();
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function openMaterial(page: Page, siteId: string) {
  await page.goto(`/workzone/baustellen/${siteId}`);
  await page.getByRole('button', { name: new RegExp(`^${escaped(t('elements.factoryList', 'sq'))}`) }).click();
  await page.getByRole('button').filter({ has: page.getByText('F/30', { exact: true }) }).click();
}
async function catalog(page: Page) {
  await dialog(page).getByRole('button', { name: 'Proceset', exact: true }).click();
  await dialog(page).getByRole('button', { name: p.manage, exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: c.addProcess, exact: true })).toBeEnabled();
}

test('drilling can move second, new processes choose a slot and concurrent changes preserve the open draft and existing work', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env); test.setTimeout(180_000);
  const origin = String(info.project.use.baseURL);
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
  const company = await prisma.companyProfile.create({ data: { displayName: 'Process order DEMO', legalName: 'Synthetic process ordering only', mode: 'bau', country: 'AL' } });
  const admin = await prisma.user.create({ data: { companyProfileId: company.id, name: 'Order operator DEMO', email: `order-${company.id}@example.test`, role: 'ADMIN', isActive: true } });
  try {
    const seed = await seedSteelWorkCatalog(company.id);
    const drill = await prisma.steelWorkDefinition.create({ data: { companyProfileId: company.id, kind: 'factory', key: `fp-${'d'.repeat(24)}`, label: 'Shpimi DEMO', sortOrder: 100 } });
    await prisma.siteElement.update({ where: { id: seed.elements.fresh.id }, data: { processRevision: 5, processRoutes: { v: 1, factory: ['cutting', 'assembly', drill.key], field: [] } } });
    await prisma.siteElementWork.create({ data: { companyProfileId: company.id, elementId: seed.elements.fresh.id, stage: 'cutting', pieces: 1, workerIds: [], workerNames: 'Historical crew DEMO', checkedByName: 'Historical checker DEMO', checkedAt: new Date('2026-01-05T08:00:00Z') } });
    const snapshot = async () => ({
      materials: await prisma.siteElement.findMany({ where: { companyProfileId: company.id }, orderBy: { id: 'asc' }, include: { work: { orderBy: { id: 'asc' } } } }),
      phases: await prisma.treeItem.findMany({ where: { baustelle: { companyProfileId: company.id } }, orderBy: { id: 'asc' } }),
    });
    const original = await snapshot(), assembly = seed.definitions.find(row => row.key === 'assembly')!;
    await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', admin.id, admin.sessionEpoch), url: origin }, { name: 'bk_lang', value: 'sq', url: origin }]);
    await openMaterial(page, seed.sites.aurora.id); await catalog(page);
    await dialog(page).getByRole('button', { name: `${c.edit}: ${drill.label}`, exact: true }).click();
    const position = dialog(page).getByRole('combobox', { name: c.position, exact: true });
    await position.selectOption(assembly.id);
    await expect(position.locator('option:checked')).toHaveText(`2 · ${c.after.replace('{name}', t('factory.steps.cutting', 'sq'))}`);
    for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 950 : 844 });
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
      await position.scrollIntoViewIfNeeded();
      const box = (await position.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(43.5);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(await dialog(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/process-order-${theme}-${width}.png` });
    }
    await dialog(page).getByRole('button', { name: c.save, exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: c.addProcess, exact: true })).toBeEnabled();
    await expect(dialog(page).getByRole('status')).toContainText(c.saved);
    expect(await snapshot()).toEqual(original);
    await page.goto('/workzone');
    await expect(page.locator('#fabrika [data-process-key]').first()).toBeVisible();
    expect(await page.locator('#fabrika [data-process-key]').evaluateAll(rows => rows.slice(0, 3).map(row => row.getAttribute('data-process-key')))).toEqual(['cutting', drill.key, 'assembly']);
    await openMaterial(page, seed.sites.aurora.id);
    expect(await page.getByTestId('element-process-card').evaluateAll(rows => rows.map(row => row.getAttribute('data-process-key')))).toEqual(['cutting', drill.key, 'assembly']);
    await catalog(page);
    await dialog(page).getByRole('button', { name: c.addProcess, exact: true }).click();
    await dialog(page).getByRole('textbox', { name: c.name, exact: true }).fill('Matje e re DEMO');
    await dialog(page).getByRole('textbox', { name: c.description, exact: true }).fill('Keep this draft through a concurrent order change');
    await dialog(page).getByRole('combobox', { name: c.position, exact: true }).selectOption(assembly.id);
    // A different synthetic editor adds a process after this form's snapshot.
    await prisma.steelWorkDefinition.create({ data: { companyProfileId: company.id, kind: 'factory', key: `fp-${'e'.repeat(24)}`, label: 'Concurrent process DEMO', sortOrder: 999 } });
    await dialog(page).getByRole('button', { name: c.save, exact: true }).click();
    await expect(dialog(page).getByText(c.orderConflict, { exact: true })).toBeVisible();
    await expect(dialog(page).getByRole('textbox', { name: c.name, exact: true })).toHaveValue('Matje e re DEMO');
    await expect(dialog(page).getByRole('textbox', { name: c.description, exact: true })).toHaveValue('Keep this draft through a concurrent order change');
    await expect(dialog(page).getByRole('combobox', { name: c.position, exact: true })).toHaveValue(assembly.id);
    expect(await prisma.steelWorkDefinition.count({ where: { companyProfileId: company.id, label: 'Matje e re DEMO' } })).toBe(0);
    await dialog(page).getByRole('button', { name: c.save, exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: c.addProcess, exact: true })).toBeEnabled();
    const final = await prisma.steelWorkDefinition.findMany({ where: { companyProfileId: company.id, kind: 'factory', archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    expect(final.slice(0, 4).map(row => row.key)).toEqual(['cutting', drill.key, final.find(row => row.label === 'Matje e re DEMO')!.key, 'assembly']);
    expect(final.filter(row => row.label === 'Matje e re DEMO')).toHaveLength(1);
    expect(await snapshot()).toEqual(original);
  } finally {
    await prisma.user.deleteMany({ where: { companyProfileId: company.id } });
    await prisma.companyProfile.delete({ where: { id: company.id } });
  }
});
