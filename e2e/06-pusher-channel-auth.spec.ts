// Tests the customer widget Pusher channel authorization endpoint.
// Verifies a leaked channelToken alone is not sufficient to subscribe —
// the auth endpoint also requires a matching sessionId (see
// fix/customer-widget-channel-authorization).
// No Clerk session needed — this endpoint is for unauthenticated customers.

import { test, expect } from "@playwright/test";

const CHAT_URL = `/chat/${process.env.E2E_ORG_SLUG}`;

// Sends a message to /api/chat and extracts channelToken from the SSE done event.
// Mirrors the sendChatMessage helper in 05-human-handoff.spec.ts, extended to
// also return channelToken since that's what this suite needs.
async function sendChatMessage(
  page: import("@playwright/test").Page,
  message: string,
  sessionId: string,
): Promise<{ channelToken: string | null }> {
  return page.evaluate(
    async ({ message, orgSlug, sessionId }) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, orgSlug, sessionId }),
      });

      if (!res.ok || !res.body) return { channelToken: null };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let channelToken: string | null = null;

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
                channelToken?: string;
              };
              if (data.done && data.channelToken) {
                channelToken = data.channelToken;
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { channelToken };
    },
    { message, orgSlug: process.env.E2E_ORG_SLUG!, sessionId },
  );
}

// Hits the conversation-auth endpoint directly with a given channel name and
// sessionId. Mirrors the manual test we ran by hand — same request shape
// Pusher's client SDK sends when subscribing.
async function authRequest(
  page: import("@playwright/test").Page,
  channelName: string,
  sessionId: string,
): Promise<number> {
  return page.evaluate(
    async ({ channelName, sessionId }) => {
      const res = await fetch("/api/pusher/conversation-auth", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          socket_id: "0.0",
          channel_name: channelName,
          sessionId,
        }),
      });
      return res.status;
    },
    { channelName, sessionId },
  );
}

test.describe("Customer widget channel authorization", () => {
  // No auth needed — customers don't have Clerk sessions
  test.use({ storageState: { cookies: [], origins: [] } });

  test("rejects a valid channelToken paired with the wrong sessionId", async ({
    page,
  }) => {
    await page.goto(CHAT_URL);

    const realSessionId = crypto.randomUUID();
    const { channelToken } = await sendChatMessage(
      page,
      "apa menu tersedia?",
      realSessionId,
    );

    expect(channelToken).not.toBeNull();

    // Wrong sessionId — simulates an attacker who only has the channelToken
    const status = await authRequest(
      page,
      `private-conversation-${channelToken}`,
      "totally-wrong-session-id",
    );

    expect(status).toBe(403);
  });

  test("authorizes the correct channelToken + sessionId pair", async ({
    page,
  }) => {
    await page.goto(CHAT_URL);

    const realSessionId = crypto.randomUUID();
    const { channelToken } = await sendChatMessage(
      page,
      "apa menu tersedia?",
      realSessionId,
    );

    expect(channelToken).not.toBeNull();

    const status = await authRequest(
      page,
      `private-conversation-${channelToken}`,
      realSessionId,
    );

    expect(status).toBe(200);
  });

  test("rejects a channel name with the wrong prefix", async ({ page }) => {
    await page.goto(CHAT_URL);

    // Confirms this endpoint can't be used as a side door into the
    // dashboard's private-org-{orgId} channel
    const status = await authRequest(page, "private-org-someorgid", "anything");

    expect(status).toBe(403);
  });
});
