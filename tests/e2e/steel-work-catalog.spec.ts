import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { prisma } from '../../src/lib/db/prisma';
import { doneQty } from '../../src/lib/elements/stages';
import { elementProcessCopy, workCatalogCopy } from '../../src/components/steel/work-catalog-copy';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';

const c = workCatalogCopy('sq'), p = elementProcessCopy('sq');
// Read the expected UI labels without importing Next's bundled JSON dictionaries
// into Node's native ESM runner.
const dictionary: unknown = JSON.parse(readFileSync(new URL('../../src/locales/sq.json', import.meta.url), 'utf8'));
function t(path: string, language: 'sq') {
  if (language !== 'sq') throw new Error('Unsupported fixture language');
  const value = path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, dictionary);
  if (typeof value !== 'string') throw new Error(`Missing fixture label: ${path}`);
  return value;
}
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dialog = (page: Page) => page.getByRole('dialog').last();
const selected = (page: Page, label: string) => dialog(page).getByRole('checkbox', { name: `${c.select}: ${label}`, exact: true });
async function openCatalog(page: Page) {
  await page.getByRole('button', { name: t('steel.addTask', 'sq'), exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: c.add, exact: true })).toBeEnabled();
}
async function edit(page: Page, label: string) { await dialog(page).getByRole('button', { name: `${c.edit}: ${label}`, exact: true }).click(); }
async function close(page: Page) { await dialog(page).getByRole('button', { name: c.close, exact: true }).click(); }
async function save(page: Page) {
  await dialog(page).getByRole('button', { name: c.save, exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: c.add, exact: true }).or(dialog(page).getByRole('button', { name: c.addProcess, exact: true }))).toBeEnabled();
}
async function reachable(control: Locator, width: number, height: number) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box).not.toBeNull(); expect(box!.width).toBeGreaterThanOrEqual(43.5); expect(box!.height).toBeGreaterThanOrEqual(43.5);
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1); expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
}

