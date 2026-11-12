import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelProduction } from '../fixtures/steel-production';

test('steel footer ends the content and the transparent header keeps one book entry', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  test.setTimeout(300_000);
  const baseline = process.env.FOOTER_HEADER_BASELINE === 'true';
  const underlaySmoke = process.env.STEEL_HEADER_UNDERLAY_SMOKE === 'true';
  const email = `footer-header-${Date.now()}@example.test`, errors: string[] = [];
  let companyId: string | undefined;
  page.on('pageerror', e => errors.push(e.message));
  await context.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e5eddf"/><path d="M0 200L256 30" stroke="white" stroke-width="16"/><text x="15" y="240" font-size="10">DEMO MAP · synthetic tile</text></svg>' }));
  await context.route('https://kidraht.example.test/**', route => route.abort());
  await context.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [] }));
  try {
    await context.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }]);
    await page.goto('/signup?mode=bau');
    for (const [key, value] of Object.entries({ displayName: 'Mira Steel · DEMO', fullName: 'Admin Demo', email, password: 'Synthetic-Steel-Demo-123!' })) await page.locator(`input[name="${key}"]`).fill(value);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
    companyId = owner.companyProfileId!;
    await seedSteelProduction(companyId, '2026-10');
    await prisma.companyProfile.update({ where: { id: companyId }, data: { kidrahtWorkspaceId: 'synthetic-workspace', kidrahtApiKey: 'synthetic-local-key' } });
    await prisma.worker.createMany({ data: Array.from({ length: 24 }, (_, i) => ({ companyProfileId: companyId!, firstName: `Demo ${i + 1}`, lastName: `Crew ${i + 1}` })) });
    await prisma.machine.create({ data: { companyProfileId: companyId, name: 'Furgon demo', targe: 'DEMO-01', hourlyRateCents: 0 } });
    await prisma.user.createMany({ data: Array.from({ length: 3 }, (_, i) => ({ companyProfileId: companyId!, name: `Office Demo ${i + 1}`, email: `office-${i}-${email}`, passwordHash: owner.passwordHash, role: 'ADMIN' as const })) });
    for (const theme of ['light', 'dark']) {
      await context.addCookies([{ name: 'bk_theme', value: theme, url: info.project.use.baseURL! }]);
      for (const [width, height] of underlaySmoke ? [[1440, 900], [360, 800]] : [[1440, 900], [1280, 800], [360, 800], [320, 640], [760, 360]]) {
        await page.setViewportSize({ width, height });
        for (const [view, url] of [['dashboard', '/app/dashboard?month=2026-10&day=2026-10-14'], ['workzone', '/workzone?view=map']]) {
          if (underlaySmoke && view !== (theme === 'light' ? 'dashboard' : 'workzone')) continue;
          await page.goto(url);
          const main = page.getByTestId('app-workspace-scroll');
          await expect(main).toBeVisible();
          if (!baseline) await expect(page.getByTestId('flow-header-fleet-actions').getByTestId('fleet-dock-open')).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const state = await page.evaluate(() => {
            const main = document.querySelector('[data-testid="app-workspace-scroll"]')!, header = document.querySelector('[data-testid="admin-topbar"],[data-testid="workzone-topbar"]')!, strip = document.querySelector('[data-testid="flow-team-strip"]')!;
            const credit = document.querySelector('a[aria-label="by RediON"]')!, footer = credit.closest('footer')!, book = document.querySelector('[data-testid="flow-global-tools"] a[href="/workzone/kidraht"]')!;
            const f = footer.getBoundingClientRect(), b = book.getBoundingClientRect();
            const alerts = [...document.querySelectorAll('[data-testid="flow-header-alerts"] button')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
            const fleet = document.querySelector('[data-testid="fleet-dock-open"]')!.getBoundingClientRect();
            return { width: innerWidth, height: innerHeight, footerInsideMain: main.contains(footer), footerVisible: f.top < innerHeight && f.bottom > 0, footerTop: f.top, footerHeight: f.height, footerBg: getComputedStyle(footer).backgroundColor, headerBg: getComputedStyle(header).backgroundColor, headerBorder: getComputedStyle(header).borderBottomWidth, headerTop: header.getBoundingClientRect().top, stripBg: getComputedStyle(strip).backgroundColor, bookVisibleText: (book as HTMLElement).innerText.trim(), bookCount: document.querySelectorAll('a[href="/workzone/kidraht"]').length, alertsBesideBook: alerts.length === 2 && alerts.every(r => Math.abs(r.top - b.top) < 1 && r.right <= b.left), workersClearTools: strip.getBoundingClientRect().bottom + 3 <= fleet.top, outerHeight: document.documentElement.scrollHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
          });
          console.log('FOOTER_HEADER', JSON.stringify({ baseline, theme, view, ...state }));
          await page.screenshot({ path: info.outputPath(`${baseline ? 'before' : 'after'}-${view}-${theme}-${width}-top.png`) });
          if (!baseline) {
            expect(state.footerInsideMain).toBe(true);
            expect(state.footerVisible).toBe(false);
            expect(state.footerBg).toBe('rgba(0, 0, 0, 0)');
            expect(state.footerHeight).toBeLessThanOrEqual(44);
            expect(state.headerBg).toBe('rgba(0, 0, 0, 0)');
            expect(state.headerBorder).toBe('0px');
            expect(state.stripBg).toBe('rgba(0, 0, 0, 0)');
            expect(state.bookCount).toBe(1);
            expect(state.bookVisibleText).toBe('');
            expect(state.outerHeight).toBeLessThanOrEqual(height + 1);
            expect(state.horizontalOverflow).toBe(false);
            const commands = await page.evaluate(() => {
              const tools = document.querySelector('[data-testid="flow-global-tools"]')!;
              const fleet = document.querySelector('[data-testid="fleet-dock-open"]')!, workshop = document.querySelector('[data-testid="workshop-dock-open"]')!;
              const panel = tools.querySelector('a[href="/app/dashboard"]')!, firstAlert = tools.querySelector('[data-testid="flow-header-alerts"] button')!;
              const f = fleet.getBoundingClientRect(), w = workshop.getBoundingClientRect(), p = panel.getBoundingClientRect(), a = firstAlert.getBoundingClientRect();
              const main = document.querySelector('[data-testid="app-workspace-scroll"]')!.getBoundingClientRect();
              const buttons = [...tools.querySelectorAll('a,button')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
              const dashboard = document.querySelector('[data-testid="steel-dashboard"]');
              const actions = dashboard?.querySelector('header a[target="_blank"]')?.getBoundingClientRect();
              const actionButtons = dashboard ? [...dashboard.querySelectorAll('header button,header a')].map(el => el.getBoundingClientRect()) : [];
              return {
                inHeader: tools.contains(fleet) && tools.contains(workshop),
                mobileOrder: p.right <= f.left && f.right <= w.left && w.right <= a.left,
                sameRow: Math.abs(f.top - w.top) < 1 && Math.abs(f.top - a.top) < 1,
                targets: buttons.every(r => r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth),
                mainRight: main.right, mainBottom: main.bottom,
                actionHeights: actionButtons.map(r => r.height), monitorWidth: actions?.width,
              };
            });
            console.log('HEADER_COMMANDS', JSON.stringify({ theme, view, width, height, ...commands }));
            expect(commands.inHeader).toBe(true);
            expect(commands.sameRow).toBe(true);
            expect(commands.targets).toBe(true);
            expect(commands.mainRight).toBeGreaterThanOrEqual(width - 1);
            expect(commands.mainBottom).toBeGreaterThanOrEqual(height - 1);
            if (width < 1024) expect(commands.mobileOrder).toBe(true);
            if (width <= 760 && view === 'dashboard') {
              expect(commands.monitorWidth).toBeLessThan(210);
              expect(commands.actionHeights.every(h => Math.abs(h - 44) < 1)).toBe(true);
            }
            if (width === 1440 || width === 360) {
              const fleet = page.getByTestId('fleet-dock-open'), workshop = page.getByTestId('workshop-dock-open');
              await fleet.click();
              await expect(page.getByTestId('fleet-picker')).toBeVisible();
              await page.getByTestId('fleet-search').fill('DEMO-01');
              await expect(page.getByTestId('fleet-picker').locator('[data-machine-id]')).toHaveCount(1);
              await page.keyboard.press('Escape');
              await expect(page.getByTestId('fleet-picker')).not.toBeVisible();
              await expect(fleet).toBeFocused();
              await workshop.click();
              await expect(page.getByRole('dialog', { name: 'Oficina', exact: true })).toBeVisible();
              await page.keyboard.press('Escape');
              await expect(page.getByRole('dialog', { name: 'Oficina', exact: true })).not.toBeVisible();
              await expect(workshop).toBeFocused();
            }
            if (width >= 1024) {
              expect(state.alertsBesideBook).toBe(true);
              expect(state.workersClearTools).toBe(true);
            }
            await main.press('PageDown');
            // A short landscape viewport advances less than 100px per keypress.
            // Preserve the underlay threshold and verify it after two page steps.
            await main.press('PageDown');
            await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeGreaterThan(state.headerTop + 100);
            const underlay = await page.evaluate(() => {
              const main = document.querySelector('[data-testid="app-workspace-scroll"]')!, content = main.firstElementChild!;
              const header = document.querySelector('[data-testid="admin-topbar"],[data-testid="workzone-topbar"]')!, h = header.getBoundingClientRect(), m = main.getBoundingClientRect();
              const logo = header.querySelector('button,a')!, l = logo.getBoundingClientRect(), logoHit = document.elementFromPoint(l.x+l.width/2,l.y+l.height/2);
              const x = m.left + m.width / 2, y = h.bottom - 2;
              const hit = document.elementFromPoint(x, y);
              return { scrollerTop: m.top, contentTop: content.getBoundingClientRect().top, headerBottom: h.bottom, contentPaintsBehind: document.elementsFromPoint(x,y).some(el => el === content || content.contains(el)), emptyHeaderPassesClicks: !!hit && main.contains(hit), logoAboveContent: logoHit === logo || !!logoHit && logo.contains(logoHit) };
            });
            console.log('HEADER_UNDERLAY', JSON.stringify({ theme, view, width, ...underlay }));
            expect(underlay.scrollerTop).toBe(0);
            expect(underlay.contentTop).toBeLessThan(underlay.headerBottom);
            expect(underlay.contentPaintsBehind).toBe(true);
            expect(underlay.emptyHeaderPassesClicks).toBe(true);
            expect(underlay.logoAboveContent).toBe(true);
            await page.screenshot({ path: info.outputPath(`underlay-${view}-${theme}-${width}.png`) });
            await main.press('Home');
            await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeLessThan(1);
          }
          if (!baseline && !underlaySmoke) {
            const profiles = page.getByTestId('flow-team-strip').locator('a[href^="/workzone/admin-profile/"]');
            await expect(profiles).toHaveCount(3);
            await profiles.last().focus();
            expect(await profiles.last().evaluate(el => { const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit === el || el.contains(hit); })).toBe(true);
            const announcement = page.getByRole('button', { name: 'Shkruaj nje njoftim te shkurter per ekipin', exact: true });
            await expect(announcement).toHaveCount(1);
            await announcement.click();
            const message = page.locator('textarea[name="message"]');
            await expect(message).toBeVisible();
            const panel = await message.locator('..').boundingBox();
            expect(panel!.x).toBeGreaterThanOrEqual(15);
            expect(panel!.x + panel!.width).toBeLessThanOrEqual(width - 15);
            const submit = message.locator('..').locator('button[type="submit"]');
            expect(await submit.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await announcement.evaluate(el => getComputedStyle(el).backgroundColor));
            await message.press('Escape');
            await expect(message).toHaveCount(0);
          }
          await main.focus();
          await page.keyboard.press('End');
          await expect.poll(() => main.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(3);
          const credit = page.getByRole('link', { name: 'by RediON', exact: true });
          await expect(credit).toHaveCount(1);
          // Blank header space now intentionally passes clicks to the content below.
          await page.mouse.click(2, 2);
          await page.screenshot({ path: info.outputPath(`${baseline ? 'before' : 'after'}-${view}-${theme}-${width}-end.png`) });
          if (!baseline) {
            await expect(credit).toBeInViewport();
            expect(await page.evaluate(() => window.scrollY)).toBe(0);
            expect((await page.locator('[data-testid="admin-topbar"],[data-testid="workzone-topbar"]').boundingBox())!.y).toBe(state.headerTop);
            await expect(credit).toHaveAttribute('href', 'https://www.redioncekrezi.de/');
            await credit.focus();
            await page.keyboard.press('Shift+Tab');
            await page.keyboard.press('Tab');
            await expect(credit).toBeFocused();
            expect(await credit.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
            await main.focus();
            await page.keyboard.press('Home');
            await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeLessThan(1);
            await expect(credit).not.toBeInViewport();
          }
        }
      }
    }
    if (!baseline && !underlaySmoke) {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto('/app/dashboard?month=2026-10&day=2026-10-14');
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      expect(await page.getByTestId('flow-global-tools').evaluate(el => [...el.querySelectorAll('a,button')].filter(n => n.getClientRects().length).every(n => { const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth; }))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
      await page.getByTestId('app-workspace-scroll').focus();
      await page.keyboard.press('End');
      await expect(page.getByRole('link',{name:'by RediON',exact:true})).toBeInViewport();
      await page.screenshot({path:info.outputPath('after-text-zoom-200.png')});
      await page.goto('/landing');
      await expect(page.getByTestId('flow-global-tools')).toHaveCount(0);
      await expect(page.getByRole('link',{name:'by RediON',exact:true})).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  } finally {
    if (companyId) { await prisma.user.deleteMany({ where: { companyProfileId: companyId } }); await prisma.companyProfile.delete({ where: { id: companyId } }); }
  }
});
