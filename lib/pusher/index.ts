// Server-side Pusher client — fires events to connected dashboard browsers
// Mock mode: logs to console. Real mode: triggers via Pusher API.
// Channel naming convention: private-org-{orgId} — never deviate from this

import { env } from "@/lib/env";

// ── Event payload types ──

// Fired when a document's status changes (processing → ready | failed)
export interface DocumentUpdatedPayload {
  documentId: number;
  status: "processing" | "ready" | "failed";
  chunkCount: number; // 0 until ready
}

// ── Channel naming ──

// All private-org-{orgId} events go on this channel — consistent across the entire codebase
export function orgChannel(orgId: string): string {
  return `private-org-${orgId}`;
}

// ── Trigger function ──

// Fires an event on the private-org-{orgId}'s Pusher channel
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

// Fires on a per-conversation public channel — customer widget subscribes here
// Using conversationId instead of orgId prevents cross-session data leakage
// The channel name includes conversationId which is a DB integer — not guessable
// but also not a secret. For higher security, Phase 10 can add a signed token.
export async function triggerPublicConversationEvent(
  channelToken: string,
  event: string,
  payload: unknown,
): Promise<void> {
  // Channel scoped to one conversation — no cross-session leakage possible
  const channel = `conversation-${channelToken}`;

  if (env.realtimeMode === "mock") {
    console.log(`[Pusher Mock] channel=${channel} event=${event}`, payload);
    return;
  }

  if (!env.pusherAppId || !env.pusherKey || !env.pusherSecret) {
    throw new Error("Pusher credentials required");
  }

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

// ── Handoff event payload types ──

// Fired when a staff member takes over a conversation from the AI
export interface ConversationTakeoverPayload {
  conversationId: number;
  takenOverBy: string; // Clerk userId of the staff member
}

// Fired when staff returns control back to the AI
export interface ConversationReturnPayload {
  conversationId: number;
}

// Fired when a new message arrives in any conversation (user, assistant, or human_agent)
export interface ConversationMessagePayload {
  conversationId: number;
  role: "user" | "assistant" | "human_agent";
  content: string;
}

// Fires when a staff member takes over a conversation
export async function triggerConversationTakeover(
  orgId: string,
  payload: ConversationTakeoverPayload,
): Promise<void> {
  await triggerOrgEvent(orgId, "conversation:takeover", payload);
}

// Fires when AI resumes handling after human handoff
export async function triggerConversationReturn(
  orgId: string,
  payload: ConversationReturnPayload,
): Promise<void> {
  await triggerOrgEvent(orgId, "conversation:return", payload);
}

// Fires when a new message is added:
// private-org-{orgId} → dashboard staff see it live
// conversation-{conversationId} → only the relevant customer widget receives it
export async function triggerConversationMessage(
  orgId: string,
  channelToken: string,
  payload: ConversationMessagePayload,
): Promise<void> {
  // Dashboard gets it on the private org channel
  await triggerOrgEvent(orgId, "conversation:message", payload);
  // Customer widget gets it on the per-conversation public channel
  await triggerPublicConversationEvent(
    channelToken,
    "conversation:message",
    payload,
  );
}

// Fires when a new notification is created — dashboard panel updates live
export async function triggerNotificationNew(
  orgId: string,
  payload: { id: number; type: string; title: string; body: string },
): Promise<void> {
  await triggerOrgEvent(orgId, "notification:new", payload);
}
