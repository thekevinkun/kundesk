"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePusherChannel } from "@/hooks/use-pusher-channel";
import { useSoundNotification } from "@/hooks/use-sound-notification";
import { useConversationStore } from "@/stores/conversation-store";
import { useQueryClient } from "@tanstack/react-query";
import { getKunReplyKind, getQuotaCrossing } from "@/helpers/live-scene";
import type {
  LiveConversationPreview,
  LiveOverviewSnapshot,
} from "@/types/dashboard";
import type {
  TakeoverPayload,
  MessagePayload,
} from "@/hooks/use-pusher-channel";

// Module-level timer — survives re-renders, one instance for the entire app session
let chartInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
// When the customer leg of an AI-mode message was last drawn on the live scene
let customerShownAt = 0;
// A KUN reply inside this window of a drawn customer leg only travels back
const CUSTOMER_SHOWN_WINDOW_MS = 30_000;

interface PusherProviderProps {
  orgId: string;
}

export function PusherProvider({ orgId }: PusherProviderProps) {
  const { playNewMessage, playHandoffAlert } = useSoundNotification();
  const queryClient = useQueryClient();

  // Usage state from Zustand — updated via Pusher and used in UsageBar for instant updates
  const setUsage = useConversationStore((s) => s.setUsage);
  const setLiveWorkspaceEvent = useConversationStore(
    (s) => s.setLiveWorkspaceEvent,
  );

  // Reset bell and notification state on org change — no localStorage hydration needed
  const clearUnread = useConversationStore((s) => s.clearUnread);
  const setPendingHandoff = useConversationStore((s) => s.setPendingHandoff);
  const clearLiveWorkspaceEvent = useConversationStore(
    (s) => s.clearLiveWorkspaceEvent,
  );
  useEffect(() => {
    clearUnread();
    setPendingHandoff(false);
    clearLiveWorkspaceEvent();
  }, [clearLiveWorkspaceEvent, clearUnread, setPendingHandoff, orgId]);

  // Stable refs for sound functions — avoids recreating callbacks when sound hook re-renders
  const soundRef = useRef({ playNewMessage, playHandoffAlert });
  useEffect(() => {
    soundRef.current = { playNewMessage, playHandoffAlert };
  });

  // Stable ref for setUsage and queryClient
  const stableRef = useRef({
    setUsage,
    setLiveWorkspaceEvent,
    queryClient,
    orgId,
  });
  useEffect(() => {
    stableRef.current = {
      setUsage,
      setLiveWorkspaceEvent,
      queryClient,
      orgId,
    };
  }, [orgId, queryClient, setLiveWorkspaceEvent, setUsage]);

  // Cleanup chart timer on unmount
  useEffect(() => {
    return () => {
      if (chartInvalidateTimer) {
        clearTimeout(chartInvalidateTimer);
        chartInvalidateTimer = null;
      }
    };
  }, []);

  // Called by every conversation event handler below — it also refreshes the awaiting-reply
  // list, because each of those events can change whether a customer is still waiting
  const invalidateLiveConversationPreview = useCallback(() => {
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["dashboard", stableRef.current.orgId, "live-conversation"],
    });
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "awaiting-reply"],
    });
  }, []);

  const handleConversationNew = useCallback(() => {
    soundRef.current.playNewMessage();
    stableRef.current.setLiveWorkspaceEvent("customer-message-ai");
    // Remember the customer leg was drawn — the next KUN reply only travels back
    customerShownAt = Date.now();
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["dashboard", stableRef.current.orgId, "live-overview"],
    });
    invalidateLiveConversationPreview();
  }, [invalidateLiveConversationPreview]);

  const handleTakeover = useCallback(
    (payload: TakeoverPayload) => {
      if (payload.handoffStatus === "pending_handoff") {
        soundRef.current.playHandoffAlert();
        stableRef.current.setLiveWorkspaceEvent("handoff-requested");
      } else if (payload.handoffStatus === "human") {
        stableRef.current.setLiveWorkspaceEvent("takeover");
      }
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["conversations", "pending-count"],
      });
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["conversations", "recent"],
      });
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["dashboard", stableRef.current.orgId, "live-overview"],
      });
      invalidateLiveConversationPreview();
    },
    [invalidateLiveConversationPreview],
  );

  const handleMessage = useCallback(
    (payload: MessagePayload) => {
      const isHumanMode =
        payload.handoffStatus === "human" ||
        payload.handoffStatus === "pending_handoff";
      // An AI-mode customer message is drawn as a dot to KUN — remember it for the reply
      if (!isHumanMode && payload.role === "user") customerShownAt = Date.now();
      if (isHumanMode && payload.role === "user") {
        soundRef.current.playNewMessage();
      }
      if (payload.role === "user") {
        // Pending and human mode both send the customer's message toward the admin side
        stableRef.current.setLiveWorkspaceEvent(
          isHumanMode ? "customer-message-admin" : "customer-message-ai",
        );
      } else if (payload.role === "human_agent") {
        stableRef.current.setLiveWorkspaceEvent("admin-reply");
      } else if (payload.role === "assistant") {
        // Last known status of the live conversation, read before any refetch
        const cached =
          stableRef.current.queryClient.getQueryData<LiveConversationPreview | null>(
            ["dashboard", stableRef.current.orgId, "live-conversation"],
          );
        const kind = getKunReplyKind({
          customerShownRecently:
            Date.now() - customerShownAt < CUSTOMER_SHOWN_WINDOW_MS,
          handoffStatus: cached?.handoffStatus ?? null,
        });
        // Either way the customer leg is now accounted for
        customerShownAt = 0;
        stableRef.current.setLiveWorkspaceEvent(kind);
      }
      // Invalidate recent conversations to update last message preview and timestamp
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["conversations", "recent"],
      });
      // Invalidate human unread — new customer message may change who needs attention
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["conversations", "human-unread"],
      });
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["dashboard", stableRef.current.orgId, "live-overview"],
      });
      invalidateLiveConversationPreview();
    },
    [invalidateLiveConversationPreview],
  );

  const handleReturn = useCallback(() => {
    stableRef.current.setLiveWorkspaceEvent("returned");
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
    });
    // Invalidate recent conversations to update last message preview and timestamp
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
    // Invalidate human unread — new customer message may change who needs attention
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "human-unread"],
    });
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["dashboard", stableRef.current.orgId, "live-overview"],
    });
    invalidateLiveConversationPreview();
  }, [invalidateLiveConversationPreview]);

  const handleDocumentUpdated = useCallback(() => {
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["dashboard", stableRef.current.orgId, "live-overview"],
    });
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["dashboard", stableRef.current.orgId, "recent-knowledge"],
    });
  }, []);

  const handleUsageUpdated = useCallback(
    (payload: { messagesUsed: number; messagesLimit: number }) => {
      // console.log("[Pusher] usage:updated received", payload);
      // console.log("[QueryClient] invalidating stats...");

      // Quota crossing: compare with the last known usage BEFORE it is overwritten
      const known = useConversationStore.getState();
      const cached =
        stableRef.current.queryClient.getQueryData<LiveOverviewSnapshot>([
          "dashboard",
          stableRef.current.orgId,
          "live-overview",
        ]);
      const previousUsed =
        known.messagesUsed ?? cached?.organization.messagesUsed;
      const previousLimit =
        known.messagesLimit ?? cached?.organization.messagesLimit;
      // Without a known previous value there is nothing to compare, so no moment
      const crossing =
        previousUsed == null || previousLimit == null
          ? null
          : getQuotaCrossing(
              { used: previousUsed, limit: previousLimit },
              { used: payload.messagesUsed, limit: payload.messagesLimit },
            );
      if (crossing) stableRef.current.setLiveWorkspaceEvent(crossing);

      // Update usage bar instantly via Zustand
      stableRef.current.setUsage(payload.messagesUsed, payload.messagesLimit);

      // Live overview — invalidate immediately
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["dashboard", stableRef.current.orgId, "live-overview"],
      });

      // Charts — debounce 2s, module-level timer survives re-renders
      if (chartInvalidateTimer) clearTimeout(chartInvalidateTimer);
      chartInvalidateTimer = setTimeout(() => {
        void stableRef.current.queryClient.invalidateQueries({
          queryKey: ["dashboard", stableRef.current.orgId, "charts"],
        });
      }, 2_000);
    },
    [],
  );

  usePusherChannel(orgId, {
    onConversationNew: handleConversationNew,
    onTakeover: handleTakeover,
    onMessage: handleMessage,
    onReturn: handleReturn,
    onDocumentUpdated: handleDocumentUpdated,
    onUsageUpdated: handleUsageUpdated,
  });

  return null;
}
