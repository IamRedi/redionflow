import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { ensureSteelWorkCatalog } from '../../src/lib/steel-work/catalog';

async function workspace(page: Page, context: BrowserContext, base: string) {
  assertE2ETestDatabase(process.env);
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
  const company = await prisma.companyProfile.create({ data: { displayName: 'Update DEMO', legalName: 'Synthetic update tests only', mode: 'bau', country: 'AL' } });
  const admin = await prisma.user.create({ data: { companyProfileId: company.id, email: `update-${company.id}@example.test`, name: 'Update operator DEMO', role: 'ADMIN', isActive: true } });
  const site = await prisma.baustelle.create({ data: { companyProfileId: company.id, name: 'Update site DEMO', type: 'STEEL_ASSEMBLY' } });
  const tree = await prisma.treeItem.create({ data: { baustelleId: site.id, treeId: 'steel-task-update-demo', species: 'task', diameter: 0, status: 'done', completedAt: new Date('2026-11-17T09:00Z'), notes: JSON.stringify({ label: 'Update process DEMO', note: 'Original note DEMO', noteBy: 'Original operator DEMO', noteAt: '2026-11-17T10:00:00Z' }) } });
  await ensureSteelWorkCatalog(company.id);
  const task = await prisma.steelSiteTask.findUniqueOrThrow({ where: { treeItemId: tree.id } });
  await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', admin.id, admin.sessionEpoch), url: base }, { name: 'bk_lang', value: 'sq', url: base }]);
  const versionResponse = await context.request.get(`${base}/api/app-version`);
  expect(versionResponse.headers()['cache-control']).toContain('no-store');
  const current = (await versionResponse.json()).version as string;
  expect(current).toMatch(/^[\w-]{1,128}$/);
  let calls = 0, navigations = 0, loaded = false, mode: 'new' | 'same' | 'invalid' = 'new';
  await page.route('**/api/app-version', route => {
    calls++;
    return route.fulfill({ contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ version: mode === 'invalid' ? null : mode === 'new' ? `${current}-next` : current }) });
  });
  page.on('framenavigated', frame => { if (loaded && frame === page.mainFrame()) { navigations++; mode = 'same'; } });
  await page.clock.install();
  await page.goto(`/workzone/baustellen/${site.id}?view=production#prodhimi`);
  await expect(page.getByRole('heading', { name: site.name, exact: true })).toBeVisible();
  loaded = true;
  const checkTwice = async () => {
    await page.clock.runFor(2_000); await expect.poll(() => calls).toBeGreaterThanOrEqual(1);
    await page.clock.runFor(10_000); await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  };
  return { company, tree, task, checkTwice, current, calls: () => calls, navigations: () => navigations, mode: (value: typeof mode) => { mode = value; },
    cleanup: async () => { await prisma.user.deleteMany({ where: { companyProfileId: company.id } }); await prisma.companyProfile.delete({ where: { id: company.id } }); } };
}

test('an idle authenticated page updates itself once at the same URL and does not loop', async ({ page, context }, info) => {
  const f = await workspace(page, context, String(info.project.use.baseURL));
  try {
    const url = page.url(); await f.checkTwice(); await page.clock.runFor(6_000);
    await expect.poll(f.navigations).toBe(1); await expect(page).toHaveURL(url);
    await page.clock.runFor(120_000); expect(f.navigations()).toBe(1);
    const keys = await page.evaluate(() => Object.keys(sessionStorage));
    expect(keys).toContain('bk-app-update-reload');
    expect(await prisma.steelPhaseNote.count({ where: { taskId: f.task.id } })).toBe(0);
  } finally { await f.cleanup(); }
});

