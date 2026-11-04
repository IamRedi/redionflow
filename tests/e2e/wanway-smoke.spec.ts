import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';

test('WanWay: saved credentials → discover → confirmed existing vehicle → offline telemetry → transient route → disconnect', async ({
  page,
  context,
}, info) => {
  test.skip(
    process.env.WANWAY_E2E_MOCK !== 'true',
    'Requires the explicit disposable WanWay mock preload',
  );
  test.setTimeout(120000);
  assertE2ETestDatabase(process.env);
  const email = `wanway-${Date.now()}@example.test`;
  let companyId: string | undefined;
  await context.addCookies([
    { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
  ]);
  try {
    await page.goto('/signup?mode=bau');
    await page
      .locator('input[name="displayName"]')
      .fill('Synthetic Steel Demo');
    await page.locator('input[name="fullName"]').fill('Synthetic Admin');
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
    await prisma.machine.createMany({
      data: Array.from({ length: 37 }, (_, i) => ({
        companyProfileId: companyId!,
        name: `Synthetic vehicle ${i + 1}`,
        targe: `TEST-${i + 1}`,
        hourlyRateCents: 100,
      })),
    });
    const machine = await prisma.machine.findFirstOrThrow({
      where: { companyProfileId: companyId },
    });
    await prisma.machine.update({
      where: { id: machine.id },
      data: { name: 'Synthetic matched vehicle', targe: 'ZZ123YY' },
    });
    await page.goto('/app/settings');
    await page.getByRole('link', { name: 'WanWay GPS →' }).click();
    await expect(
      page.getByRole('heading', { name: 'WanWay GPS', exact: true }),
    ).toBeVisible();
    await page.locator('input[name="appid"]').fill('synthetic-wanway-app');
    await page.locator('input[name="key"]').fill('synthetic-wanway-key');
    await page.locator('input[name="approved"]').check();
    await page.getByRole('button', { name: 'Ruaj / Përditëso' }).click();
    await expect(page.getByRole('status')).toHaveText('U përfundua');
    await expect(page.locator('input[name="key"]')).toHaveValue('');
    await page.getByRole('button', { name: 'Provo lidhjen' }).click();
    await expect(
      page.getByText('Synthetic GPS [ZZ 123 YY]', { exact: true }),
    ).toBeVisible();
    expect(await page.content()).not.toContain('000000000000001');
    expect(await page.content()).not.toContain('synthetic-wanway-key');
    await expect(page.locator('select[name="machineId"]')).toHaveValue(machine.id);
    await expect(page.getByText('Mjeti përkatës u zgjodh. Kontrolloje dhe konfirmo lidhjen.', { exact: true })).toBeVisible();
    expect((await prisma.wanwayDevice.findFirstOrThrow({ where: { companyProfileId: companyId } })).machineId).toBeNull();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: info.outputPath('wanway-suggested-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: info.outputPath('wanway-suggested-phone.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page
      .getByRole('button', { name: 'Konfirmo lidhjen', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText('U përfundua');
    expect((await prisma.wanwayDevice.findFirstOrThrow({ where: { companyProfileId: companyId } })).machineId).toBe(machine.id);
    await prisma.wanwayIntegration.update({
      where: { companyProfileId: companyId },
      data: { nextRequestAt: new Date(0) },
    });
    await page.getByRole('button', { name: 'Sinkronizo / Rifresko' }).click();
    await expect(page.getByRole('status')).toHaveText('U përfundua · 1');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: info.outputPath('wanway-panel-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath('wanway-panel-phone.png'),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto(`/app/fleet-gps/${machine.id}`);
    await expect(
      page.getByText('Offline / gjendje e panjohur', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('12.3 V', { exact: true })).toBeVisible();
    await expect(page.getByText('0 km/h', { exact: true })).toBeVisible();
    await prisma.wanwayIntegration.update({
      where: { companyProfileId: companyId },
      data: { nextRequestAt: new Date(0) },
    });
    await page
      .getByRole('button', { name: 'Lexo rrugën · 24 orët e fundit' })
      .click();
    await expect(page.getByRole('status')).toHaveText('U përfundua · 2');
    await page.getByRole('button', { name: 'Shfaq hartën' }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await page.screenshot({
      path: info.outputPath('wanway-telemetry-phone.png'),
      fullPage: true,
    });
    await page.goto('/app/settings/integrations/wanway');
    await page.getByRole('button', { name: 'Shkëput', exact: true }).click();
    await page
      .getByRole('button', { name: 'Konfirmo shkëputjen', exact: true })
      .click();
    await expect(page.getByRole('status')).toHaveText('U përfundua');
    await expect(
      page.getByText('Pajisjet e gjetura (0)', { exact: true }),
    ).toBeVisible();
    expect(
      await prisma.machine.count({ where: { companyProfileId: companyId } }),
    ).toBe(37);
    expect(
      await prisma.wanwayDevice.count({
        where: { companyProfileId: companyId },
      }),
    ).toBe(0);
  } finally {
    if (companyId)
      await prisma.companyProfile.delete({ where: { id: companyId } });
  }
});
