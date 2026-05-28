// Tests the dashboard — requires auth + active org
// Verifies sign-in flow, dashboard renders correctly, key UI elements present

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Dashboard", () => {
  // storageState from playwright.config.ts is loaded automatically
  // This suite runs as the authenticated "Rumah Paco" test user

  test("redirects to dashboard after auth", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");

    // Should land on dashboard — not redirected away
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("shows key dashboard UI elements", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Sidebar should be visible
    await expect(page.getByRole("navigation")).toBeVisible();

    // Page heading
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible(
      { timeout: 10_000 },
    );
  });

  test("shows org name in sidebar or topbar", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Org name "Rumah Paco" should appear somewhere in the dashboard
    await expect(page.getByText("Rumah Paco")).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated user is redirected away from dashboard", async ({ browser }) => {
    // Fresh context with no auth — simulates unauthenticated user
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    await page.goto("/dashboard")

    // Should be redirected to sign-in — not allowed on dashboard
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 10_000 })

    // Small buffer before closing — prevents Clerk background requests from
    // being cancelled mid-retry which causes harmless but noisy ECONNRESET logs
    await page.waitForTimeout(500)

    await context.close()
  })
});
