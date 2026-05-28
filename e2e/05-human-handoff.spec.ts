// Tests the human handoff pipeline — full state machine via API
// conversationId extracted from SSE stream done event — no list API needed
// All authenticated API calls use page.evaluate(fetch()) — carries Clerk session cookies

import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect } from "@playwright/test";

const CHAT_URL = `/chat/${process.env.E2E_ORG_SLUG}`;

// Helper — sends a message to chat API and returns conversationId from SSE done event
async function sendChatMessage(
  page: import("@playwright/test").Page,
  message: string,
  sessionId: string,
): Promise<{ conversationId: number | null; handoffStatus: string | null }> {
  return page.evaluate(
    async ({ message, orgSlug, sessionId }) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          orgSlug,
          sessionId,
          conversationId: null,
          channelToken: null,
        }),
      });

      if (!res.ok || !res.body)
        return { conversationId: null, handoffStatus: null };

      // Read SSE stream and find the done event
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let conversationId: number | null = null;
      let handoffStatus: string | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6)) as {
                done?: boolean;
                conversationId?: number;
                handoffStatus?: string;
              };
              if (data.done && data.conversationId) {
                conversationId = data.conversationId;
                handoffStatus = data.handoffStatus ?? null;
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { conversationId, handoffStatus };
    },
    { message, orgSlug: process.env.E2E_ORG_SLUG!, sessionId },
  );
}

// ── Unauthenticated suite — customer side ──
test.describe("Human handoff — customer side", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("customer sending hubungi admin triggers pending_handoff", async ({
    page,
  }) => {
    await page.goto(CHAT_URL);

    const input = page.getByLabel("Input pesan");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("hubungi admin");
    await input.press("Enter");

    // Target the paragraph in ChatInput footer — most specific match
    await expect(
      page.locator("p.text-amber-600", { hasText: "Menunggu staff kami" }),
    ).toBeVisible({ timeout: 30_000 });
  });
});

// ── Authenticated suite — staff/dashboard side ──
test.describe("Human handoff — staff side", () => {
  test("staff can take over and return a conversation", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Step 1 — send "hubungi admin" via chat API — extract conversationId from SSE done event
    const sessionId = crypto.randomUUID();
    const { conversationId, handoffStatus } = await sendChatMessage(
      page,
      "hubungi admin",
      sessionId,
    );

    expect(conversationId).not.toBeNull();
    expect(handoffStatus).toBe("pending_handoff");

    // Wait for DB writes to settle — handleStreamComplete runs async after stream closes
    await page.waitForTimeout(1500);

    // Step 2 — staff takes over
    const takeoverData = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conversations/${id}/takeover`, {
        method: "POST",
      });
      return res.json() as Promise<{ ok: boolean }>;
    }, conversationId!);

    expect(takeoverData.ok).toBe(true);

    // Step 3 — verify status is now human
    const afterTakeoverData = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conversations/${id}`);
      return res.json() as Promise<{
        ok: boolean;
        data: { id: number; handoffStatus: string };
      }>;
    }, conversationId!);

    expect(afterTakeoverData.data.handoffStatus).toBe("human");

    // Step 4 — return to AI
    const returnData = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conversations/${id}/return`, {
        method: "POST",
      });
      return res.json() as Promise<{ ok: boolean }>;
    }, conversationId!);

    expect(returnData.ok).toBe(true);

    // Step 5 — verify status is back to ai
    const afterReturnData = await page.evaluate(async (id) => {
      const res = await fetch(`/api/conversations/${id}`);
      return res.json() as Promise<{
        ok: boolean;
        data: { id: number; handoffStatus: string };
      }>;
    }, conversationId!);

    expect(afterReturnData.data.handoffStatus).toBe("ai");
  });

  test("conversations page loads and shows table", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard/conversations");
    await page.waitForURL(/\/dashboard\/conversations/, { timeout: 15_000 });

    await expect(page.getByRole("heading", { name: "Percakapan" })).toBeVisible(
      { timeout: 10_000 },
    );

    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
  });

  test("takeover API rejects invalid conversation ID", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const status = await page.evaluate(async () => {
      const res = await fetch("/api/conversations/abc/takeover", {
        method: "POST",
      });
      return res.status;
    });

    expect(status).toBe(400);
  });

  test("return API returns 404 for nonexistent conversation", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const status = await page.evaluate(async () => {
      const res = await fetch("/api/conversations/999999/return", {
        method: "POST",
      });
      return res.status;
    });

    expect(status).toBe(404);
  });
});
