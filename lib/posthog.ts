// Server-side PostHog client — tracks per-tenant events from API routes and Server Actions
// Uses posthog-node — never imported on the client side
// distinctId is always orgId — gives us per-tenant analytics, not per-user

import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

// Singleton — one client per server process, not per request
let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
  // Skip if key not configured — never crash over missing analytics
  if (!env.posthogKey) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(env.posthogKey, {
      host: env.posthogHost,
      // Flush events immediately in serverless — no persistent process to flush later
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogClient;
}

// Track a server-side event scoped to an org
// Fire and forget — never await this, never let it block a response
export function trackEvent(
  orgId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const client = getPostHogClient();
  if (!client) return;

  client.capture({
    distinctId: orgId, // org-level tracking — not individual users
    event,
    properties: {
      ...properties,
      // Always stamp source so we can filter server vs client events in PostHog
      source: "server",
    },
  });
}
