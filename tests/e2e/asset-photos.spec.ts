import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { hashPassword } from '../../src/lib/auth/password';

test('camera/upload covers replace vehicle, site and factory art with private compact WebP', async ({
  page,
  context,
  browser,
}, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(150000);
  let companyId: string | undefined;
  const marker = `photo-${Date.now()}`,
    email = `${marker}@example.test`;
  const photo = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#2a7b77' },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="2400" height="1600"><rect x="150" y="320" width="1800" height="800" fill="#e08a31"/><circle cx="600" cy="1130" r="180" fill="#222"/><circle cx="1700" cy="1130" r="180" fill="#222"/><text x="250" y="250" font-size="100" fill="white">SYNTHETIC PHOTO TEST</text></svg>',
        ),
      },
    ])
    .withMetadata({ orientation: 1 })
    .jpeg()
    .toBuffer();
  async function uploadCover(p: Page, kind: string, id: string) {
    const cover = p.getByTestId(`asset-photo-${kind}-${id}`).first();
    await cover.getByRole('button', { name: /Ndrysho foton:/ }).click();
    await expect(
      p.getByRole('button', { name: 'Hap kamerën', exact: true }),
    ).toBeVisible();
    await expect(
      cover.locator('input[data-photo-input="camera"]'),
    ).toHaveAttribute('capture', 'environment');
    await expect(
      p.getByRole('button', { name: 'Zgjidh foto', exact: true }),
    ).toBeVisible();
    const touchTarget = (await cover.locator('[data-photo-trigger]').boundingBox())!;
    expect(Math.round(touchTarget.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(touchTarget.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round((await cover.locator('[data-photo-glyph]').boundingBox())!.width)).toBeLessThanOrEqual(20);
    await cover
      .locator('input[data-photo-input="upload"]')
      .setInputFiles({
        name: 'synthetic-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: photo,
      });
    await expect(cover.getByRole('img')).toHaveAttribute(
      'src',
      new RegExp(`/api/asset-photos/${kind}/${id}`),
    );
    await expect(cover.getByRole('img')).toBeVisible();
    const response = await context.request.get(
      (await cover.getByRole('img').getAttribute('src')) as string,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/webp');
    expect(response.headers()['cache-control']).toBe('private, no-store');
    const bytes = await response.body(),
      meta = await sharp(bytes).metadata();
    expect(bytes.length).toBeLessThanOrEqual(180000);
    expect(meta.width).toBeLessThanOrEqual(1024);
    expect(meta.height).toBeLessThanOrEqual(1024);
    expect(meta.exif).toBeUndefined();
    return cover.getByRole('img').getAttribute('src');
  }
  try {
    await context.addCookies([
      { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
    ]);
    await page.goto('/signup?mode=bau');
    await page
      .locator('input[name="displayName"]')
      .fill('Synthetic Photo Firm');
    await page.locator('input[name="fullName"]').fill('Synthetic Photo Admin');
    await page.locator('input[name="email"]').fill(email);
    await page
      .locator('input[name="password"]')
      .fill('Synthetic-Photo-Test-123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId = (await prisma.user.findUniqueOrThrow({ where: { email } }))
      .companyProfileId!;
    const machine = await prisma.machine.create({
      data: {
        companyProfileId: companyId,
        name: 'Synthetic photo van',
        targe: 'ZZ789YY',
        hourlyRateCents: 0,
      },
    });
    const site = await prisma.baustelle.create({
      data: {
        companyProfileId: companyId,
        name: 'Synthetic photo site',
        type: 'STEEL_ASSEMBLY',
      },
    });
    const factory = await prisma.baustelle.create({
      data: {
        companyProfileId: companyId,
        name: 'Synthetic photo factory',
        type: 'STEEL_WORKSHOP',
      },
    });
    const worker = await prisma.worker.create({
      data: {
        companyProfileId: companyId,
        firstName: `Photo-${marker}`,
        lastName: 'Synthetic',
        crewRole: 'FIELD_WORKER',
        loginCodeHash: hashPassword('692814'),
      },
    });
    // Vehicle photos remain available in fleet control after the compact dock replaced the sidebar.
    await page.goto('/app/fleet-gps');
    const vehicleUrl = await uploadCover(page, 'machine', machine.id);
    await page.goto('/workzone');
    await uploadCover(page, 'site', site.id);
    await uploadCover(page, 'site', factory.id);
    await page.goto(`/workzone/admin-workers/${worker.id}`);
    await uploadCover(page, 'worker', worker.id);
    await page.goto('/workzone');
    await page.reload();
    await expect(
      page.getByTestId(`asset-photo-site-${site.id}`).getByRole('img'),
    ).toBeVisible();
    await expect(
      page.getByTestId(`asset-photo-site-${factory.id}`).getByRole('img'),
    ).toBeVisible();
    await page.goto(`/workzone/baustellen/${site.id}`);
    await expect(
      page.getByTestId(`asset-photo-site-${site.id}`).getByRole('img'),
    ).toBeVisible();
    await page.goto('/app/fleet-gps');
    await expect(
      page.getByTestId(`asset-photo-machine-${machine.id}`).getByRole('img'),
    ).toBeVisible();
    await page.goto('/workzone');
    for (const [label, width, height] of [
      ['desktop', 1440, 1000],
      ['phone', 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.screenshot({
        path: info.outputPath(`asset-photos-${label}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    expect(
      await prisma.assetPhoto.count({ where: { companyProfileId: companyId } }),
    ).toBe(4);
    const anonymous = await browser.newContext({
      baseURL: info.project.use.baseURL,
    });
    try {
      expect((await anonymous.request.get(vehicleUrl!)).status()).toBe(404);
    } finally {
      await anonymous.close();
    }
    const employee = await browser.newContext({
      baseURL: info.project.use.baseURL,
    });
    try {
      await employee.addCookies([
        { name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! },
      ]);
      const p = await employee.newPage();
      await p.goto('/workzone/login');
      await p
        .locator('input[name="name"]')
        .fill(`${worker.firstName} ${worker.lastName}`);
      await p.locator('input[name="loginCode"]').fill('692814');
      await p.getByRole('button', { name: /Hyr|Sign in|Einloggen/ }).click();
      await expect(p).toHaveURL(/\/workzone\/profile$/);
      await p.goto('/workzone');
      await expect(
        p.getByRole('button', { name: /Ndrysho foton:/ }),
      ).toHaveCount(0);
      expect((await employee.request.get(vehicleUrl!)).status()).toBe(200);
    } finally {
      await employee.close();
    }
  } finally {
    if (companyId)
      await prisma.companyProfile.delete({ where: { id: companyId } });
  }
});
