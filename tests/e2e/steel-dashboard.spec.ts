import { expect, test } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { dayKey, shiftMonth } from '../../src/lib/dashboard/steel-metrics';
import { seedSteelProduction } from '../fixtures/steel-production';
import { steelPresentation } from '../../src/lib/dashboard/steel-presentation';
test('steel calendar, project drilldown, evidence and a separate read-only monitor', async ({ page, context, browser }, info) => {
    assertE2ETestDatabase(process.env);
    test.setTimeout(180000);
    const month = shiftMonth(dayKey(new Date(), 'Europe/Tirane').slice(0, 7), -1), email = `production-${Date.now()}@example.test`;
    let companyId: string | undefined;
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
        const seed = await seedSteelProduction(companyId, month);
        await page.goto(`/app/dashboard?month=${month}&day=${month}-14`);
        await expect(page.getByTestId('steel-dashboard')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Kalendari i prodhimit' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Pas shifrave', exact: true })).toBeVisible();
        await page.getByTestId('production-evidence-toggle').click();
        await expect(page.getByText('Pesha e ruajtur në konfirmim').first()).toBeVisible();
        await page.getByTestId('production-evidence-toggle').click();
        const allParts = await page.getByTestId('metric-cutParts').innerText();
        expect(allParts).not.toMatch(/^0\s*kg/);
        await page.getByRole('combobox', { name: 'Projekti', exact: true }).selectOption(seed.sites[0].id);
        await expect(page).toHaveURL(new RegExp(`project=${seed.sites[0].id}`));
        await expect(page.getByTestId(`production-project-${seed.sites[1].id}`)).toHaveCount(0);
        await page.getByRole('combobox', { name: 'Projekti', exact: true }).selectOption('');
        await expect(page.getByTestId(`production-project-${seed.sites[1].id}`)).toBeVisible();
        await page.getByTestId(`production-day-${month}-11`).click();
        await expect(page).toHaveURL(new RegExp(`day=${month}-11`));
        await page.getByTestId(`production-day-${month}-22`).click();
        await expect(page.getByTestId('production-day-projects').getByText('Ngarkim:', { exact: false }).first()).toBeVisible();
        await page.goto(`/app/dashboard?month=${month}&day=${month}-14`);
        for (const [width, height, name] of [[1440, 1050, 'desktop'], [390, 844, 'phone']] as const) {
            await page.setViewportSize({ width, height });
            await expect(page.getByTestId('steel-dashboard')).toBeVisible();
            if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.log("production-overflow", await page.evaluate(() => Array.from(document.querySelectorAll('div[data-testid="steel-dashboard"] *')).map(e => ({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e => e.right > innerWidth + 1).slice(0,12)));
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            for (const control of [page.getByTestId('steel-dashboard').getByRole('button', { name: 'Përditëso', exact: true }), page.getByRole('button', { name: 'Kopjo lidhjen e monitorit', exact: true })]) {
                const box = await control.boundingBox();
                expect(box).not.toBeNull();
                expect(box!.x).toBeGreaterThanOrEqual(0);
                expect(box!.x + box!.width).toBeLessThanOrEqual(width);
            }
            await page.screenshot({ path: info.outputPath(`steel-dashboard-${name}.png`), fullPage: true });
        }
        const screen = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 1920, height: 1080 } });
        try {
            await screen.addCookies([{ name: 'bk_lang', value: 'sq', url: info.project.use.baseURL! }]);
            const p = await screen.newPage();
            const denied = await screen.request.post('/api/display-login', { headers: { origin: 'https://foreign.invalid' }, form: { email: seed.displayEmail, code: '715038' } });
            expect(denied.status()).toBe(403);
            await p.goto('/display-login');
            await p.locator('input[name="email"]').fill(seed.displayEmail);
            await p.locator('input[name="code"]').fill('715038');
            await p.locator('button[type="submit"]').click();
            await expect(p).toHaveURL(/\/display\/dashboard$/);
            await p.goto(`/display/dashboard?month=${month}&day=${month}-14`);
            await expect(p.getByTestId('steel-dashboard')).toBeVisible();
            await expect(p.getByRole('heading', { name: 'Pas shifrave', exact: true })).toHaveCount(0);
            await expect(p.getByText('Operator Demo A', { exact: false })).toHaveCount(0);
            expect(await p.content()).not.toContain('Operator Demo');
            const pulse = await p.getByTestId(`production-project-${seed.sites[0].id}`).boundingBox();
            expect(pulse!.y + pulse!.height).toBeLessThanOrEqual(1080);
            await p.screenshot({ path: info.outputPath('steel-dashboard-monitor.png'), fullPage: true });
            await p.goto('/app/dashboard');
            await expect(p).toHaveURL(/\/(login|admin-login)/);
        }
        finally {
            await screen.close();
        }
        const anon = await browser.newContext({ baseURL: info.project.use.baseURL });
        try {
            const p = await anon.newPage();
            await p.goto('/display/dashboard');
            await expect(p).toHaveURL(/display-login/);
        }
        finally {
            await anon.close();
        }
        await page.goto('/');
        await expect(page.getByText(steelPresentation.sq, { exact: true })).toBeVisible();
    }
    finally {
        if (companyId) {
            await prisma.user.deleteMany({ where: { companyProfileId: companyId } });
            await prisma.companyProfile.delete({ where: { id: companyId } });
        }
    }
});
