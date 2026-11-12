import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { dateKey, dayRange } from '../../src/lib/workzone/date-utils';

const baseline = process.env.STEEL_PROFILE_CRYSTAL_BASELINE === 'true';
test('crystal profiles, notebooks and illustrated process cards preserve hours and access', async ({ page, context, baseURL }, info) => {
  test.setTimeout(180000); assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL;
  const out = process.env.STEEL_PROFILE_CRYSTAL_EVIDENCE_DIR ?? info.outputDir;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  let companyId: string | undefined;
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
    await page.goto('/signup?mode=bau');
    const email = `profile-crystal-${Date.now()}@example.test`;
    for (const [name, value] of Object.entries({ displayName: 'Synthetic profile', fullName: 'Synthetic Administrator', email, password: 'Synthetic-Crystal-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
    const admin = await prisma.user.findUniqueOrThrow({ where: { email } }); companyId = admin.companyProfileId!;
    const seed = await seedSteelAssetsWorkshop(companyId, `crystal-${Date.now()}`);
    await prisma.worker.update({ where: { id: seed.worker.id }, data: { firstName: 'Arben', lastName: 'Demo', position: 'Punëtor terreni' } });
    const date = dateKey(new Date()), month = date.slice(0, 7), start = dayRange(date).start.getTime();
    await prisma.workSession.create({ data: { workerId: seed.worker.id, baustelleId: seed.site.id, startTime: new Date(start + 8 * 3600000), endTime: new Date(start + 16 * 3600000), breakMinutes: 60, totalHours: 7, isLive: false } });
    const sessionsBefore = JSON.stringify(await prisma.workSession.findMany({ where: { workerId: seed.worker.id }, orderBy: { id: 'asc' } }));
    const workBefore = await prisma.siteElementWork.count({ where: { elementId: seed.element.id } });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const shot = async (name: string) => page.screenshot({ path: `${out}/${baseline ? 'before' : 'after'}-${name}.png` });
    for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 1000], [390, 844], [320, 740], [760, 360]]) {
      await page.setViewportSize({ width, height });
      await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
      await page.goto(`/workzone/admin-workers/${seed.worker.id}`); await expect(page.getByTestId('worker-profile')).toBeVisible(); await fits();
      await expect(page.getByTestId('worker-profile-metrics')).toContainText('7.0 h');
      await shot(`profile-${theme}-${width}`);
      await page.goto(`/app/admin/workers/${seed.worker.id}/month/${month}`); await expect(page.getByTestId('timesheet-total')).toHaveText('7:00'); await fits(); await shot(`month-${theme}-${width}`);
      await page.goto(`/app/admin/workers/${seed.worker.id}/day/${date}`); await expect(page.getByRole('heading', { name: /Raporti ditor/ }).first()).toBeVisible(); await fits(); await shot(`day-${theme}-${width}`);
      await page.goto(`/workzone/baustellen/${seed.site.id}`);
      await page.getByRole('button', { name: /^Lista e fabrikës/ }).click();
      await page.getByRole('dialog').last().getByRole('button').filter({ has: page.getByText(seed.element.mark, { exact: true }) }).click();
      if (!baseline) {
        const cards = page.getByTestId('element-process-card'); await expect(cards).toHaveCount(6);
        await expect(cards.locator('[data-steel-work-visual]')).toHaveCount(6);
        expect(await cards.evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }))).toBe(true);
      }
      await fits(); await shot(`process-${theme}-${width}`);
    }
    if (!baseline) {
      await page.goto(`/app/admin/workers/${seed.worker.id}/month/${month}`); await page.emulateMedia({ media: 'print' });
      await expect(page.getByTestId('timesheet-print')).toBeVisible(); await expect(page.getByTestId('timesheet-card')).not.toBeVisible(); await shot('notebook-print');
      await page.emulateMedia({ media: 'screen' });
      await context.clearCookies(); await context.addCookies([{ name: 'bk_worker_id', value: await createSessionCookie('worker', seed.worker.id, seed.worker.sessionEpoch), url: origin }, { name: 'bk_lang', value: 'sq', url: origin }]);
      await page.goto('/workzone/profile'); await expect(page.getByTestId('worker-profile')).toContainText('Arben Demo');
      await page.goto(`/workzone/profile/month/${month}`); await expect(page.getByTestId('timesheet-total')).toHaveText('7:00');
      await page.goto(`/workzone/profile/day/${date}`); await fits();
      await page.goto('/workzone/profile'); await page.setViewportSize({ width: 390, height: 600 });
      await page.evaluate(() => document.documentElement.style.fontSize = '200%'); await fits(); await shot('profile-text-zoom');
      await page.evaluate(() => document.documentElement.style.fontSize = '');
      expect(JSON.stringify(await prisma.workSession.findMany({ where: { workerId: seed.worker.id }, orderBy: { id: 'asc' } }))).toBe(sessionsBefore);
      expect(await prisma.siteElementWork.count({ where: { elementId: seed.element.id } })).toBe(workBefore);
      expect(errors).toEqual([]);
    }
  } finally { if (companyId) await cleanupSteelAssetsWorkshop(companyId); }
});


test('office navigation floats above the scene without a divider', async ({ page, context, baseURL }, info) => {
  assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL;
  const companyId = 'office-e2e-company', adminId = 'office-e2e-megi';
  await prisma.companyProfile.upsert({ where: { id: companyId }, update: {}, create: { id: companyId, displayName: 'Office Studio · DEMO', legalName: 'Synthetic office only', mode: 'bau', country: 'AL' } });
  const admin = await prisma.user.upsert({ where: { id: adminId }, update: {}, create: { id: adminId, companyProfileId: companyId, name: 'Office Demo', email: 'office-profile-crystal@example.test', role: 'ADMIN' } });
  await prisma.worker.upsert({ where: { id: 'office-e2e-worker-megi' }, update: {}, create: { id: 'office-e2e-worker-megi', companyProfileId: companyId, firstName: 'Office', lastName: 'Demo', crewRole: 'OFFICE' } });
  await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', admin.id, admin.sessionEpoch), url: origin }, { name: 'bk_lang', value: 'sq', url: origin }]);
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height }); await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
    for (const route of ['/workzone/offices/me', '/workzone/offices']) {
      await page.goto(route);
      const nav = page.locator('[data-office-fullscreen]>nav'); await expect(nav).toBeVisible();
      if (!baseline) expect(await nav.evaluate(el => getComputedStyle(el).borderBottomWidth)).toBe('0px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `${process.env.STEEL_PROFILE_CRYSTAL_EVIDENCE_DIR ?? info.outputDir}/${baseline ? 'before' : 'after'}-office-${route.endsWith('/me') ? 'room' : 'reception'}-${theme}-${width}.png` });
    }
  }
});
