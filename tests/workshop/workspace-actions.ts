import { expect, type Page } from "@playwright/test";

export async function openRegistration(page: Page) {
  await page.getByRole("button", { name: "Gerät erfassen", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Name / neuer Barcode", exact: true }).click();
}
export async function openScanner(page: Page) {
  const scan = page.getByRole("button", { name: "Scannen", exact: true });
  if (await scan.count()) await scan.click();
  else {
    await page.getByRole("button", { name: "Gerät erfassen", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Gerät öffnen", exact: true }).click();
  }
  await expect(page.getByLabel("Barcode / NFC-Code")).toBeVisible();
}
