import { expect, test } from "@playwright/test";

test.describe("access and public smoke", () => {
  test("health endpoint page renders", async ({ page }) => {
    await page.goto("/healthz");
    await expect(page.getByRole("heading", { name: "OK" })).toBeVisible();
  });

  test("internal access cards navigate to the correct login screens", async ({ page }) => {
    await page.goto("/zugang");

    await page.getByRole("link", { name: /admin (zugang|access)/i }).click();
    await expect(page).toHaveURL(/\/admin-login$/);
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();

    await page.goto("/zugang");
    await page.getByRole("link", { name: /workzone (zugang|access)/i }).click();
    await expect(page).toHaveURL(/\/workzone\/login$/);
    await expect(page.getByRole("button", { name: /profil|profile|accedi|hyr/i })).toBeVisible();

    await page.goto("/zugang");
    await page.getByRole("link", { name: /display (zugang|access)/i }).click();
    await expect(page).toHaveURL(/\/display-login$/);
    await expect(page.getByRole("heading", { name: /display/i })).toBeVisible();
  });

  test("admin login form exposes email, code and submit controls", async ({ page }) => {
    await page.goto("/admin-login");

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="code"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /admin/i })).toBeVisible();
  });

  test("display login form exposes email, code and submit controls", async ({ page }) => {
    await page.goto("/display-login");

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="code"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /display/i })).toBeVisible();
  });

  test("workzone login form exposes worker name, code and submit controls", async ({ page }) => {
    await page.goto("/workzone/login");

    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="loginCode"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /profil|profile|accedi|hyr/i })).toBeVisible();
  });
});
