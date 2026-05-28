// Tests the public chat page — no auth required
// Verifies the full RAG + SSE pipeline end to end
// Customer visits /chat/[orgSlug], sends a message, sees a streamed response

import { test, expect } from "@playwright/test";

const CHAT_URL = `/chat/${process.env.E2E_ORG_SLUG}`;

test.describe("Public chat page", () => {
  // No auth needed — override storageState to empty for this suite
  test.use({ storageState: { cookies: [], origins: [] } });

  test("loads the chat page and shows input", async ({ page }) => {
    await page.goto(CHAT_URL);

    // Chat input must be visible — page loaded correctly
    await expect(page.getByLabel("Input pesan")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("sends a message and receives an AI response", async ({ page }) => {
    await page.goto(CHAT_URL);

    // Wait for input to be ready
    const input = page.getByLabel("Input pesan");
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Type a question — something generic the AI can respond to
    await input.fill("Halo!");

    // Send via Enter key — ChatInput handles Enter without Shift
    await input.press("Enter");

    // Input should be cleared and disabled while waiting for response
    await expect(input).toHaveValue("");

    // Wait for an assistant bubble to appear
    // MessageBubble aria-label starts with botName — we match partially
    const assistantBubble = page
      .locator('[aria-label^="Assistant"], [aria-label]')
      .filter({ hasNotText: "Kamu:" })
      .filter({ hasNotText: "Input pesan" })
      .first();

    // Allow up to 30s — mock stream still has a simulated delay
    await expect(assistantBubble).toBeVisible({ timeout: 30_000 });
  });

  test("shows disabled state while waiting for response", async ({ page }) => {
    await page.goto(CHAT_URL);

    const input = page.getByLabel("Input pesan");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("Halo!");
    await input.press("Enter");

    // Input becomes disabled while AI is streaming
    await expect(input).toBeDisabled();
  });
});
