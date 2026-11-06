import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { assetCopy } from '../../src/components/company-assets/copy';
import { fleetCopy } from '../../src/lib/fleet/copy';
import { cleanupSteelAssetsWorkshop, seedSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';

const c = assetCopy('sq'), fleet = fleetCopy('sq');
const dialog = (page: Page) => page.getByRole('dialog').last();
const detail = (page: Page) => page.getByTestId('asset-detail');
const status = (scope: Locator) => scope.getByTestId('asset-operational-status');

async function setup(page: Page, context: BrowserContext, info: TestInfo) {
  assertE2ETestDatabase(process.env);
  for (const key of ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'WANWAY_APPID', 'WANWAY_KEY']) expect(Boolean(process.env[key]?.trim()), `${key} must be blank`).toBe(false);
  const target = validateE2ETarget(info.project.use.baseURL!);
  await context.route('**/*', route => new URL(route.request().url()).origin === target.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: target.baseURL }, { name: 'bk_theme', value: 'light', url: target.baseURL }]);
  const marker = `workshop-status-${Date.now()}-${info.workerIndex}`;
  const email = `${marker}@example.test`;
  await page.goto('/signup?mode=bau');
  for (const [name, value] of Object.entries({ displayName: 'Synthetic Assets · DEMO', fullName: 'Synthetic Chief', email, password: 'Synthetic-Assets-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  const companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
  const seed = await seedSteelAssetsWorkshop(companyId, marker);
  const phases = ['reported', 'received', 'repairing', 'repairing', 'ready', 'ready', 'reported', 'reported', 'reported', 'reported', 'reported', 'reported'];
  const repairs = [];
  for (let index = 0; index < phases.length; index++) {
    const asset = await prisma.companyOperationalAsset.create({ data: { companyProfileId: companyId, machineId: seed.machines[index].id } });
    repairs.push(await prisma.companyAssetRepair.create({ data: { companyProfileId: companyId, assetId: asset.id, phase: phases[index], location: index === 3 ? 'external' : 'internal', provider: index === 3 ? 'Aurora Repair · DEMO' : '', problem: index === 3 ? 'Synthetic hydraulic inspection and seal replacement.' : 'Synthetic scheduled inspection of brakes and equipment.', repairNote: phases[index] === 'ready' ? 'Synthetic inspection completed.' : '', tested: phases[index] === 'ready', reportedByKey: 'synthetic:status', reportedByName: 'Synthetic Operator' } }));
    if (index === 0) {
      await prisma.companyAssetRepair.create({ data: { companyProfileId: companyId, assetId: asset.id, phase: 'ready', problem: 'Earlier synthetic service.', repairNote: 'Earlier service completed.', tested: true, reportedByKey: 'synthetic:status', reportedByName: 'Synthetic Operator', createdAt: new Date(Date.now() - 86_400_000), updatedAt: new Date(Date.now() - 86_400_000) } });
      await prisma.companyAssetIncident.create({ data: { companyProfileId: companyId, assetId: asset.id, kind: 'defect', status: 'pending', note: 'Synthetic current defect report.', reportedByKey: 'synthetic:status', reportedByName: 'Synthetic Operator' } });
    }
  }
  return { companyId, seed, repairs };
}

async function touch(control: Locator, width: number, height: number) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(43.5);
  expect(box!.height).toBeGreaterThanOrEqual(43.5);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
}

async function readableStatus(badge: Locator, theme: string, surface: string) {
  const ratio = await badge.evaluate(element => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const rgba = (value: string) => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((channel, index) => index === 3 ? channel / 255 : channel);
    };
    const layers: number[][] = [];
    for (let current: Element | null = element; current; current = current.parentElement) layers.unshift(rgba(getComputedStyle(current).backgroundColor));
    let background = [255, 255, 255];
    for (const layer of layers) background = background.map((value, index) => layer[index] * layer[3] + value * (1 - layer[3]));
    const luminance = (color: number[]) => {
      const rgb = color.slice(0, 3).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const foreground = luminance(rgba(getComputedStyle(element).color)), behind = luminance(background);
    return (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05);
  });
  console.log('WORKSHOP_STATUS_CONTRAST', JSON.stringify({ theme, surface, ratio }));
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

test('compact workshop handles many reports, search and completed history in both themes and sizes', async ({ page, context }, info) => {
  test.setTimeout(150_000);
  let companyId: string | undefined;
  try {
    const fixture = await setup(page, context, info); companyId = fixture.companyId;
    const { seed } = fixture;
    for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
      const height = width === 1440 ? 1000 : 844;
      await page.setViewportSize({ width, height });
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      await page.goto('/workzone');
      await page.getByTestId('workshop-dock-open').click();
      const workshop = page.getByTestId('workshop-workspace');
      await expect(dialog(page).getByRole('heading', { name: c.workshop, exact: true })).toHaveCount(1);
      const reported = workshop.locator('#workshop-phase-reported');
      await expect(reported.getByTestId('workshop-repair-card')).toHaveCount(7);
      const card = reported.getByTestId('workshop-repair-card').filter({ hasText: seed.machines[11].targe! });
      await expect(card).toBeVisible();
      const box = await card.boundingBox(); expect(box!.height).toBeLessThanOrEqual(250);
      expect(await workshop.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`after-workshop-${theme}-${width}.png`) });
      if (width === 1440) {
        const receivedBox = await workshop.locator('#workshop-phase-received').boundingBox();
        const reportedBox = await reported.boundingBox();
        expect(receivedBox!.height + 100).toBeLessThan(reportedBox!.height);
      } else {
        await touch(workshop.locator('[aria-controls="workshop-phase-ready"]'), width, height);
      }
      await touch(card, width, height);
      await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
      await expect(page.getByTestId('workshop-dock-open')).toBeFocused();
    }
    await page.setViewportSize({ width: 844, height: 390 });
    const zoom = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByTestId('workshop-dock-open').click();
    expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await touch(dialog(page).getByRole('button', { name: c.close, exact: true }), 844, 390);
    for (const target of [seed.machines[11], seed.machines[0]]) {
      const row = page.getByTestId('workshop-workspace').locator('#workshop-phase-reported').getByTestId('workshop-repair-card').filter({ hasText: target.targe! });
      await row.scrollIntoViewIfNeeded();
      const visible = await row.evaluate(element => {
        const row = element.getBoundingClientRect(), scroll = element.closest('[data-testid="workshop-scroll"]')!.getBoundingClientRect();
        return { height: Math.min(row.bottom, scroll.bottom, innerHeight) - Math.max(row.top, scroll.top, 0), width: Math.min(row.right, scroll.right, innerWidth) - Math.max(row.left, scroll.left, 0) };
      });
      console.log('WORKSHOP_ZOOM_REACHABILITY', JSON.stringify({ plate: target.targe, ...visible }));
      expect(visible.height).toBeGreaterThanOrEqual(44); expect(visible.width).toBeGreaterThanOrEqual(44);
      await row.click();
      await expect(detail(page)).toContainText(target.targe!);
      await expect(status(detail(page))).toHaveAttribute('data-phase', 'reported');
      await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
      await expect(row).toBeFocused();
    }
    await page.screenshot({ path: info.outputPath('after-workshop-landscape-text-zoom.png') });
    await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
    await zoom.evaluate(element => element.remove());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('workshop-dock-open').click();
    const workshop = page.getByTestId('workshop-workspace');
    await workshop.getByRole('searchbox', { name: c.search, exact: true }).fill('hydraulic');
    await expect(workshop.getByTestId('workshop-repair-card')).toHaveCount(1);
    await expect(workshop.locator('#workshop-phase-repairing')).toBeVisible();
    await expect(workshop.getByTestId('workshop-repair-card')).toContainText(c.external);
    await workshop.getByRole('searchbox', { name: c.search, exact: true }).fill('');
    await workshop.locator('[aria-controls="workshop-phase-ready"]').click();
    await expect(workshop.locator('#workshop-phase-ready')).toContainText(c.history);
    await workshop.locator('#workshop-phase-ready').getByTestId('workshop-repair-card').filter({ hasText: seed.machines[0].targe! }).click();
    await expect(status(detail(page))).toHaveAttribute('data-phase', 'reported');
    await expect(status(detail(page))).not.toHaveAttribute('data-status-key', 'available');
    await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
    await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});

