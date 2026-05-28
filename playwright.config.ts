// playwright.config.ts
// Playwright E2E test configuration
// Loads .env.e2e, starts Next.js dev server, runs tests in Chromium only

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.e2e only when running locally — CI injects env vars directly
import fs from "fs";
if (fs.existsSync(".env.e2e")) {
  dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });
}

export default defineConfig({
  // All test files live in e2e/ folder at root
  testDir: "./e2e",

  // Run tests in parallel — each worker gets its own browser context
  fullyParallel: true,

  // Fail the build on CI if test.only is accidentally left in
  forbidOnly: !!process.env.CI,

  // No retries locally — 1 retry on CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // One worker locally to avoid Clerk rate limits, full parallelism on CI
  workers: process.env.CI ? 4 : 1,

  // HTML report — open with: npx playwright show-report
  reporter: "html",

  use: {
    // All page.goto() calls resolve against this base
    baseURL: "http://localhost:3000",

    // Capture trace on first retry — helps debug CI failures
    trace: "on-first-retry",

    // Screenshot on failure — saved in test-results/
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project — runs auth setup before any test
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // Main test project — Chromium only
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Load saved auth state — skip sign-in UI in every test
        storageState: "e2e/.auth/user.json",
      },
      // Always run setup first
      dependencies: ["setup"],
    },
  ],

  // Start Next.js dev server before tests, stop after
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuse existing server if already running locally
    reuseExistingServer: !process.env.CI,
    // Load E2E env vars into the Next.js server process
    env: {
      ...(dotenv.config({ path: ".env.e2e" }).parsed ?? {}),
    },
    timeout: 120_000,
  },
});
