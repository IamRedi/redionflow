import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { ensureSteelWorkCatalog } from '../../src/lib/steel-work/catalog';

test('process diary keeps old notes, appends real authors and dates, filters and stays compact on phones', async ({ page, context }, info) => {
 test.setTimeout(180000); assertE2ETestDatabase(process.env);
 const base = String(info.project.use.baseURL), errors: string[] = [];
 page.on('pageerror', e => errors.push(e.message));
 await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
 const company = await prisma.companyProfile.create({ data: { displayName: 'Diary DEMO', legalName: 'Synthetic diary only', mode: 'bau', country: 'AL' } });
 const title = 'Montim paneli · DEMO';
 try {
  const admin = await prisma.user.create({ data: { companyProfileId: company.id, email: `diary-${company.id}@example.test`, name: 'Megi DEMO', role: 'ADMIN', isActive: true } });
  const worker = await prisma.worker.create({ data: { companyProfileId: company.id, firstName: 'Inxhinier', lastName: 'DEMO', crewRole: 'FIELD_ENGINEER', status: 'active' } });
  const site = await prisma.baustelle.create({ data: { companyProfileId: company.id, name: 'Diary site DEMO', type: 'STEEL_ASSEMBLY' } });
  const oldNotes = JSON.stringify({ label: title, note: 'Shënimi origjinal i ruajtur', noteBy: 'Autor i vjetër DEMO', noteAt: '2026-11-17T10:00:00Z', doneBy: 'Konfirmues DEMO' });
  const completedAt = new Date('2026-11-17T09:00:00Z');
  const tree = await prisma.treeItem.create({ data: { baustelleId: site.id, treeId: 'steel-task-demo-diary', species: 'task', diameter: 0, status: 'done', completedAt, notes: oldNotes } });
  await ensureSteelWorkCatalog(company.id);
  const assignment = await prisma.steelSiteTask.findUniqueOrThrow({ where: { treeItemId: tree.id } });
  await context.addCookies([{ name: 'bk_admin_id', value: await createSessionCookie('admin', admin.id, admin.sessionEpoch), url: base }, { name: 'bk_lang', value: 'sq', url: base }]);
  const open = async () => {
   await page.goto(`/workzone/baustellen/${site.id}`);
   const card = page.locator('[data-studio-phase-card]').filter({ has: page.getByText(title, { exact: true }) });
   await expect(async () => { if (!await card.count()) await page.getByTestId('phase-group-assembly').click(); await expect(card).toBeVisible(); }).toPass();
   await card.click();
   const sheet = page.getByRole('dialog', { name: title, exact: true });
   await expect(sheet).toBeVisible(); return sheet;
  };
  let sheet = await open();
  const add = async (text: string) => {
   await sheet.getByRole('button', { name: 'Shto shënim', exact: true }).click();
   const box = sheet.getByRole('textbox', { name: 'Shto shënim', exact: true });
   await expect(box).toHaveValue(''); await box.fill(text);
   await sheet.getByRole('button', { name: 'Ruaj', exact: true }).click();
   await expect(sheet.locator('[data-studio-phase-notes]')).toContainText(text);
  };
  await expect(sheet.locator('[data-studio-phase-notes]')).toContainText('Shënimi origjinal i ruajtur');
  expect(await prisma.steelPhaseNote.count({ where: { taskId: assignment.id } })).toBe(0);
  await add('Shënim i ri nga administrata');
  await context.clearCookies({ name: 'bk_admin_id' });
  await context.addCookies([{ name: 'bk_worker_id', value: await createSessionCookie('worker', worker.id, worker.sessionEpoch), url: base }]);
  sheet = await open(); await add('Shënim nga inxhinieri');
  const notes = sheet.locator('[data-studio-phase-notes]');
  await expect(notes.locator('li')).toHaveCount(3);
  await expect(notes.locator('li').first()).toContainText('Inxhinier DEMO');
  await expect(notes.locator('li').nth(1)).toContainText('Megi DEMO');
  await notes.getByRole('combobox', { name: 'Personi', exact: true }).selectOption(`worker:${worker.id}`);
  await expect(notes.locator('li')).toHaveCount(1); await expect(notes).not.toContainText('Shënim i ri nga administrata');
  // Arrow keys on filters must not switch to another process.
  await notes.getByRole('combobox', { name: 'Personi', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await expect(sheet).toBeVisible();
  await notes.getByRole('button', { name: 'Pastro filtrat', exact: true }).click();
  await notes.getByLabel('Data', { exact: true }).fill('2026-11-17');
  await expect(notes.locator('li')).toHaveCount(1); await expect(notes).toContainText('Shënimi origjinal i ruajtur');
  await notes.getByRole('button', { name: 'Pastro filtrat', exact: true }).click();
  for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
   await page.setViewportSize({ width, height: width === 1440 ? 950 : 844 });
   await context.addCookies([{ name: 'bk_theme', value: theme, url: base }]); sheet = await open();
   const diary = sheet.locator('[data-studio-phase-notes]'); await expect(diary.locator('li')).toHaveCount(3);
   await diary.scrollIntoViewIfNeeded();
   expect(await sheet.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
   for (const name of ['Data', 'Personi']) expect(await diary.getByLabel(name, { exact: true }).evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
   await page.screenshot({ path: `${process.env.OFFICE_EVIDENCE_DIR}/phase-notes-${theme}-${width}.png` });
  }
  expect(await prisma.treeItem.findUniqueOrThrow({ where: { id: tree.id } })).toMatchObject({ status: 'done', completedAt });
  expect(await prisma.steelPhaseNote.count({ where: { taskId: assignment.id } })).toBe(3);
  expect(errors).toEqual([]);
 } finally { await prisma.user.deleteMany({ where: { companyProfileId: company.id } }); await prisma.companyProfile.delete({ where: { id: company.id } }); }
});
