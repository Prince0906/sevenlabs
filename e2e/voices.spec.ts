import { test, expect } from "@playwright/test";

test.describe("Voice Library Page", () => {
  test("unauthenticated access redirects to sign-in", async ({ page }) => {
    await page.goto("/voices");

    await expect(page).toHaveURL(/sign-in/);
  });

  test("returns proper page title", async ({ page }) => {
    await page.goto("/voices");
    await expect(page).toHaveTitle(/SevenLabs/);
  });
});
