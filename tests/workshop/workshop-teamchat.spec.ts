import { expect, test } from '@playwright/test';
import { resetWorkshopFixture } from './shared-fixture';
import { switchDemoRole } from './demo-role';

test('late chat identity and profile changes from another tab retain the open workspace and search', async ({ page, context, request }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name: 'bk_lang', value: 'de', url: String(info.project.use.baseURL) }]);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/demo/baumdienst/chat?**', async route => { await gate; await route.continue(); });
  try {
    await page.goto('/demo/workshop?tab=tools');
    const region = page.getByTestId('workshop-scroll-region');
    await expect(region.locator('article').first()).toBeVisible();
    const searchName = 'Name, Kennzeichen, Code oder Defekt suchen…';
    await page.getByRole('button', { name: searchName, exact: true }).click();
    const search = page.getByRole('searchbox', { name: searchName, exact: true });
    await search.fill('Häcksler');
    await region.evaluate(el => { el.setAttribute('data-chat-mount-proof', 'retained'); });
    release();
    await expect(page.getByTestId('company-chat-trigger')).toBeVisible();
    await expect(region).toHaveAttribute('data-chat-mount-proof', 'retained');
    await expect(search).toHaveValue('Häcksler');
    const snapshot = await (await request.get('/api/demo/baumdienst/workshop')).json();
    // Personal role controls now live in the profile/control panel. Change the
    // real shared demo cookie in a second tab, then return to the still-open
    // workspace; explicit navigation away from this page would discard its DOM.
    const worker = snapshot.directory.workers[1];
    const profile = await context.newPage();
    try { await profile.goto('/demo/control'); await switchDemoRole(profile, worker.key); }
    finally { await profile.close(); }
    await page.bringToFront();
    await expect(page.getByTestId('baum-team-strip').locator('button').first()).toHaveAttribute('aria-label', new RegExp(`^${worker.name} -`));
    await expect(region).toHaveAttribute('data-chat-mount-proof', 'retained');
    await expect(search).toHaveValue('Häcksler');
  } finally { release(); }
});
