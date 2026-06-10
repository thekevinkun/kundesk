// Subscribes to the org's private Pusher channel from the browser
// Listens for real-time events and dispatches them to Zustand stores or callbacks
// Called once in PusherProvider — lives for the entire dashboard session

"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationStore } from "@/stores/conversation-store";
import { MessageRole, HandoffStatus } from "@/types/chat";

// All events on the private-org-{orgId} channel — must match server-side convention
const EVENTS = {
  CONVERSATION_NEW: "conversation:new",
  CONVERSATION_MESSAGE: "conversation:message",
  CONVERSATION_TAKEOVER: "conversation:takeover",
  CONVERSATION_RETURN: "conversation:return",
  DOCUMENT_UPDATED: "document:updated",
  NOTIFICATION_NEW: "notification:new",
  USAGE_UPDATED: "usage:updated",
} as const;

// Payloads matching server-side trigger functions in lib/pusher/index.ts
export interface TakeoverPayload {
  conversationId: number;
  takenOverBy: string;
  handoffStatus?: HandoffStatus;
}

export interface ReturnPayload {
  conversationId: number;
}

export interface MessagePayload {
  conversationId: number;
  role?: MessageRole;
  content?: string;
  // Set by server when message arrives in human/pending_handoff mode
  handoffStatus?: HandoffStatus;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  conversationId: number | null;
  isRead: boolean;
  createdAt: string;
}

// Optional callbacks — passed from pages that need to react to specific events
export interface PusherChannelCallbacks {
  onTakeover?: (payload: TakeoverPayload) => void;
  onReturn?: (payload: ReturnPayload) => void;
  onMessage?: (payload: MessagePayload) => void;
  onDocumentUpdated?: (payload: unknown) => void;
  onNotificationNew?: (payload: NotificationItem) => void;
  onConversationNew?: (payload: { conversationId: number }) => void;
  onUsageUpdated?: (payload: {
    messagesUsed: number;
    messagesLimit: number;
  }) => void;
}

export function usePusherChannel(
  orgId: string,
  callbacks?: PusherChannelCallbacks,
): void {
  const incrementUnread = useConversationStore((s) => s.incrementUnread);

  const setPendingHandoff = useConversationStore((s) => s.setPendingHandoff);

  // queryClient at hook top level — invalidates sidebar badge immediately on pending_handoff
  const queryClient = useQueryClient();

  // Single ref holds everything that can go stale — updated every render
  // This pattern avoids stale closures inside the async Pusher setup without reconnecting
  const stableRef = useRef({
    incrementUnread,
    setPendingHandoff,
    queryClient,
    callbacks,
  });

  useEffect(() => {
    stableRef.current = {
      incrementUnread,
      setPendingHandoff,
      queryClient,
      callbacks,
    };
  });

  useEffect(() => {
    let cancelled = false;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!orgId || !key || !cluster) {
      console.warn(
        "[Pusher] Missing NEXT_PUBLIC_PUSHER_KEY or CLUSTER — skipping",
      );
      return;
    }

    let cleanup: (() => void) | undefined;

    import("pusher-js").then((mod) => {
      if (cancelled) return;

      const PusherClient = mod.default;
      const pusher = new PusherClient(key, {
        cluster,
        forceTLS: true,
        channelAuthorization: {
          // customHandler gives full control over the auth request
          // Using fetch with credentials ensures Clerk session cookie is sent
          // transport: "ajax" (XHR) was dropping cookies intermittently — causing 401s
          customHandler: async ({
            socketId,
            channelName,
          }: {
            socketId: string;
            channelName: string;
            }) => {
            const res = await fetch("/api/pusher/auth", {
              method: "POST",
              credentials: "same-origin", // ensures Clerk session cookie is sent
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ socket_id: socketId, channel_name: channelName }),
            });
            if (!res.ok) throw new Error(`Pusher auth failed: ${res.status}`);
            return res.json() as Promise<{ auth: string }>;
          },
        },
      });

      // pusher.connection.bind(
      //   "state_change",
      //   (states: { current: string; previous: string }) => {
      //     console.log(
      //       "[Pusher] connection state:",
      //       states.previous,
      //       "→",
      //       states.current,
      //     );
      //   },
      // );

      // pusher.connection.bind("error", (err: unknown) => {
      //   console.error("[Pusher] connection error:", err);
      // });

      const channelName = `private-org-${orgId}`;
      const channel = pusher.subscribe(channelName);

      channel.bind(
        EVENTS.CONVERSATION_NEW,
        (data: { conversationId: number; sessionId: string }) => {
          // Always read from ref — never from closure
          stableRef.current.incrementUnread();
          stableRef.current.callbacks?.onConversationNew?.(data);
        },
      );

      channel.bind(EVENTS.CONVERSATION_MESSAGE, (data: unknown) => {
        const payload = data as Partial<MessagePayload>;
        if (typeof payload.conversationId !== "number") return;

        if (payload.role === "user") {
          const isHumanMode =
            payload.handoffStatus === "human" ||
            payload.handoffStatus === "pending_handoff";

          if (!isHumanMode) {
            stableRef.current.incrementUnread();
          }
          // Human mode unread is now DB-driven via getHumanUnreadConversationIdsAction
          // PusherProvider invalidates ["conversations", "human-unread"] on message events
        }

        stableRef.current.callbacks?.onMessage?.(payload as MessagePayload);
      });

      channel.bind(EVENTS.CONVERSATION_TAKEOVER, (data: TakeoverPayload) => {
        if (data.handoffStatus === "pending_handoff") {
          stableRef.current.setPendingHandoff(true);
          void stableRef.current.queryClient.invalidateQueries({
            queryKey: ["conversations", "pending-count"],
          });
        } else if (
          data.handoffStatus === "human" ||
          data.handoffStatus === "ai"
        ) {
          stableRef.current.setPendingHandoff(false);
        }
        stableRef.current.callbacks?.onTakeover?.(data);
      });

      channel.bind(EVENTS.CONVERSATION_RETURN, (data: ReturnPayload) => {
        stableRef.current.setPendingHandoff(false);
        void stableRef.current.queryClient.invalidateQueries({
          queryKey: ["conversations", "pending-count"],
        });
        stableRef.current.callbacks?.onReturn?.(data);
      });

      channel.bind(EVENTS.DOCUMENT_UPDATED, (data: unknown) => {
        console.log("[Pusher] document:updated", data);
        stableRef.current.callbacks?.onDocumentUpdated?.(data);
      });

      channel.bind(EVENTS.NOTIFICATION_NEW, (data: NotificationItem) => {
        stableRef.current.incrementUnread();
        stableRef.current.callbacks?.onNotificationNew?.(data);
      });

      channel.bind(EVENTS.USAGE_UPDATED, (data: unknown) => {
        const payload = data as { messagesUsed: number; messagesLimit: number };
        stableRef.current.callbacks?.onUsageUpdated?.(payload);
      });

      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // orgId is the only dep — connection rebuilds only when org changes
    // everything else is accessed via stableRef which is always current
  }, [orgId]);
}
