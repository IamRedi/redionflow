import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';

test.use({ timezoneId: 'Europe/Berlin' });
test('Workzone keeps a transparent inline team header and distinguishes vehicle plates', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(240_000);
  const email = `header-plates-${Date.now()}@example.test`, issues: string[] = [], hydration: string[] = [];
  let companyId: string | undefined;
  page.on('pageerror', error => hydration.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|hydrated|server rendered|Minified React error #418/i.test(message.text())) hydration.push(message.text()); });
  const browserNow = new Date(Date.now() + 2 * 86_400_000);
  await page.clock.install({ time: browserNow });
  await context.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e5eddf"/><path d="M0 200L256 30" stroke="white" stroke-width="16"/><text x="15" y="240" font-size="10">DEMO MAP · synthetic tile</text></svg>' }));
  await context.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [] }));
  await context.route('https://kidraht.example.test/**', route => route.abort());
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
    await prisma.companyProfile.update({ where: { id: companyId }, data: { country: 'AL', kidrahtWorkspaceId: 'synthetic-workspace', kidrahtApiKey: 'synthetic-local-key' } });
    await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Fabrika demo', type: 'STEEL_WORKSHOP' } });
    await prisma.baustelle.create({ data: { companyProfileId: companyId, name: 'Aurora · Strukturë demo', type: 'STEEL_ASSEMBLY', coordinates: { lat: 52.5, lng: 13.4 } } });
    for (let i = 0; i < 16; i++) await prisma.machine.create({ data: { companyProfileId: companyId, name: i < 2 ? `Kamioni ${i + 1}` : `Transport demo ${i + 1}`, nickname: i < 2 ? 'Kamioni demo' : null, targe: `DEMO-${String(i + 1).padStart(2, '0')}`, hourlyRateCents: 0, ...(i === 0 ? { gpsEnabled: true, lastGpsLat: 52.49, lastGpsLng: 13.38, lastGpsAt: new Date() } : {}) } });
    const birthday = (date: Date) => new Date(Date.UTC(2000, date.getMonth(), date.getDate()));
    await prisma.worker.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ companyProfileId: companyId!, firstName: `Demo${i + 1}`, lastName: `Crew${i + 1}`, birthDate: i === 0 ? birthday(new Date()) : i === 1 ? birthday(browserNow) : null })) });
    for (const theme of ['light', 'dark'] as const) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      for (const width of [1440, 768, 360, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/workzone');
        await expect(page.getByTestId('flow-team-strip').getByRole('button').first()).toBeVisible();
        const header = await page.evaluate(() => {
          const root = document.querySelector('[data-testid="workzone-topbar"]')!, strip = document.querySelector('[data-testid="flow-team-strip"]')!;
          const logo = document.querySelector('button[aria-label="Hap asistentin admin"]')!.getBoundingClientRect();
          const crew = strip.querySelector('button')!.getBoundingClientRect();
          const bell = [...document.querySelectorAll('[aria-label="Njofto ekipin"]')].find(el => el.getClientRects().length)!.getBoundingClientRect();
          const kidraht = document.querySelector('a[href="/workzone/kidraht"]')!.getBoundingClientRect();
          return { rootBg: getComputedStyle(root).backgroundColor, stripBg: getComputedStyle(strip).backgroundColor, stripBorder: getComputedStyle(strip).borderTopWidth, crewLogoY: Math.abs(crew.y + crew.height / 2 - logo.y - logo.height / 2), crewAfterLogo: crew.left >= logo.right, bellKidrahtY: Math.abs(bell.y + bell.height / 2 - kidraht.y - kidraht.height / 2), noOverflow: document.documentElement.scrollWidth <= innerWidth };
        });
        console.log('HEADER_STATE', JSON.stringify({ theme, width, ...header }));
        await page.screenshot({ path: info.outputPath(`workzone-header-${theme}-${width}.png`) });
        const announcement = page.getByRole('button', { name: 'Shkruaj nje njoftim te shkurter per ekipin', exact: true });
        await announcement.click();
        const message = page.locator('textarea[name="message"]');
        await expect(message).toBeVisible();
        const panel = await message.locator('..').boundingBox();
        expect(panel!.x).toBeGreaterThanOrEqual(15);
        expect(panel!.x + panel!.width).toBeLessThanOrEqual(width - 15);
        if (width === 1440 || width === 360) await page.screenshot({ path: info.outputPath(`workzone-announcement-${theme}-${width}.png`) });
        await message.focus();
        await page.keyboard.press('Escape');
        await expect(message).toHaveCount(0);
        await expect(announcement).toBeFocused();
        if (header.stripBg !== 'rgba(0, 0, 0, 0)' || header.stripBorder !== '0px' || header.rootBg !== 'rgba(0, 0, 0, 0)') issues.push(`${theme}/${width}: header shell`);
        if (header.crewLogoY > 18 || !header.crewAfterLogo) issues.push(`${theme}/${width}: crew/logo alignment`);
        if (width < 1024 && header.bellKidrahtY > 2) issues.push(`${theme}/${width}: bell/KiDraht alignment`);
        if (!header.noOverflow) issues.push(`${theme}/${width}: page overflow`);
        const worker = page.getByTestId('flow-team-strip').getByRole('button').first();
        const target = await worker.boundingBox();
        expect(target!.width).toBeGreaterThanOrEqual(44);
        expect(target!.height).toBeGreaterThanOrEqual(44);
        await worker.click();
        await expect(page.getByRole('button', { name: 'Profili', exact: true })).toBeVisible();
        await worker.click();
        await page.getByRole('button', { name: 'Pamja harte', exact: true }).click();
        await expect(page.getByTestId('workzone-fleet-map')).toBeVisible();
        const index = page.getByTestId('workzone-map-index');
        const rows = index.locator('[data-testid^="map-index-vehicle-"]');
        await expect(rows).toHaveCount(16);
        const rowText = (await rows.allTextContents()).join(' ');
        for (let i = 0; i < 16; i++) if (!rowText.includes(`DEMO-${String(i + 1).padStart(2, '0')}`)) issues.push(`${theme}/${width}: missing plate ${i + 1}`);
        await expect(index.getByRole('button', { name: 'Zmadhim: Kamioni demo · DEMO-02', exact: true })).toBeDisabled();
        const zoom = index.getByRole('button', { name: 'Zmadhim: Kamioni demo · DEMO-01', exact: true });
        await expect(zoom).toBeEnabled();
        await expect(index.getByRole('link', { name: 'Vendndodhja: Kamioni demo · DEMO-01', exact: true })).toHaveAttribute('href', /query=52\.4900000,13\.3800000/);
        await zoom.focus();
        await page.keyboard.press('Enter');
        await expect.poll(async () => page.evaluate(() => {const a=document.querySelector('.leaflet-marker-icon[title="Makinat: DEMO-01"]')!.getBoundingClientRect(),b=document.querySelector('[data-testid="workzone-map-frame"] .leaflet-container')!.getBoundingClientRect();return Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2);})).toBeLessThan(8);
        const scrollbar = await index.evaluate(el => ({ list: getComputedStyle(el).scrollbarWidth, page: getComputedStyle(document.documentElement).scrollbarWidth }));
        if (scrollbar.list !== scrollbar.page) issues.push(`${theme}/${width}: scrollbar differs`);
        await page.getByTestId('workzone-map-frame').scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`workzone-plates-${theme}-${width}.png`) });
      }
      const credit = page.getByRole('link', { name: 'by RediON', exact: true });
      await expect(credit).toHaveCount(1);
      await expect(credit).toHaveAttribute('href', 'https://www.redioncekrezi.de/');
      expect(await credit.getAttribute('target')).toBeNull();
      await credit.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(credit).toBeFocused();
      expect(await credit.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
      expect((await credit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await credit.locator('..').screenshot({ path: info.outputPath(`workzone-credit-link-${theme}.png`) });
    }
    const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.user.createMany({ data: Array.from({ length: 3 }, (_, i) => ({ companyProfileId: companyId, name: `Office Demo ${i + 1}`, email: `office-${i}-${email}`, passwordHash: owner.passwordHash, role: 'ADMIN' as const, isActive: true, isOwner: false })) });
    for (const theme of ['light', 'dark']) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      for (const width of [1440, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/app/dashboard');
        await expect(page.getByTestId('admin-topbar')).toBeVisible();
        await expect(page.getByTestId('flow-team-strip').getByRole('button').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`steel-admin-header-${theme}-${width}.png`) });
      }
    }
    await page.goto('/landing');
    await expect(page.getByTestId('flow-mobile-tools')).toHaveCount(0);
    console.log('HYDRATION_STATE', JSON.stringify(hydration));
    expect(hydration, 'No hydration/page errors when browser date differs').toEqual([]);
    expect(issues, 'Requested header/plates/scrollbar acceptance').toEqual([]);
  } finally {
    if (companyId) { await prisma.user.deleteMany({ where: { companyProfileId: companyId } }); await prisma.companyProfile.delete({ where: { id: companyId } }); }
  }
});
