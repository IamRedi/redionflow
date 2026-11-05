import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { prisma } from '../../src/lib/db/prisma';
import { workCatalogCopy } from '../../src/components/steel/work-catalog-copy';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';

test.skip(process.env.STEEL_IMAGE_E2E_MOCK !== 'true', 'Requires the explicit disposable image-provider preload');
const c = workCatalogCopy('sq');
const dictionary: unknown = JSON.parse(readFileSync(new URL('../../src/locales/sq.json', import.meta.url), 'utf8'));
function label(path: string) {
  const value = path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, dictionary);
  if (typeof value !== 'string') throw new Error(`Missing fixture label ${path}`);
  return value;
}
const dialog = (page: Page) => page.getByRole('dialog').last();
async function openCatalog(page: Page) {
  await page.getByRole('button', { name: label('steel.addTask'), exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: c.add, exact: true })).toBeEnabled();
}
async function edit(page: Page, name: string) { await dialog(page).getByRole('button', { name: `${c.edit}: ${name}`, exact: true }).click(); }
async function close(page: Page) { await dialog(page).getByRole('button', { name: c.close, exact: true }).click(); }
async function touchReachable(control: Locator, width: number, height: number) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box).not.toBeNull(); expect(box!.width).toBeGreaterThanOrEqual(43.5); expect(box!.height).toBeGreaterThanOrEqual(43.5);
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1); expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
}
async function progress(companyId: string, siteId: string) {
  return {
    tasks: await prisma.treeItem.findMany({ where: { baustelleId: siteId }, orderBy: { id: 'asc' }, select: { id: true, status: true, completedAt: true, completedBy: true, completedByWorkerId: true } }),
    materials: await prisma.siteElement.findMany({ where: { companyProfileId: companyId, baustelleId: siteId }, orderBy: { id: 'asc' }, select: { id: true, quantity: true, factoryDoneAt: true, fieldDoneAt: true, processRoutes: true, processRevision: true } }),
    confirmations: await prisma.siteElementWork.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }),
  };
}

