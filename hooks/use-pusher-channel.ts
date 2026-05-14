// Subscribes to the org's Pusher channel from the browser
// Listens for real-time events and dispatches them to Zustand stores
// Called once in PusherProvider — lives for the entire dashboard session

"use client";

import { useEffect } from "react";
import { useConversationStore } from "@/stores/conversation-store";

// Events we listen for on the org channel — matches server-side convention
const EVENTS = {
  CONVERSATION_NEW: "conversation:new",
  CONVERSATION_MESSAGE: "conversation:message",
  DOCUMENT_UPDATED: "document:updated",
} as const;

// orgId — Clerk org ID, used to build channel name: org-{orgId}
// Both values come from NEXT_PUBLIC_ env vars — browser-safe
export function usePusherChannel(orgId: string): void {
  const incrementUnread = useConversationStore((s) => s.incrementUnread);

  useEffect(() => {
    // Skip if credentials aren't present — happens in test environments
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      console.warn(
        "[Pusher] Missing NEXT_PUBLIC_PUSHER_KEY or CLUSTER — skipping",
      );
      return;
    }

    // Dynamic import — Pusher client SDK is browser-only, not needed on server
    let cleanup: (() => void) | undefined;

    import("pusher-js").then((mod) => {
      const PusherClient = mod.default;

      // Connect to Pusher — useTLS keeps traffic encrypted
      const pusher = new PusherClient(key, {
        cluster,
        forceTLS: true,
      });

      // Subscribe to the org's private channel — all dashboard events land here
      const channel = pusher.subscribe(`org-${orgId}`);

      // New conversation started — increment notification bell
      channel.bind(EVENTS.CONVERSATION_NEW, () => {
        incrementUnread();
      });

      // New message in existing conversation — also increment bell
      channel.bind(EVENTS.CONVERSATION_MESSAGE, () => {
        incrementUnread();
      });

      // Document processing status changed — logged for now, wired to UI in Phase 8
      channel.bind(EVENTS.DOCUMENT_UPDATED, (data: unknown) => {
        console.log("[Pusher] document:updated", data);
      });

      // Cleanup — disconnect when component unmounts (user leaves dashboard)
      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(`org-${orgId}`);
        pusher.disconnect();
      };
    });

    // Return cleanup function — useEffect will call this on unmount
    return () => cleanup?.();
  }, [orgId, incrementUnread]);
}