test('shared catalog, historical selections, linked material progress and private photo work together', async ({ page, context, browser }, info) => {
  assertE2ETestDatabase(process.env);
  // This workflow exercises missing-key fallback; never expose a key in an assertion.
  expect(Boolean(process.env.OPENAI_API_KEY?.trim()), 'The disposable runner must omit provider credentials').toBe(false);
  test.setTimeout(240_000);
  const email = `catalog-${Date.now()}@example.test`;
  let companyId: string | undefined;
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }, { name: 'bk_theme', value: 'light', url: info.project.use.baseURL! }]);
    await page.goto('/signup?mode=bau');
    await page.locator('input[name="displayName"]').fill('Aurora Steel · DEMO');
    await page.locator('input[name="fullName"]').fill('Admin Demo');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Synthetic-Catalog-Demo-123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    const seed = await seedSteelWorkCatalog(companyId, { worker: true });
    const aurora = `/workzone/baustellen/${seed.sites.aurora.id}`, vega = `/workzone/baustellen/${seed.sites.vega.id}`;
    await page.goto(aurora); await openCatalog(page);
    for (const task of seed.customTasks) await expect(selected(page, task.label)).toBeChecked();
    await dialog(page).getByRole('button', { name: c.add, exact: true }).click();
    await dialog(page).getByRole('textbox', { name: c.name, exact: true }).fill('Detyrë ilustruese demo');
    await save(page);
    await expect(dialog(page).getByRole('status')).toContainText(c.imageFallback);
    await expect(selected(page, 'Detyrë ilustruese demo')).toBeChecked();
    const created = await prisma.steelWorkDefinition.findFirstOrThrow({ where: { companyProfileId: companyId, label: 'Detyrë ilustruese demo' } });
    expect(created.visualStatus).toBe('fallback');
    await close(page);
    await expect(page.getByRole('button', { name: t('steel.addTask', 'sq'), exact: true })).toBeFocused();

    await page.goto(vega); await openCatalog(page);
    await expect(selected(page, 'Detyrë ilustruese demo')).not.toBeChecked();
    await expect(selected(page, seed.customTasks[0].label)).not.toBeChecked();
    await selected(page, seed.customTasks[0].label).click();
    await expect(selected(page, seed.customTasks[0].label)).toBeChecked();
    const secondSelection = await prisma.steelSiteTask.findUniqueOrThrow({ where: { companyProfileId_baustelleId_definitionId: { companyProfileId: companyId, baustelleId: seed.sites.vega.id, definitionId: seed.definitions.find(definition => definition.key === seed.customTasks[0].treeId)!.id } }, include: { treeItem: true } });
    expect(secondSelection.treeItem.status).toBe('todo');
    await edit(page, 'Detyrë ilustruese demo');
    await dialog(page).getByRole('textbox', { name: c.name, exact: true }).fill('Detyrë me foto demo');
    const png = await sharp({ create: { width: 160, height: 100, channels: 3, background: '#f97316' } }).withMetadata().png().toBuffer();
    await dialog(page).locator('input[type="file"]').last().setInputFiles({ name: 'catalog-demo.png', mimeType: 'image/png', buffer: png });
    await save(page);
    await expect(selected(page, 'Detyrë me foto demo')).not.toBeChecked();
    const image = dialog(page).getByRole('listitem').filter({ hasText: 'Detyrë me foto demo' }).getByRole('img');
    await expect(image).toHaveAttribute('src', new RegExp(`/api/steel-work-visuals/${created.id}`));
    const url = (await image.getAttribute('src'))!;
    const response = await context.request.get(url);
    expect(response.status()).toBe(200); expect(response.headers()['content-type']).toBe('image/webp'); expect(response.headers()['cache-control']).toBe('private, no-store');
    const bytes = await response.body(), metadata = await sharp(bytes).metadata();
    expect(bytes.length).toBeLessThanOrEqual(180_000); expect(bytes.length).toBeLessThan(png.length); expect(metadata.format).toBe('webp'); expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBeLessThanOrEqual(1024); expect(metadata.height).toBeLessThanOrEqual(1024);
    const anonymous = await browser.newContext({ baseURL: info.project.use.baseURL });
    try { expect((await anonymous.request.get(url)).status()).toBe(404); } finally { await anonymous.close(); }

    await page.goto(aurora); await openCatalog(page);
    const historical = seed.customTasks[0];
    await expect(selected(page, historical.label)).toBeChecked();
    await selected(page, historical.label).click(); await expect(selected(page, historical.label)).not.toBeChecked();
    expect(await prisma.treeItem.findUnique({ where: { id: historical.id } })).toMatchObject({ status: 'done', notes: historical.notes, completedAt: historical.completedAt });
    await selected(page, historical.label).click(); await expect(selected(page, historical.label)).toBeChecked();
    await edit(page, historical.label); await dialog(page).getByRole('button', { name: c.archive, exact: true }).click();
    await dialog(page).getByRole('button', { name: c.archive, exact: true }).click();
    await expect(selected(page, historical.label)).toHaveCount(0);
    await dialog(page).getByRole('button', { name: c.archived, exact: true }).click();
    await edit(page, historical.label); await dialog(page).getByRole('button', { name: c.restore, exact: true }).click();
    await dialog(page).getByRole('button', { name: c.archived, exact: true }).click();
    await expect(selected(page, historical.label)).toBeChecked();
    expect(await prisma.treeItem.findUnique({ where: { id: historical.id } })).toMatchObject({ status: 'done', notes: historical.notes, completedAt: historical.completedAt });
    await dialog(page).getByRole('button', { name: c.add, exact: true }).click();
    await dialog(page).getByRole('textbox', { name: c.name, exact: true }).fill('Montimi i kolonave demo');
    await dialog(page).getByRole('combobox', { name: c.link, exact: true }).selectOption('mounted');
    await dialog(page).getByRole('combobox', { name: c.kind, exact: true }).selectOption('COLUMN');
    await save(page); await close(page);
    // The current board opens work through its phase group first.
    await page.getByTestId('phase-group-assembly').click();
    await page.getByRole('button').filter({ has: page.getByText('Montimi i kolonave demo', { exact: true }) }).click();
    const automatic = page.getByRole('dialog', { name: 'Montimi i kolonave demo', exact: true });
    await expect(automatic.getByText(/2\/10 copë/)).toBeVisible();
    await expect(automatic.getByRole('button', { name: t('steel.markDone', 'sq'), exact: true })).toHaveCount(0);
    await expect(automatic.getByRole('button', { name: t('steel.reopen', 'sq'), exact: true })).toHaveCount(0);
    await automatic.getByRole('button', { name: t('steel.close', 'sq'), exact: true }).click();

    await page.getByRole('button', { name: new RegExp(`^${escaped(t('elements.factoryList', 'sq'))}`) }).click();
    await page.getByRole('button').filter({ has: page.getByText(seed.elements.fresh.mark, { exact: true }) }).click();
    await expect(dialog(page).getByRole('button', { name: t('elements.backToList', 'sq'), exact: true })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Proceset', exact: true }).click();
    const picker = page.getByRole('dialog', { name: p.title, exact: true });
    await expect(picker.getByText(p.scope.replace('{count}', '1'), { exact: true })).toBeVisible();
    await expect(picker.getByRole('checkbox', { name: p.replace.replace('{count}', '3'), exact: true })).toHaveCount(0);
    await expect(picker.getByRole('checkbox', { checked: true })).toHaveCount(0);
    await picker.getByRole('checkbox', { name: t('factory.steps.cutting', 'sq'), exact: true }).check();
    await picker.getByRole('button', { name: p.manage, exact: true }).click();
    await dialog(page).getByRole('button', { name: c.addProcess, exact: true }).click();
    await dialog(page).getByRole('textbox', { name: c.name, exact: true }).fill('Matje speciale demo'); await save(page);
    const custom = await prisma.steelWorkDefinition.findFirstOrThrow({ where: { companyProfileId: companyId, label: 'Matje speciale demo' } });
    expect(custom.key).toMatch(/^fp-[a-f0-9]{24}$/);
    await close(page);
    await expect(picker.getByRole('button', { name: p.manage, exact: true })).toBeFocused();
    await picker.getByRole('button', { name: p.apply, exact: true }).click();
    await expect(picker).toHaveCount(0);
    const configured = await prisma.siteElement.findUniqueOrThrow({ where: { id: seed.elements.fresh.id }, include: { work: true } });
    expect(configured.processRoutes).toEqual({ v: 1, factory: ['cutting'], field: [] }); expect(configured.factoryDoneAt).toBeNull(); expect(configured.work).toHaveLength(0);
    expect(doneQty({ ...configured, list: 'assembly' }, 'factory')).toBe(0);
    await page.goto(aurora); await openCatalog(page);
    await dialog(page).getByRole('button', { name: c.add, exact: true }).click();
    await expect(dialog(page).getByRole('combobox', { name: c.link, exact: true }).locator(`option[value="${custom.key}"]`)).toHaveText(`${c.automatic} · Matje speciale demo`);
    await dialog(page).getByRole('button', { name: c.cancel, exact: true }).click(); await close(page);

    for (const theme of ['light', 'dark'] as const) for (const [device, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]] as const) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      await page.setViewportSize({ width, height }); await page.goto(aurora);
      await page.getByTestId('phase-group-assembly').click();
      // Many selected tasks must wrap within the actual site header before a modal masks it.
      const phaseHeader = page.locator('[data-studio-phase-summary]');
      await expect.poll(() => phaseHeader.getByRole('listitem').count()).toBeGreaterThanOrEqual(10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await phaseHeader.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await openCatalog(page);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await reachable(dialog(page).getByRole('button', { name: c.add, exact: true }), width, height);
      await dialog(page).getByRole('button', { name: c.close, exact: true }).focus(); await page.keyboard.press('Tab');
      expect(await dialog(page).evaluate(element => element.contains(document.activeElement))).toBe(true);
      await page.screenshot({ path: info.outputPath(`steel-catalog-${theme}-${device}.png`), fullPage: true });
      await edit(page, 'Detyrë me foto demo');
      await dialog(page).getByRole('textbox', { name: c.description, exact: true }).fill('Shënim demonstrativ për kontrollin e ekranit.');
      await reachable(dialog(page).getByRole('button', { name: c.save, exact: true }), width, height);
      await reachable(dialog(page).getByRole('button', { name: c.cancel, exact: true }), width, height);
      await page.screenshot({ path: info.outputPath(`steel-catalog-editor-${theme}-${device}.png`), fullPage: true });
      await close(page);
      await expect(page.getByRole('button', { name: t('steel.addTask', 'sq'), exact: true })).toBeFocused();
    }
    // Text enlargement is a separate accessibility state from a narrow viewport.
    const textZoom = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await openCatalog(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await dialog(page).getByRole('searchbox').evaluate(element => {
      const style = getComputedStyle(element);
      return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= 4 * parseFloat(style.fontSize);
    })).toBe(true);
    await reachable(dialog(page).getByRole('button', { name: c.add, exact: true }), 390, 844);
    await page.screenshot({ path: info.outputPath('steel-catalog-text-zoom.png'), fullPage: true });
    await edit(page, 'Detyrë me foto demo');
    expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await reachable(dialog(page).getByRole('button', { name: c.save, exact: true }), 390, 844);
    await reachable(dialog(page).getByRole('button', { name: c.cancel, exact: true }), 390, 844);
    await page.screenshot({ path: info.outputPath('steel-catalog-editor-text-zoom.png'), fullPage: true });
    await close(page);
    await textZoom.evaluate(element => element.remove());
  } finally {
    if (companyId) { await prisma.user.deleteMany({ where: { companyProfileId: companyId } }); await prisma.companyProfile.delete({ where: { id: companyId } }); }
  }
});
