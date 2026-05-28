// Runs once before all tests — signs in via Clerk server-side token
// Uses emailAddress approach — bypasses all verification steps entirely

import path from "path";
import { test as setup } from "@playwright/test";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

// Must run serially
setup.describe.configure({ mode: "serial" });

const authFile = path.join(__dirname, ".auth/user.json");

setup("global setup", async () => {
  await clerkSetup();
});

setup("authenticate and save state", async ({ page }) => {
  // Navigate to home — Clerk needs a loaded page context before signIn
  await page.goto("/");

  // Sign in via server-side token — bypasses email verification and OTP
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_CLERK_USER_EMAIL!,
  });

  // Set active org client-side via Clerk's JS API injected on the page
  await page.evaluate(async (orgId) => {
    // window.Clerk is available after clerk.signIn() loads the page
    await (
      window as unknown as {
        Clerk: {
          setActive: (params: { organization: string }) => Promise<void>;
        };
      }
    ).Clerk.setActive({ organization: orgId });
  }, process.env.E2E_ORG_ID!);

  // Wait for org to be active — small buffer for Clerk to settle
  await page.waitForTimeout(1000);

  // Navigate to dashboard to confirm auth + org both work
  await page.goto("/dashboard");
  await page.waitForURL("**/dashboard", { timeout: 20_000 });

  // Save auth state
  await page.context().storageState({ path: authFile });
});