test('a real process draft stays intact through an update, saves exactly once, then updates when closed', async ({ page, context }, info) => {
  test.setTimeout(150_000);
  const f = await workspace(page, context, String(info.project.use.baseURL));
  try {
    const card = page.locator('[data-studio-phase-card]').filter({ has: page.getByText('Update process DEMO', { exact: true }) });
    if (!await card.count()) await page.getByTestId('phase-group-assembly').click();
    await card.click(); const sheet = page.getByRole('dialog', { name: 'Update process DEMO', exact: true });
    await sheet.getByRole('button', { name: 'Shto shënim', exact: true }).click();
    const text = sheet.getByRole('textbox', { name: 'Shto shënim', exact: true });
    await text.fill('Draft DEMO stays here until the operator saves');
    await f.checkTwice(); await expect(page.getByTestId('app-update-ready')).toBeVisible();
    for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 950 : 844 });
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
      await expect(text).toHaveValue('Draft DEMO stays here until the operator saves');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(await page.getByTestId('app-update-ready').evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
      await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/safe-update-${theme}-${width}.png` });
    }
    await page.clock.runFor(60_000); expect(f.navigations()).toBe(0);
    await sheet.getByRole('button', { name: 'Ruaj', exact: true }).click();
    await expect(sheet.locator('[data-studio-phase-notes]')).toContainText('Draft DEMO stays here until the operator saves');
    expect(await prisma.steelPhaseNote.count({ where: { taskId: f.task.id } })).toBe(2);
    await sheet.getByRole('button').first().click(); await expect(sheet).not.toBeVisible();
    await page.clock.runFor(7_000); await expect.poll(f.navigations).toBe(1);
    expect(await prisma.steelPhaseNote.count({ where: { taskId: f.task.id } })).toBe(2);
    expect(await prisma.treeItem.findUniqueOrThrow({ where: { id: f.tree.id } })).toMatchObject({ status: 'done', completedAt: new Date('2026-11-17T09:00Z') });
  } finally { await f.cleanup(); }
});

test('an in-flight write blocks updating and is never repeated by the updater', async ({ page, context }, info) => {
  const f = await workspace(page, context, String(info.project.use.baseURL));
  let release: () => void = () => {}, writes = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/fixture-update-write', async route => { writes++; await held; await route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
  try {
    await page.evaluate(() => { void fetch('/api/fixture-update-write', { method: 'POST', body: 'synthetic operation' }).then(() => document.body.setAttribute('data-fixture-finished', 'true')); });
    await expect.poll(() => writes).toBe(1); await f.checkTwice();
    await page.clock.runFor(30_000); expect(f.navigations()).toBe(0);
    release(); await expect(page.locator('body')).toHaveAttribute('data-fixture-finished', 'true');
    await page.clock.runFor(7_000); await expect.poll(f.navigations).toBe(1); expect(writes).toBe(1);
  } finally { release(); await f.cleanup(); }
});

test('invalid probes, offline state, file/password work and a real stale-action response cannot discard a draft', async ({ page, context }, info) => {
  test.setTimeout(120_000);
  const f = await workspace(page, context, String(info.project.use.baseURL));
  try {
    f.mode('invalid'); await f.checkTwice(); await page.clock.runFor(65_000); expect(f.navigations()).toBe(0);
    await page.evaluate(() => {
      const holder = document.createElement('section'); holder.id = 'fixture-update-draft';
      holder.innerHTML = '<label>Draft DEMO<input aria-label="Draft DEMO"></label><label>Upload DEMO<input type="file" aria-label="Upload DEMO"></label><input type="password" aria-label="Secret DEMO">';
      document.body.append(holder);
      // A programmatic/autofill edit can precede MutationObserver's first scan.
      const auto = document.createElement('input'); auto.setAttribute('aria-label', 'Autofill DEMO'); holder.append(auto);
      auto.value = 'Unfocused synthetic draft'; auto.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByLabel('Draft DEMO', { exact: true }).fill('Keep this unsaved synthetic text');
    await page.getByLabel('Upload DEMO', { exact: true }).setInputFiles({ name: 'synthetic.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic file') });
    await page.getByLabel('Secret DEMO', { exact: true }).fill('synthetic-only');
    const result = await page.evaluate(async () => {
      const r = await fetch(window.location.pathname, { method: 'POST', headers: { 'Next-Action': '0000000000000000000000000000000000000000', Accept: 'text/x-component' }, body: '[]' });
      return { status: r.status, notFound: r.headers.get('x-nextjs-action-not-found') };
    });
    expect(result).toEqual({ status: 404, notFound: '1' });
    await expect(page.getByTestId('app-update-ready')).toBeVisible();
    await context.setOffline(true); await page.clock.runFor(70_000); expect(f.navigations()).toBe(0);
    await expect(page.getByLabel('Draft DEMO', { exact: true })).toHaveValue('Keep this unsaved synthetic text');
    const storage = await page.evaluate(() => JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }));
    expect(storage).not.toContain('Keep this unsaved'); expect(storage).not.toContain('synthetic-only'); expect(storage).not.toContain('synthetic.txt');
    await context.setOffline(false); f.mode('same');
    await page.evaluate(() => document.getElementById('fixture-update-draft')?.querySelectorAll('input:not([aria-label="Autofill DEMO"])').forEach(e => e.remove()));
    await page.clock.runFor(7_000); expect(f.navigations()).toBe(0);
    await expect(page.getByLabel('Autofill DEMO', { exact: true })).toHaveValue('Unfocused synthetic draft');
    await page.evaluate(() => document.getElementById('fixture-update-draft')?.remove());
    await page.clock.runFor(7_000); await expect.poll(f.navigations).toBe(1);
  } finally { await context.setOffline(false); await f.cleanup(); }
});
