// Subscribes to the org's private Pusher channel from the browser
// Listens for real-time events and dispatches them to Zustand stores or callbacks
// Called once in PusherProvider — lives for the entire dashboard session

"use client";

import { useEffect } from "react";
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
}

export function usePusherChannel(
  orgId: string,
  callbacks?: PusherChannelCallbacks,
): void {
  const incrementUnread = useConversationStore((s) => s.incrementUnread);
  const addUnreadConversation = useConversationStore(
    (s) => s.addUnreadConversation,
  );
  const setPendingHandoff = useConversationStore((s) => s.setPendingHandoff);

  // queryClient at hook top level — invalidates sidebar badge immediately on pending_handoff
  const queryClient = useQueryClient();

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
          endpoint: "/api/pusher/auth",
          transport: "ajax",
        },
      });

      // private- prefix — server auth required before access is granted
      const channelName = `private-org-${orgId}`;
      const channel = pusher.subscribe(channelName);

      // New conversation — increment bell
      channel.bind(
        EVENTS.CONVERSATION_NEW,
        (data: { conversationId: number; sessionId: string }) => {
          // Only increment for new customer conversations — not internal events
          incrementUnread();
          callbacks?.onConversationNew?.(data);
        },
      );

      // New message — route to correct signal based on handoff status
      channel.bind(EVENTS.CONVERSATION_MESSAGE, (data: unknown) => {
        const payload = data as Partial<MessagePayload>;
        if (typeof payload.conversationId !== "number") return;

        if (payload.role === "user") {
          const isHumanMode =
            payload.handoffStatus === "human" ||
            payload.handoffStatus === "pending_handoff";

          if (isHumanMode) {
            // Human mode — add conversation to unread set (drives row dot + chat icon)
            // unreadConversationIds.size is the source of truth, no separate counter
            addUnreadConversation(payload.conversationId);
          } else {
            // AI mode customer message — bell counter as before
            incrementUnread();
          }
        }

        callbacks?.onMessage?.(payload as MessagePayload);
      });

      // Staff took over OR customer requested handoff — update pending flag + sidebar badge
      channel.bind(EVENTS.CONVERSATION_TAKEOVER, (data: TakeoverPayload) => {
        if (data.handoffStatus === "pending_handoff") {
          // Red dot on chat icon — customer waiting for staff
          setPendingHandoff(true);
          // Invalidate sidebar badge immediately — don't wait for 30s poll
          void queryClient.invalidateQueries({
            queryKey: ["conversations", "pending-count"],
          });
        } else if (
          data.handoffStatus === "human" ||
          data.handoffStatus === "ai"
        ) {
          // Pending is resolved for this event stream
          setPendingHandoff(false);
        }
        callbacks?.onTakeover?.(data);
      });

      // AI resumed — optional callback so conversations page reverts badge
      channel.bind(EVENTS.CONVERSATION_RETURN, (data: ReturnPayload) => {
        setPendingHandoff(false);
        void queryClient.invalidateQueries({
          queryKey: ["conversations", "pending-count"],
        });
        callbacks?.onReturn?.(data);
      });

      // Document status changed — optional callback
      channel.bind(EVENTS.DOCUMENT_UPDATED, (data: unknown) => {
        console.log("[Pusher] document:updated", data);
        callbacks?.onDocumentUpdated?.(data);
      });

      // New notification — prepend to panel list live
      channel.bind(EVENTS.NOTIFICATION_NEW, (data: NotificationItem) => {
        incrementUnread();
        callbacks?.onNotificationNew?.(data);
      });

      // Fix: use the same channelName variable — was previously "org-{orgId}" (wrong)
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
    // callbacks ref excluded intentionally — would cause infinite reconnects if caller
    // passes an inline object. Callers should memoize callbacks with useCallback.
  }, [orgId, incrementUnread]);
}