test('current phase stays consistent across map, fleet, detail and return; failed reads stay unknown', async ({ page, context }, info) => {
  test.setTimeout(150_000);
  let companyId: string | undefined;
  try {
    const fixture = await setup(page, context, info); companyId = fixture.companyId;
    const { seed } = fixture;
    const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
    let statusAction: string | undefined;
    page.on('request', request => {
      const body = request.postData() || '';
      if (request.method() === 'POST' && seed.machines.every(machine => body.includes(machine.id))) statusAction = request.headers()['next-action'];
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const machine = page.getByTestId('fleet-machine-card');
    const mapRow = page.getByTestId(`map-index-vehicle-${seed.machines[0].id}`);
    for (const theme of ['light', 'dark']) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      await page.goto('/workzone?view=map');
      await expect(status(mapRow)).toHaveAttribute('data-phase', 'reported');
      await readableStatus(status(mapRow), theme, 'map-index');
      await page.locator('.leaflet-marker-icon[title$="ZZ 001 DM"]').click();
      const popup = page.locator('.leaflet-popup-content');
      await expect(status(popup)).toHaveAttribute('data-phase', 'reported');
      await readableStatus(status(popup), theme, 'map-popup');
      await touch(popup.locator('a[href*="google.com/maps"]'), 1440, 1000);
      await touch(popup.getByRole('button', { name: fleet.fleet, exact: true }), 1440, 1000);
      await touch(popup.locator(`a[href="/workzone/fuel?machine=${seed.machines[0].id}"]`), 1440, 1000);
      await page.screenshot({ path: info.outputPath(`status-map-popup-${theme}.png`) });
      await popup.getByRole('button', { name: fleet.fleet, exact: true }).click();
      await expect(status(machine)).toHaveAttribute('data-phase', 'reported');
      await readableStatus(status(machine), theme, 'machine-card');
      if (theme === 'light') await page.keyboard.press('Escape');
    }
    await machine.getByRole('button', { name: c.workshop, exact: true }).click();
    await expect(detail(page)).toBeVisible();
    await expect(status(detail(page))).toHaveAttribute('data-phase', 'reported');
    await detail(page).getByRole('button', { name: c.receive, exact: true }).click();
    await expect(status(detail(page))).toHaveAttribute('data-phase', 'received');
    await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
    await expect(page.getByTestId('workshop-workspace').locator('#workshop-phase-received')).toContainText(seed.machines[0].targe!);
    await dialog(page).getByRole('button', { name: c.close, exact: true }).click();
    await expect(status(machine)).toHaveAttribute('data-phase', 'received');
    await page.keyboard.press('Escape');
    await expect(status(mapRow)).toHaveAttribute('data-phase', 'received');
    await page.getByTestId('fleet-dock-open').click();
    const picker = page.getByTestId('fleet-picker');
    const fleetRow = picker.locator(`[data-machine-id="${seed.machines[0].id}"]`);
    await expect(status(fleetRow)).toHaveAttribute('data-phase', 'received');
    await page.screenshot({ path: info.outputPath('status-received-map-fleet.png') });
    await page.keyboard.press('Escape');
    for (const theme of ['light', 'dark']) for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      await page.reload();
      await page.getByTestId('fleet-dock-open').click();
      await expect(status(fleetRow)).toHaveAttribute('data-phase', 'received');
      const external = picker.locator(`[data-machine-id="${seed.machines[3].id}"]`);
      await expect(status(external)).toHaveAttribute('data-phase', 'repairing');
      await expect(status(external)).toContainText(c.external);
      expect(await picker.getByTestId('fleet-card-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);
      expect(await picker.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect((await fleetRow.boundingBox())!.height).toBeLessThanOrEqual(280);
      if (width === 390) await readableStatus(status(fleetRow), theme, 'fleet-received');
      await page.screenshot({ path: info.outputPath(`status-fleet-grid-${theme}-${width}.png`) });
      await page.keyboard.press('Escape');
    }
    expect(statusAction, 'Identify only the exact-ID status batch, not a mutation').toBeTruthy();
    await page.route('**/workzone*', async route => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action'] === statusAction) await route.abort('failed');
      else await route.fallback();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('fleet-dock-open').click();
    await expect(status(fleetRow)).toHaveAttribute('data-status-key', 'unknown');
    await expect(status(fleetRow)).toContainText(c.statusUnknown);
    await expect(status(fleetRow)).not.toHaveAttribute('data-status-key', 'available');
    await readableStatus(status(fleetRow), 'dark', 'failed-read-unknown');
    expect(await picker.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('status-failed-read-unknown-dark-phone.png') });
    await context.addCookies([{ name: 'bk_theme', value: 'light', url: info.project.use.baseURL! }]);
    await page.reload();
    await page.getByTestId('fleet-dock-open').click();
    await expect(status(fleetRow)).toHaveAttribute('data-status-key', 'unknown');
    await readableStatus(status(fleetRow), 'light', 'failed-read-unknown');
    await page.screenshot({ path: info.outputPath('status-failed-read-unknown-light-phone.png') });
    expect(pageErrors).toEqual([]);
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});
