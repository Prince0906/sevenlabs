import { test, expect } from "@playwright/test";

test.describe("Speech Synthesis Page", () => {
  test("unauthenticated access redirects to sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/sign-in/);
  });

  test("page title is SevenLabs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SevenLabs/);
  });
});
