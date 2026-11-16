import { expect, test } from '@playwright/test';
import { resetWorkshopFixture } from './shared-fixture';
import { switchDemoRole } from './demo-role';

test('late chat identity and persona changes never remount the open workspace or lose search', async ({ page, context, request }, info) => {
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
    await switchDemoRole(page, snapshot.directory.workers[0].key);
    await expect(region).toHaveAttribute('data-chat-mount-proof', 'retained');
    await expect(search).toHaveValue('Häcksler');
  } finally { release(); }
});
