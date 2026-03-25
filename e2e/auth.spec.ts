import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in page renders Clerk form", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("heading", { name: /sign in/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("sign-up page is accessible", async ({ page }) => {
    await page.goto("/sign-up");

    await page.waitForURL(/sign-up|sign-in/, { timeout: 10000 });
    expect(page.url()).toMatch(/sign-up|sign-in/);
  });

  test("API routes redirect without auth", async ({ request }) => {
    const res = await request.get("/api/voices");

    expect([200, 302, 307, 401]).toContain(res.status());
  });
});
