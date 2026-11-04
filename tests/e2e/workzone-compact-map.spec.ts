import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';

test('Workzone map has a compact site and fleet index without a floating team header', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(180_000);
  const email = `compact-map-${Date.now()}@example.test`;
  let companyId: string | undefined, foreignId: string | undefined;
  const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef3e9"/><path d="M0 20L120 0 256 90V170L80 210 0 130Z" fill="#deead8"/><path d="M-30 220L290 30M40-30L230 290" stroke="#fff" stroke-width="18"/><path d="M-30 220L290 30M40-30L230 290" stroke="#c5d1d7" stroke-width="2"/><text x="12" y="245" font-size="10" font-family="sans-serif" fill="#60736e">DEMO MAP · synthetic tile</text></svg>';
  await context.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: tile }));
  await context.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [] }));
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }]);
    await page.goto('/signup?mode=bau');
    await page.locator('input[name="displayName"]').fill('Mira Steel · DEMO');
    await page.locator('input[name="fullName"]').fill('Admin Demo');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('Synthetic-Steel-Demo-123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } })).companyProfileId!;
    await prisma.companyProfile.update({ where: { id: companyId }, data: { country: 'AL' } });
    await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Fabrika demo', type: 'STEEL_WORKSHOP' } });
    const sites = [];
    for (const [i, name] of ['Aurora · Hangar demo', 'Vega · Strukturë demo', 'Projekt pa GPS', 'Projekt me adresë'].entries()) {
      sites.push(await prisma.baustelle.create({ data: { companyProfileId: companyId, name, type: 'STEEL_ASSEMBLY', address: i === 3 ? 'Demo Avenue 100, Demo City' : '', ...(i < 2 ? { coordinates: { lat: 52.50 + i * .04, lng: 13.35 + i * .04 } } : {}) } }));
    }
    const vehicles = [];
    for (let i = 0; i < 18; i++) vehicles.push(await prisma.machine.create({ data: {
      companyProfileId: companyId, name: i < 2 ? `Kamioni demo ${i + 1}` : `Transport demo ${i + 1}`, targe: `DEMO-${String(i + 1).padStart(2, '0')}`, hourlyRateCents: 0,
      ...(i < 2 ? { gpsEnabled: true, lastGpsLat: 52.48 + i * .05, lastGpsLng: 13.33 + i * .05, lastGpsAt: new Date() } : {}),
    } }));
    await prisma.worker.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ companyProfileId: companyId!, firstName: `Demo${i + 1}`, lastName: `Crew${i + 1}` })) });
    foreignId = (await prisma.companyProfile.create({ data: { legalName: 'Foreign company · DEMO', displayName: 'Foreign company · DEMO' } })).id;
    await prisma.machine.create({ data: { companyProfileId: foreignId, name: 'FOREIGN_PRIVATE_VEHICLE', hourlyRateCents: 0, gpsEnabled: true, lastGpsLat: 52.5, lastGpsLng: 13.4, lastGpsAt: new Date() } });

    for (const theme of ['light', 'dark'] as const) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      for (const [width, height, device] of [[1440, 1000, 'desktop'], [1024, 900, 'tablet'], [390, 844, 'phone'], [320, 760, 'small-phone']] as const) {
        await page.setViewportSize({ width, height });
        await page.goto('/workzone');
        await page.getByRole('button', { name: 'Pamja harte', exact: true }).click();
        const frame = page.getByTestId('workzone-map-frame'), index = page.getByTestId('workzone-map-index'), header = page.getByTestId('workzone-topbar');
        const headerDocTop = await header.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
        await expect(page.getByTestId('workzone-fleet-map')).toBeVisible();
        await expect(page.getByTestId('fleet-rail-items')).toHaveCount(0);
        await page.getByTestId('fleet-rail-toggle').click();
        await expect(page.getByTestId('fleet-rail-items')).toBeVisible();
        await page.getByTestId('fleet-rail-toggle').click();
        await expect(page.getByTestId('fleet-rail-items')).toHaveCount(0);
        await expect(index.locator('[data-testid^="map-index-site-"]')).toHaveCount(4);
        await expect(index.locator('[data-testid^="map-index-vehicle-"]')).toHaveCount(18);
        await expect(page.getByText('FOREIGN_PRIVATE_VEHICLE', { exact: true })).toHaveCount(0);
        for (const row of await index.locator('[data-testid^="map-index-"]').all()) {
          expect(await row.locator('button,a').count()).toBe(2);
          expect((await row.innerText()).trim().split('\n')).toHaveLength(1);
        }
        const missingSite = page.getByTestId(`map-index-site-${sites[2].id}`), missingVehicle = page.getByTestId(`map-index-vehicle-${vehicles[2].id}`);
        await expect(missingSite.getByRole('button', { name: 'Zmadhim: Projekt pa GPS', exact: true })).toBeDisabled();
        await expect(missingSite.getByRole('button', { name: 'Vendndodhja: Projekt pa GPS', exact: true })).toBeDisabled();
        await expect(missingVehicle.getByRole('button')).toHaveCount(2);
        expect(await missingVehicle.locator('button:disabled').count()).toBe(2);
        await expect(page.getByTestId(`map-index-site-${sites[3].id}`).getByRole('link')).toHaveAttribute('href', /query=Demo%20Avenue%20100/);
        await expect(page.getByTestId(`map-index-vehicle-${vehicles[0].id}`).getByRole('link')).toHaveAttribute('href', /query=52\.4800000,13\.3300000/);
        const bounds = await index.boundingBox();
        expect(bounds).not.toBeNull();
        if (width >= 1024) expect(bounds!.width).toBeLessThanOrEqual(225);
        expect(await index.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        const centerDistance = async (title: string) => {
          const marker = await page.locator(`.leaflet-marker-icon[title="${title}"]`).boundingBox();
          const map = await frame.locator('.leaflet-container').boundingBox();
          return marker && map ? Math.hypot(marker.x + marker.width / 2 - map.x - map.width / 2, marker.y + marker.height / 2 - map.y - map.height / 2) : Infinity;
        };
        const vehicleZoom = page.getByTestId(`map-index-vehicle-${vehicles[0].id}`).getByRole('button', { name: 'Zmadhim: Kamioni demo 1', exact: true });
        await vehicleZoom.click();
        await expect.poll(() => centerDistance('Makinat: DEMO-01')).toBeLessThan(8);
        await page.evaluate(() => window.scrollBy(0, 260));
        expect(Math.abs(await header.evaluate(el => el.getBoundingClientRect().top + window.scrollY) - headerDocTop)).toBeLessThan(2);
        await frame.scrollIntoViewIfNeeded();
        if (device === 'desktop' || device === 'phone') {
          const map = await frame.boundingBox();
          await page.mouse.move(map!.x + map!.width * .25, map!.y + map!.height * .55);
          await page.mouse.down();
          await page.mouse.move(map!.x + map!.width * .25 + 90, map!.y + map!.height * .55 + 50, { steps: 12 });
          await page.mouse.up();
          await expect.poll(() => centerDistance('Makinat: DEMO-01')).toBeGreaterThan(35);
          await vehicleZoom.click();
          await expect.poll(() => centerDistance('Makinat: DEMO-01')).toBeLessThan(8);
        }
        await page.getByTestId(`map-index-site-${sites[0].id}`).getByRole('button', { name: 'Zmadhim: Aurora · Hangar demo', exact: true }).click();
        await expect.poll(() => centerDistance('Kantieret: Aurora · Hangar demo')).toBeLessThan(8);
        await frame.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`workzone-compact-map-${theme}-${device}.png`), fullPage: false });
      }
    }
  } finally {
    if (companyId) { await prisma.user.deleteMany({ where: { companyProfileId: companyId } }); await prisma.companyProfile.delete({ where: { id: companyId } }); }
    if (foreignId) await prisma.companyProfile.delete({ where: { id: foreignId } });
  }
});
