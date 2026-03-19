import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("sign-in page has SevenLabs branding", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("heading", { name: /sevenlabs/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("org-selection page is accessible", async ({ page }) => {
    await page.goto("/org-selection");

    await page.waitForURL(/org-selection|sign-in/, { timeout: 10000 });
    expect(page.url()).toMatch(/org-selection|sign-in/);
  });

  test("protected routes redirect to sign-in", async ({ page }) => {
    await page.goto("/voices");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("history route redirects to sign-in", async ({ page }) => {
    await page.goto("/history");
    await expect(page).toHaveURL(/sign-in/);
  });
});
