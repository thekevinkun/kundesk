// Server-side Pusher client — fires events to connected dashboard browsers
// Mock mode: logs to console. Real mode: triggers via Pusher API.
// Channel naming convention: org-{orgId} — never deviate from this

import { env } from "@/lib/env";

// ── Event payload types ──

// Fired when a document's status changes (processing → ready | failed)
export interface DocumentUpdatedPayload {
  documentId: number;
  status: "processing" | "ready" | "failed";
  chunkCount: number; // 0 until ready
}

// ── Channel naming ──

// All org events go on this channel — consistent across the entire codebase
export function orgChannel(orgId: string): string {
  return `org-${orgId}`;
}

// ── Trigger function ──

// Fires an event on the org's Pusher channel
// Callers don't check the mode — this function handles the switch
export async function triggerOrgEvent(
  orgId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const channel = orgChannel(orgId);

  // Mock mode — log the event so it's visible during development
  if (env.realtimeMode === "mock") {
    console.log(`[Pusher Mock] channel=${channel} event=${event}`, payload);
    return;
  }

  // Real mode — requires all Pusher credentials
  if (!env.pusherAppId || !env.pusherKey || !env.pusherSecret) {
    throw new Error(
      "Pusher credentials required when KUNDESK_REALTIME_MODE=pusher",
    );
  }

  // Dynamic import — Pusher server SDK only loaded in real mode
  const Pusher = (await import("pusher")).default;

  const pusher = new Pusher({
    appId: env.pusherAppId,
    key: env.pusherKey,
    secret: env.pusherSecret,
    cluster: env.pusherCluster,
    useTLS: true,
  });

  await pusher.trigger(channel, event, payload);
}

// ── Typed event helpers ──

// Fires when a document's processing status changes
// Called by the processing pipeline after each status transition
export async function triggerDocumentUpdated(
  orgId: string,
  payload: DocumentUpdatedPayload,
): Promise<void> {
  await triggerOrgEvent(orgId, "document:updated", payload);
}
