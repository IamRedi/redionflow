import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { localClock, parseFuelClock } from '../../src/lib/fleet/fuel/time';

async function receiptPhoto(context: BrowserContext, clock: string) {
  const photo = await context.newPage();
  await photo.setViewportSize({ width: 1400, height: 750 });
  const [day, time] = clock.split('T');
  const [year, month, date] = day.split('-');
  await photo.setContent(
    `<html><body style="background:white;color:black;font:36px monospace;padding:40px"><h1 style="font-size:44px">SYNTHETIC FUEL RECEIPT</h1><p>TEST DATA ONLY - NOT A REAL INVOICE</p><p>Date: ${date}.${month}.${year} Time: ${time}</p><p>Fuel: 40 L</p><p>Total: 2500 ALL</p><p>Synthetic station - test only</p></body></html>`,
  );
  const bytes = await photo.screenshot();
  await photo.close();
  return bytes;
}
async function workerLogin(page: Page, name: string, code: string) {
  await page.goto('/workzone/login');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="loginCode"]').fill(code);
  await page
    .getByRole('button', { name: /Hyr|Einloggen|Sign in|Log in/i })
    .click();
  await expect(page).toHaveURL(/\/workzone\/profile$/);
}
test('fleet workflow: yellow/green confirmation → new vehicle → shared Workzone map → Maps card → fuel OCR/manual time → private history', async ({
  page,
  context,
  browser,
}, info) => {
  test.skip(
    process.env.WANWAY_E2E_MOCK !== 'true',
    'Requires the explicit disposable WanWay mock',
  );
  test.setTimeout(180000);
  assertE2ETestDatabase(process.env);
  const marker = `fleet-${Date.now()}`,
    email = `${marker}@example.test`;
  let companyId: string | undefined;
  const extraContexts: BrowserContext[] = [];
  try {
    await context.addCookies([
      { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
    ]);
    await page.goto('/signup?mode=bau');
    await page
      .locator('input[name="displayName"]')
      .fill('Synthetic Fleet Demo');
    await page.locator('input[name="fullName"]').fill('Synthetic Fleet Admin');
    await page.locator('input[name="email"]').fill(email);
    await page
      .locator('input[name="password"]')
      .fill('Synthetic-Test-Only-123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email } });
    companyId = admin.companyProfileId!;
    await prisma.companyProfile.update({
      where: { id: companyId },
      data: { country: 'AL' },
    });
    const machine = await prisma.machine.create({
      data: {
        companyProfileId: companyId,
        name: 'Synthetic matched van',
        targe: 'ZZ123YY',
        hourlyRateCents: 0,
      },
    });
    const alice = await prisma.worker.create({
      data: {
        companyProfileId: companyId,
        firstName: `Alice-${marker}`,
        lastName: 'Synthetic',
        loginCodeHash: hashPassword('392718'),
      },
    });
    const bob = await prisma.worker.create({
      data: {
        companyProfileId: companyId,
        firstName: `Bob-${marker}`,
        lastName: 'Synthetic',
        loginCodeHash: hashPassword('392719'),
      },
    });
    await prisma.baustelle.create({
      data: {
        companyProfileId: companyId,
        name: 'Synthetic steel site',
        type: 'STEEL_ASSEMBLY',
        coordinates: { lat: 41.205, lng: 19.705 },
      },
    });
    await page.goto('/app/settings/integrations/wanway');
    await page.locator('input[name="appid"]').fill('synthetic-fleet-app');
    await page.locator('input[name="key"]').fill('synthetic-fleet-key');
    await page.locator('input[name="approved"]').check();
    await page.getByRole('button', { name: 'Ruaj / Përditëso' }).click();
    await expect(page.getByRole('status')).toHaveText('U përfundua');
    await page.getByText('Cilësimet e lidhjes', { exact: true }).click();
    await page
      .getByRole('button', { name: 'Provo lidhjen', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Synthetic GPS [ZZ 123 YY]',
        exact: true,
      }),
    ).toBeVisible();
    const second = await prisma.wanwayDevice.create({
      data: {
        companyProfileId: companyId,
        imei: '000000000000002',
        name: 'Synthetic unrecognized GPS',
        lat: 41.203,
        lng: 19.703,
        reportedAt: new Date(Date.now() - 60000),
        syncedAt: new Date(),
        providerStatus: 'offline',
      },
    });
    await page.reload();
    const matched = page.locator('article').filter({
      has: page.getByRole('heading', {
        name: 'Synthetic GPS [ZZ 123 YY]',
        exact: true,
      }),
    });
    const manual = page.locator('article').filter({
      has: page.getByRole('heading', {
        name: 'Synthetic unrecognized GPS',
        exact: true,
      }),
    });
    await expect(matched).toHaveAttribute('data-state', 'pending');
    await expect(manual.locator('select[name="machineId"]')).toHaveValue('');
    await expect(matched.locator('select[name="machineId"]')).toHaveValue(
      machine.id,
    );
    await matched
      .getByRole('button', { name: 'Konfirmo lidhjen', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Të konfirmuara (1)', exact: true }),
    ).toBeVisible();
    await expect(manual).toBeVisible();
    await manual
      .getByRole('button', { name: 'Mungon mjeti? Shtoje', exact: true })
      .click();
    await manual
      .locator('input[name="newMachineName"]')
      .fill('Synthetic new truck');
    await manual.locator('input[name="newMachinePlate"]').fill('XX456WW');
    await manual
      .getByRole('button', { name: 'Shto mjetin dhe konfirmo', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText('U përfundua');
    const linked = await prisma.wanwayDevice.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(linked.machineId).not.toBeNull();
    expect(
      await prisma.machine.count({ where: { companyProfileId: companyId } }),
    ).toBe(2);
    await page
      .getByRole('button', { name: 'Të konfirmuara (2)', exact: true })
      .click();
    await expect(page.locator('article[data-state="confirmed"]')).toHaveCount(
      2,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: info.outputPath('fleet-confirmed-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath('fleet-confirmed-phone.png'),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await prisma.wanwayIntegration.update({
      where: { companyProfileId: companyId },
      data: { nextRequestAt: new Date(0) },
    });
    await page
      .getByRole('button', { name: 'Sinkronizo / Rifresko', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText('U përfundua · 1');
    await page.goto('/app/fleet-gps');
    await expect(page.getByTestId('fleet-vehicle-card')).toHaveCount(2);
    await expect(
      page
        .getByTestId('fleet-vehicle-card')
        .filter({ hasText: 'ZZ123YY' })
        .getByRole('link', { name: 'Maps', exact: true }),
    ).toHaveAttribute('href', /query=41\.2000000,19\.7000000/);
    for (const [label, width, height] of [
      ['desktop', 1440, 1000],
      ['phone', 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.screenshot({
        path: info.outputPath(`fleet-overview-${label}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page
      .getByRole('link', { name: 'Harta e Workzone', exact: true })
      .click();
    await expect(page.getByTestId('workzone-fleet-map')).toBeVisible();
    await expect(
      page.locator('.leaflet-marker-icon[title="Makinat: ZZ123YY"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        '.leaflet-marker-icon[title="Kantieret: Synthetic steel site"]',
      ),
    ).toHaveText('🏗️');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: info.outputPath('fleet-workzone-map-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath('fleet-workzone-map-phone.png'),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator('.leaflet-marker-icon[title="Makinat: ZZ123YY"]')
      .click();
    await expect(
      page
        .locator('.leaflet-popup')
        .getByRole('link', { name: 'Maps', exact: true }),
    ).toHaveAttribute('href', /query=41\.2000000,19\.7000000/);
    await page
      .locator('.leaflet-popup')
      .getByRole('button', { name: 'Flota', exact: true })
      .click();
    const card = page.getByRole('dialog', {
      name: 'Synthetic matched van',
      exact: true,
    });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('link', { name: 'Maps', exact: true }),
    ).toHaveAttribute('href', /query=41\.2000000,19\.7000000/);
    await card
      .getByRole('link', { name: 'Ngarko karburant', exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/workzone/fuel\\?machine=${machine.id}`),
    );
    const invoiceClock = localClock(
      new Date(Date.now() - 10 * 60000),
      'Europe/Tirane',
    );
    const receiptBytes = await receiptPhoto(context, invoiceClock);
    await page.locator('input[name="fuelReceipt"]').setInputFiles({
      name: 'synthetic-fuel.png',
      mimeType: 'image/png',
      buffer: receiptBytes,
    });
    await page
      .getByRole('button', { name: 'Lexo faturën', exact: true })
      .click();
    await expect(page.locator('input[name="fuelClock"]')).toHaveValue(
      invoiceClock,
    );
    await expect(
      page.getByText('Ora u lexua nga fatura. Kontrolloje para konfirmimit.', {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .locator('select[name="fueledByWorkerId"]')
      .selectOption(alice.id);
    await prisma.wanwayIntegration.update({
      where: { companyProfileId: companyId },
      data: { nextRequestAt: new Date(0) },
    });
    await page
      .getByRole('button', { name: 'Konfirmo furnizimin', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText('Furnizimi u ruajt');
    const first = await prisma.fuelReceipt.findFirstOrThrow({
      where: { companyProfileId: companyId },
    });
    expect(first.uploadedByUserId).toBe(admin.id);
    expect(first.fueledByWorkerId).toBe(alice.id);
    expect(first.fueledAt?.toISOString()).toBe(
      parseFuelClock(invoiceClock, 'Europe/Tirane')?.toISOString(),
    );
    expect(first.uploadedAt.getTime()).toBeGreaterThan(
      first.fueledAt!.getTime(),
    );
    expect(first.gpsStatus).toBe('matched');
    expect(first.gpsDeltaSeconds).toBe(-30);
    expect(Buffer.from(first.data)).toEqual(receiptBytes);
    const receiptUrl = `/api/fuel-receipts/${first.id}`;
    expect(
      Buffer.from(await (await context.request.get(receiptUrl)).body()),
    ).toEqual(receiptBytes);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: info.outputPath('fleet-fuel-log-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath('fleet-fuel-log-phone.png'),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const workerContext = await browser.newContext({
      baseURL: info.project.use.baseURL,
    });
    extraContexts.push(workerContext);
    await workerContext.addCookies([
      { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
    ]);
    const workerPage = await workerContext.newPage();
    await workerLogin(
      workerPage,
      `${alice.firstName} ${alice.lastName}`,
      '392718',
    );
    await workerPage.goto(`/workzone/fuel?machine=${machine.id}`);
    await expect(workerPage.getByTestId('fuel-receipt-card')).toHaveCount(1);
    expect((await workerContext.request.get(receiptUrl)).status()).toBe(200);
    await workerPage.locator('input[name="fuelReceipt"]').setInputFiles({
      name: 'synthetic-unreadable.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yL5sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await workerPage
      .getByRole('button', { name: 'Lexo faturën', exact: true })
      .click();
    await expect(
      workerPage.getByText(
        'Ora në faturë nuk u lexua qartë. Vendos datën dhe orën e shënuar në të.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(workerPage.locator('input[name="fuelClock"]')).toHaveValue('');
    await workerPage.locator('input[name="fuelClock"]').fill(invoiceClock);
    await workerPage
      .getByRole('button', { name: 'Konfirmo furnizimin', exact: true })
      .click();
    await expect(workerPage.getByRole('status')).toHaveText(
      'Furnizimi u ruajt',
    );
    const own = await prisma.fuelReceipt.findFirstOrThrow({
      where: { companyProfileId: companyId, uploadedByWorkerId: alice.id },
    });
    expect(own.fueledByWorkerId).toBe(alice.id);
    expect(own.timeSource).toBe('manual');
    const coworkerContext = await browser.newContext({
      baseURL: info.project.use.baseURL,
    });
    extraContexts.push(coworkerContext);
    await coworkerContext.addCookies([
      { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
    ]);
    const coworker = await coworkerContext.newPage();
    await workerLogin(coworker, `${bob.firstName} ${bob.lastName}`, '392719');
    await coworker.goto('/workzone/fuel');
    await expect(coworker.getByTestId('fuel-receipt-card')).toHaveCount(0);
    expect((await coworkerContext.request.get(receiptUrl)).status()).toBe(404);
  } finally {
    for (const ctx of extraContexts) await ctx.close();
    if (companyId)
      await prisma.companyProfile.delete({ where: { id: companyId } });
  }
});