test('recognizable illustrations preserve composition, drafts, existing photos and production progress', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  expect(process.env.OPENAI_API_KEY === 'synthetic-steel-image-key-never-sent', 'Only the explicit synthetic provider fixture may run').toBe(true);
  const providerDirectory = resolve('test-results/steel-illustrations-provider');
  expect(process.env.STEEL_IMAGE_E2E_DIR).toBe(providerDirectory);
  await mkdir(providerDirectory, { recursive: true });
  await writeFile(resolve(providerDirectory, 'control.json'), JSON.stringify({ mode: 'success' }));
  await writeFile(resolve(providerDirectory, 'calls.jsonl'), '');
  const providerCalls = async () => (await readFile(resolve(providerDirectory, 'calls.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { prompt: string; mode: string; endpoint: string });
  test.setTimeout(180_000);
  const email = `illustrations-${Date.now()}@example.test`;
  const targetName = 'Montim bordesh · DEMO', generatedName = 'Ilustrim WebP · DEMO', legacyName = 'Ilustrim SVG · DEMO', photoName = 'Foto e ngarkuar · DEMO';
  let companyId: string | undefined;
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }, { name: 'bk_theme', value: 'light', url: info.project.use.baseURL! }]);
    await page.goto('/signup?mode=bau');
    await page.locator('input[name="displayName"]').fill('Aurora Steel · DEMO');
    await page.locator('input[name="fullName"]').fill('Admin Demo');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Synthetic-Illustration-Demo-2026!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    const seed = await seedSteelWorkCatalog(companyId);
    const definition = (index: number) => seed.definitions.find(item => item.key === seed.customTasks[index].treeId)!;
    const target = definition(0), legacy = definition(1), photo = definition(2), generated = definition(3);
    const fixtureImage = await readFile(new URL('../fixtures/steel-illustration.webp', import.meta.url));
    const photoBytes = await sharp({ create: { width: 900, height: 300, channels: 3, background: '#25587f' } }).webp().toBuffer();
    const scene = { v: 1, shapes: [{ type: 'rect', x: 20, y: 90, width: 260, height: 15, color: 'steel' }, { type: 'line', from: [80, 90], to: [150, 30], width: 3, color: 'orange' }] };
    const at = new Date('2026-01-08T08:00:00Z');
    for (const item of [{ row: target, name: targetName, mime: 'image/svg+xml', bytes: null }, { row: legacy, name: legacyName, mime: 'image/svg+xml', bytes: null }, { row: photo, name: photoName, mime: 'image/webp', bytes: photoBytes }, { row: generated, name: generatedName, mime: 'image/webp', bytes: fixtureImage }]) {
      await prisma.steelWorkDefinition.update({ where: { id: item.row.id }, data: { label: item.name, description: 'Përshkrim fillestar demonstrativ.', visualStatus: item.row.id === photo.id ? 'photo' : 'generated', visualUpdatedAt: at } });
      await prisma.steelWorkVisual.create({ data: { companyProfileId: companyId, definitionId: item.row.id, mime: item.mime, ...(item.bytes ? { data: new Uint8Array(item.bytes) } : { scene }) } });
    }
    const site = `/workzone/baustellen/${seed.sites.aurora.id}`;
    const businessBefore = await progress(companyId, seed.sites.aurora.id);
    await page.goto(site); await openCatalog(page);
    const rowImage = (name: string) => dialog(page).getByRole('listitem').filter({ hasText: name }).getByRole('img');
    for (const name of [generatedName, legacyName]) {
      await expect(rowImage(name)).toHaveCSS('object-fit', 'contain');
      const response = await context.request.get((await rowImage(name).getAttribute('src'))!);
      expect(response.status()).toBe(200); expect(response.headers()['content-type']).toContain(name === generatedName ? 'image/webp' : 'image/svg+xml');
    }
    await expect(rowImage(photoName)).toHaveCSS('object-fit', 'cover');
    await edit(page, photoName);
    await expect(dialog(page).getByRole('button', { name: c.generate, exact: true })).toHaveCount(0);
    await expect(dialog(page).getByRole('img')).toHaveCSS('object-fit', 'cover');
    await close(page);

    // Current legacy composition before replacement, with the real catalog/editor controls.
    for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]] as const) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      await page.setViewportSize({ width, height }); await page.goto(site); await openCatalog(page); await edit(page, targetName);
      await expect(dialog(page).getByRole('img')).toHaveCSS('object-fit', 'contain');
      await touchReachable(dialog(page).getByRole('button', { name: c.generate, exact: true }), width, height);
      expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`steel-illustration-before-${theme}-${device}.png`) });
      await close(page);
    }
    expect(await providerCalls()).toHaveLength(0); // Rendering never invokes generation.
    await openCatalog(page); await edit(page, targetName);
    const beforeRevision = (await prisma.steelWorkDefinition.findUniqueOrThrow({ where: { id: target.id } })).revision;
    const beforeAudit = await prisma.auditLog.count({ where: { companyProfileId: companyId, action: 'steel.catalog_updated' } });
    const draft = 'DEMO_FOLDED_EDGE_V2: llamarinë e palosur për skajet e çatisë dhe fasadës.';
    await dialog(page).getByRole('textbox', { name: c.description, exact: true }).fill(draft);
    const savedRequests: string[] = [];
    const observeSave = (request: import('@playwright/test').Request) => {
      if (request.method() === 'POST' && request.headers()['next-action'] && request.postData()?.includes('DEMO_FOLDED_EDGE_V2')) savedRequests.push(request.postData()!);
    };
    page.on('request', observeSave);
    await dialog(page).getByRole('button', { name: c.generate, exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: c.add, exact: true })).toBeEnabled();
    page.off('request', observeSave);
    expect(savedRequests).toHaveLength(1);
    const saved = await prisma.steelWorkDefinition.findUniqueOrThrow({ where: { id: target.id } });
    expect(saved).toMatchObject({ description: draft, revision: beforeRevision + 1, visualStatus: 'generated' });
    expect(await prisma.auditLog.count({ where: { companyProfileId: companyId, action: 'steel.catalog_updated' } })).toBe(beforeAudit + 1);
    const calls = await providerCalls(); expect(calls).toHaveLength(1); expect(calls[0].prompt).toContain(draft); expect(calls[0].endpoint).toBe('/v1/images/edits');
    const stored = await prisma.steelWorkVisual.findFirstOrThrow({ where: { companyProfileId: companyId, definitionId: target.id } });
    expect(stored.mime).toBe('image/webp'); expect(stored.data?.length).toBeLessThanOrEqual(180_000);
    const meta = await sharp(stored.data!).metadata(); expect(meta.format).toBe('webp'); expect(meta.exif).toBeUndefined();
    await close(page);
    for (const theme of ['light', 'dark']) for (const [device, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]] as const) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      await page.setViewportSize({ width, height }); await page.goto(site); await openCatalog(page); await edit(page, targetName);
      await expect(dialog(page).getByRole('img')).toHaveCSS('object-fit', 'contain');
      await expect(dialog(page).getByRole('img')).toHaveJSProperty('naturalWidth', 1024);
      await touchReachable(dialog(page).getByRole('button', { name: c.generate, exact: true }), width, height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`steel-illustration-after-${theme}-${device}.png`) });
      await close(page);
    }
    expect(await providerCalls()).toHaveLength(1);
    expect(await progress(companyId, seed.sites.aurora.id)).toEqual(businessBefore);

    // Simulate the next allowed image window only for this disposable fixture company.
    await prisma.assistantQuotaBucket.deleteMany({ where: { companyProfileId: companyId, window: { in: ['image-burst', 'image-day'] } } });
    await writeFile(resolve(providerDirectory, 'control.json'), JSON.stringify({ mode: 'failure' }));
    await openCatalog(page); await edit(page, targetName);
    const previousUrl = await dialog(page).getByRole('img').getAttribute('src');
    await dialog(page).getByRole('button', { name: c.generate, exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: c.add, exact: true })).toBeEnabled();
    await expect(dialog(page).getByRole('status')).toContainText(c.imageFallback);
    expect(await providerCalls()).toHaveLength(2);
    const retained = await prisma.steelWorkVisual.findFirstOrThrow({ where: { companyProfileId: companyId, definitionId: target.id } });
    expect(retained.data).toEqual(stored.data); expect(retained.mime).toBe('image/webp');
    await edit(page, targetName);
    await expect(dialog(page).getByRole('img')).toHaveAttribute('src', previousUrl!);
    await expect(dialog(page).getByRole('img')).toHaveCSS('object-fit', 'contain');
    expect(await progress(companyId, seed.sites.aurora.id)).toEqual(businessBefore);
  } finally {
    if (companyId) { await prisma.user.deleteMany({ where: { companyProfileId: companyId } }); await prisma.companyProfile.delete({ where: { id: companyId } }); }
  }
});
