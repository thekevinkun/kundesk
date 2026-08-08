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

  // ⚠️ Stale closure problem: if we use incrementUnread/callbacks directly in the
  // Pusher event handlers, they capture the values from hook init. When callbacks
  // change (parent re-renders), the handlers still call the OLD callbacks.
  //
  // Solution: useRef holds a mutable object. Every render updates the ref contents.
  // Event handlers read from ref instead of closure — always current.
  // This avoids re-subscribing on every parent render (expensive, breaks Pusher state).
  //
  // Trade-off: handlers are technically not "pure" (read from ref instead of closure)
  // but we gain the performance benefit of stable subscriptions + current callback logic.
  const stableRef = useRef({
    incrementUnread,
    setPendingHandoff,
    queryClient,
    callbacks,
  });

  // Update ref contents every render — handlers will read the latest values
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

      // ⚠️ CRITICAL: channelAuthorization transport is "ajax" + headersProvider.
      // DO NOT change this to "fetch" or use a customHandler — both cause total
      // live-update failure. This was learned in Phase 14 through direct A/B testing:
      //   - "fetch" transport: pusher-js has no "fetch" key in its authorizer map,
      //     causes runtime error
      //   - customHandler with native fetch: all Pusher events stop firing (pending_handoff
      //     sound, dashboard updates, everything), browser sees no messages at all
      //
      // The "ajax" transport with headersProvider works correctly and is proven.
      // A POST /api/pusher/auth 401 seen in logs during debugging was NOT the root
      // cause of any live-update issue — do not chase it again (rule 119).
      //
      // Why "ajax"? It's synchronous, integrates with Pusher's retry logic, and
      // avoids the complexity of custom fetch error handling.
      const PusherClient = mod.default;
      const pusher = new PusherClient(key, {
        cluster,
        forceTLS: true,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax", // ← proven working, do not change
          headersProvider: () => ({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
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

      // ⚠️ Channel naming convention: private-org-{orgId}
      // "private-" prefix means Pusher requires auth before subscription.
      // The auth endpoint (/api/pusher/auth) verifies the user is in this org.
      // This prevents Customer A from subscribing to Customer B's events.
      //
      // Alternative was public channels, but public channels are enumerable —
      // an attacker could guess channel names and subscribe. Private channels
      // require explicit auth check, providing tenant isolation at the Pusher level.
      //
      // Event naming on this channel: conversation:new, conversation:message,
      // conversation:takeover, etc. See EVENTS object at top of file.
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

      // ⚠️ Unread tracking: different rules for AI-mode vs human-mode.
      // AI-mode: every message from the customer (role: "user") increments unread,
      //   because KUN will respond. Staff sees the conversation as "needing response".
      // Human-mode: customer message does NOT increment the Zustand store unread.
      //   Why? Staff is actively watching the conversation — they see messages
      //   in real-time in ConversationDialog. The unread count must reflect
      //   conversations needing STAFF attention (human-handed-off conversations).
      //
      // Human unread is DB-driven: getHumanUnreadConversationIdsAction counts
      // conversations where handoffStatus = "human" or "pending_handoff".
      // When this message event fires and role="user" + human-mode, we invalidate
      // the human-unread query so it refetches and shows the fresh count.
      // PusherProvider handles the invalidation — this hook just skips the increment.
      channel.bind(EVENTS.CONVERSATION_MESSAGE, (data: unknown) => {
        const payload = data as Partial<MessagePayload>;
        if (typeof payload.conversationId !== "number") return;

        if (payload.role === "user") {
          const isHumanMode =
            payload.handoffStatus === "human" ||
            payload.handoffStatus === "pending_handoff";

          if (!isHumanMode) {
            // AI-mode: increment the Zustand store — dashboard sees new conversation
            stableRef.current.incrementUnread();
          }
          // Human-mode: don't increment (DB query handles human-specific unread)
        }

        stableRef.current.callbacks?.onMessage?.(payload as MessagePayload);
      });

      // ⚠️ Handoff state machine via Pusher events.
      // States:
      //   - "ai" (default): KUN is handling the conversation
      //   - "pending_handoff": customer asked for staff, waiting for response
      //   - "human": staff took over, customer talking to person
      //
      // setPendingHandoff(true) flags the UI — show "Menunggu staff kami" footer,
      // sound notification, visual badge in sidebar. Only set on pending_handoff,
      // cleared on any other status (human, ai).
      //
      // Query invalidation: pending count is a key metric for dashboard.
      // When status changes out of pending_handoff, the count drops.
      // TanStack Query refetches ["conversations", "pending-count"] query.
      channel.bind(EVENTS.CONVERSATION_TAKEOVER, (data: TakeoverPayload) => {
        // takeover can fire with status pending_handoff (customer asked for help)
        // or human (staff just took over — customer already waiting)
        if (data.handoffStatus === "pending_handoff") {
          stableRef.current.setPendingHandoff(true);
          // Invalidate sidebar pending badge immediately
          void stableRef.current.queryClient.invalidateQueries({
            queryKey: ["conversations", "pending-count"],
          });
        } else if (
          data.handoffStatus === "human" ||
          data.handoffStatus === "ai"
        ) {
          // If takeover fired with a different status, clear pending flag
          stableRef.current.setPendingHandoff(false);
        }
        stableRef.current.callbacks?.onTakeover?.(data);
      });

      channel.bind(EVENTS.CONVERSATION_RETURN, (data: ReturnPayload) => {
        // return always clears pending — staff is done, KUN resumes
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
    // ⚠️ Dependency array: only orgId, NOT callbacks/incrementUnread/queryClient
    // Why?
    //   - If callbacks were in the dependency array, the effect re-runs every time
    //     callbacks change (parent re-render). This tears down and rebuilds the
    //     Pusher subscription each time — expensive, causes brief disconnection.
    //   - Instead, we use stableRef to always read the current callbacks without
    //     rebuilding the subscription.
    //   - orgId IS in the dependency array because if the user switches orgs,
    //     we must unsubscribe from the old channel and subscribe to the new one.
    //
    // Result: Pusher connection is stable for the entire dashboard session
    // (or until org changes), but handlers always execute current logic.
  }, [orgId]);
}
