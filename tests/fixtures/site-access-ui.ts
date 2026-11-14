import { expect, type Page } from '@playwright/test';

/** Use the current shared access editor, not the retired engineer-only form. */
export async function setSiteAccess(page: Page, workerName: string, level: 'act'|'view') {
  await page.getByTestId('access-key-site').click();
  const sheet = page.getByTestId('access-sheet');
  const choice = sheet.getByRole('group', { name: workerName, exact: true }).getByTestId(`access-set-${level}`);
  await expect(choice).toBeVisible();
  if (await choice.getAttribute('aria-pressed') !== 'true') await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('dialog').last().getByRole('button', { name: 'Mbyll', exact: true }).click();
  await expect(sheet).toHaveCount(0);
}
