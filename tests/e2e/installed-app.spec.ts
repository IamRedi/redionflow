import { randomInt, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';

test('dedicated install uses company identity and preserves both role logins across reopening', async ({ browser }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(180_000);
  test.skip(!process.env.PWA_SYNTHETIC_BRAND, 'Explicit synthetic provisioning identity required.');
  const marker = randomUUID(), legalName = 'Synthetic Steel Install', name = 'Steel DEMO';
  const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="90"><rect width="200" height="90" fill="white"/><path d="M15 65V20L55 40V65Z" fill="#b15b2f"/><text x="65" y="55" font-family="sans-serif" font-size="20">Steel DEMO</text></svg>').toString('base64');
  const id = process.env.INSTALLATION_COMPANY_ID;
  if (!id?.startsWith('pwa-install-synthetic-')) throw Error('Synthetic install binding required');
  const company = await prisma.companyProfile.create({ data: { id, displayName: name, legalName, mode: 'bau', country: 'AL', logoDataUrl: logo } });
  const email = `install-${marker}@example.test`, password = 'Synthetic-Install-123!', code = String(randomInt(100000, 1000000));
  const admin = await prisma.user.create({ data: { email, name: 'Admin DEMO', role: 'ADMIN', isOwner: true, companyProfileId: company.id, passwordHash: hashPassword(password) } });
  const worker = await prisma.worker.create({ data: { firstName: 'Worker', lastName: 'DEMO', companyProfileId: company.id, loginCodeHash: hashPassword(code) } });
  await prisma.baustelle.create({ data: { companyProfileId: company.id, name: 'Workshop DEMO', type: 'STEEL_WORKSHOP', documents: [] } });
  try {
    for (const role of ['admin', 'worker'] as const) {
      const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto('/zugang');
      const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
      const manifest = await (await context.request.get(manifestUrl!)).json();
      expect(manifest).toMatchObject({ name, short_name: name, start_url: '/start', scope: '/', id: '/start', display: 'standalone', lang: 'sq' });
      for (const icon of manifest.icons) {
        const response = await context.request.get(icon.src);
        expect(response.ok()).toBe(true);
        expect(response.headers()['content-type']).toContain('image/png');
      }
      const cdp = await context.newCDPSession(page);
      const appManifest = await cdp.send('Page.getAppManifest');
      expect(appManifest.errors).toEqual([]);
      const installability = await cdp.send('Page.getInstallabilityErrors');
      console.log('INSTALLABILITY', JSON.stringify(installability));
      for (const theme of ['light', 'dark']) {
        await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
        await page.goto('/admin-login');
        await page.screenshot({ path: info.outputPath(`install-${role}-${theme}-360.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.goto(role === 'admin' ? '/admin-login' : '/workzone/login');
      if (role === 'admin') {
        await page.locator('[name=email]').fill(email); await page.locator('[name=password]').fill(password);
      } else {
        await page.locator('[name=name]').fill('Worker'); await page.locator('[name=loginCode]').fill(code);
      }
      await page.locator('button[type=submit]').click();
      await expect(page).toHaveURL(role === 'admin' ? /\/app\/dashboard$/ : /\/workzone\/profile$/);
      const cookie = (await context.cookies()).find(c => c.name === `bk_${role}_id`)!;
      expect(cookie.httpOnly).toBe(true); expect(cookie.secure).toBe(true);
      expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 364 * 86400);
      const storageState = await context.storageState();
      await context.close();
      const reopened = await browser.newContext({ storageState, baseURL: info.project.use.baseURL, viewport: { width: 1440, height: 900 } });
      const nextPage = await reopened.newPage();
      await nextPage.goto('/start');
      await expect(nextPage).toHaveURL(role === 'admin' ? /\/app\/dashboard$/ : /\/workzone$/);
      await nextPage.screenshot({ path: info.outputPath(`reopened-${role}-1440.png`) });
      expect((await reopened.request.post('/api/session/refresh', { headers: { origin: info.project.use.baseURL! } })).status()).toBe(204);
      if (role === 'admin') await prisma.user.update({ where: { id: admin.id }, data: { sessionEpoch: { increment: 1 } } });
      else await prisma.worker.update({ where: { id: worker.id }, data: { status: 'inactive' } });
      expect((await reopened.request.post('/api/session/refresh', { headers: { origin: info.project.use.baseURL! } })).status()).toBe(401);
      await reopened.close();
    }
  } finally {
    await prisma.user.deleteMany({ where: { companyProfileId: company.id } });
    await prisma.companyProfile.delete({ where: { id: company.id } });
  }
});
