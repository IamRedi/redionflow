import { expect, test, type Locator } from '@playwright/test';
import { seedOfficeE2E } from '../fixtures/office-e2e';
// Register per file: imported modules are cached across Playwright files.
test.beforeEach(seedOfficeE2E);
import { writeFile, mkdir } from 'node:fs/promises';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';

const baseline = process.env.OFFICE_OVERLAY_BASELINE === 'true';
const companyId = 'office-e2e-company', adminId = 'office-e2e-megi';
test.use({ actionTimeout: 10000 });
test('office routes and nested controls stay above the team and inside the viewport', async ({ page, context, baseURL }, info) => {
  test.setTimeout(240000); assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL, out = process.env.OFFICE_OVERLAY_EVIDENCE_DIR ?? info.outputDir;
  const errors: string[] = [], receipts: object[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  // The configured synthetic manager owns this fixture; no hosted data is used.
  await mkdir(out, { recursive: true });
  await prisma.companyProfile.update({ where: { id: companyId }, data: { displayName: 'Synthetic Assets · DEMO' } });
  try {
    await prisma.user.upsert({ where:{id:adminId}, update:{}, create: { id: adminId, name: 'Chief · DEMO', email: 'office-overlay@example.test', companyProfileId: companyId, role: 'ADMIN', isActive: true } });
    const seed = await seedSteelAssetsWorkshop(companyId, 'office-overlay');
    await prisma.worker.createMany({ data: Array.from({ length: 14 }, (_, i) => ({ companyProfileId: companyId, firstName: `Person ${i}`, lastName: 'Synthetic' })) });
    await prisma.officeMember.upsert({ where: { companyProfileId_userId: { companyProfileId: companyId, userId: adminId } }, update: { title: 'Administration · DEMO', enabled: true, workbooksEnabled: true }, create: { id: 'office-overlay-chief', userId: adminId, companyProfileId: companyId, title: 'Administration · DEMO', enabled: true, workbooksEnabled: true } });
    await prisma.siteFile.create({ data: { companyProfileId: companyId, baustelleId: seed.site.id, kind: 'document', fileName: 'Synthetic-office-document.pdf', mime: 'application/pdf', size: 20, data: Buffer.from('%PDF-1.4\nDEMO\n%%EOF'), uploadedByName: 'Synthetic Chief' } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', adminId, user.sessionEpoch), url: origin }, { name: 'bk_lang', value: 'sq', url: origin }]);
    const records = async () => JSON.stringify({ files: await prisma.siteFile.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), grants: await prisma.accessGrant.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }), repairs: await prisma.companyAssetRepair.findMany({ where: { companyProfileId: companyId }, orderBy: { id: 'asc' } }) });
    const before = await records();
    async function check(target: Locator, label: string) {
      await target.scrollIntoViewIfNeeded();
      const state = await target.evaluate(el => {
        const r = el.getBoundingClientRect(), x = Math.min(innerWidth - 1, Math.max(0, r.x + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.y + r.height / 2));
        return { top: r.top, right: r.right, bottom: r.bottom, width: r.width, hit: el.contains(document.elementFromPoint(x, y)), vw: innerWidth, vh: innerHeight };
      });
      receipts.push({ label, url: new URL(page.url()).pathname, ...state });
      if (!baseline) {
        expect(state.top, label).toBeGreaterThanOrEqual(-1); expect(state.right, label).toBeLessThanOrEqual(state.vw + 1); expect(state.bottom, label).toBeLessThanOrEqual(state.vh + 1);
        expect(state.hit, label).toBe(true); await target.click({ trial: true });
      }
    }
    for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [390, 844], [320, 740], [760, 360]]) {
      await page.setViewportSize({ width, height }); await context.addCookies([{ name: 'bk_theme', value: theme, url: origin }]);
      for (const view of ['tasks', 'mail', 'resources', 'workbooks', 'team']) {
        await page.goto(view === 'team' ? '/workzone/offices/team' : `/workzone/offices/me/${view}`);
        await expect(page.locator('[data-office-view]')).toBeVisible();
        const back = page.locator('[data-office-view] nav a').first(); await check(back, `${view}-${theme}-${width}-back`);
        if (!baseline) {
          await expect(page.getByTestId('workzone-topbar')).not.toBeVisible();
          expect(await page.locator('[data-office-view]').evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        }
        if (view === 'tasks') {
          await page.getByRole('button', { name: 'Shto', exact: true }).first().click({ force: baseline });
          await check(page.getByRole('button', { name: 'Kthehu te ditari', exact: true }), `task-editor-${theme}-${width}`);
          await page.getByRole('button', { name: 'Kthehu te ditari', exact: true }).click({ force: baseline });
        }
        if (view === 'mail') {
          await page.getByRole('button', { name: 'Shkruaj', exact: true }).click({ force: baseline });
          await check(page.getByRole('button', { name: 'Posta', exact: true }), `mail-editor-${theme}-${width}`);
        }
        if (['tasks', 'resources'].includes(view)) await page.screenshot({ path: `${out}/${baseline ? 'before' : 'after'}-${view}-${theme}-${width}.png` });
      }
      await page.goto(`/workzone/offices/me/resources/${seed.site.id}`);
      await check(page.locator('[data-office-view] nav a').first(), `folder-${theme}-${width}`);
      await page.locator('[data-testid=office-native-files] button').first().click({ force: baseline });
      const sheet = page.locator('[data-studio-process-sheet]'); await expect(sheet).toBeVisible();
      await check(sheet.getByRole('button', { name: 'Mbyll', exact: true }), `document-close-${theme}-${width}`);
      await check(sheet.getByRole('button', { name: 'Fshi', exact: true }), `document-delete-${theme}-${width}`);
      await sheet.getByRole('button', { name: 'Mbyll', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await page.getByTestId('phase-documents-open').click();
      const phases = page.getByRole('dialog'); await check(phases.getByRole('button', { name: 'Mbyll', exact: true }), `phases-close-${theme}-${width}`);
      await phases.getByRole('button', { name: 'Mbyll', exact: true }).click();
      await page.goto('/workzone/offices/me');
      await check(page.getByTestId('office-floating-nav').getByRole('link', { name: 'Recepsioni', exact: true }), `room-back-${theme}-${width}`);
      await page.goto('/workzone/plan?office=desk');
      if (width < 1024) await check(page.getByTestId('plan-close'), `plan-back-${theme}-${width}`);
      // Existing discard confirmation is nested inside a full-screen plan on phones.
      const reset = page.getByTestId('plan-actions').getByRole('button', { name: /Pastro|Reset/ });
      if (await reset.count()) {
        await reset.click(); const confirm = page.getByRole('heading', { level: 3 }).last();
        if (await confirm.count()) {
          await check(confirm, `confirmation-${theme}-${width}`);
          const cancel = confirm.locator('../..').getByRole('button', { name: 'Anulo', exact: true });
          await check(cancel, `confirmation-cancel-${theme}-${width}`); await cancel.click({ force: baseline });
          if (!baseline) await expect(reset).toBeFocused();
        }
      }
      await page.goto('/workzone');
      await expect(page.getByTestId('workzone-topbar')).toBeVisible();
      await check(page.getByTestId('flow-team-strip').getByRole('button').first(), `restored-team-${theme}-${width}`);
    }
    if (!baseline) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/workzone/offices/me/tasks');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await check(page.locator('[data-office-view] nav a').first(), 'text-zoom-return');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.getByRole('button', { name: 'Shto', exact: true }).first().click();
      // Short visual area with a focused form approximates keyboard-constrained space.
      await page.setViewportSize({ width: 390, height: 430 });
      await page.getByLabel('Emri i detyrës', { exact: true }).focus();
      await check(page.getByRole('button', { name: 'Kthehu te ditari', exact: true }), 'short-form-return');
      await check(page.getByTestId('task-composer').getByRole('button', { name: 'Shto', exact: true }), 'short-form-save');
    }
    expect(await records()).toBe(before); expect(errors).toEqual([]);
  } finally {
    await writeFile(`${out}/${baseline ? 'before' : 'after'}-controls.json`, JSON.stringify(receipts, null, 2));
    await prisma.officeTask.deleteMany({ where: { companyProfileId: companyId } });
    await prisma.officeMember.deleteMany({ where: { companyProfileId: companyId } });
    await cleanupSteelAssetsWorkshop(companyId);
  }
});
