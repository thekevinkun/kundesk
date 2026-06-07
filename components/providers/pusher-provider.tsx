// Mounts the Pusher subscription once for the entire dashboard session
// Lives in layout.tsx — keeps the channel alive across page navigations
// Also owns sound notifications — plays on relevant Pusher events

"use client";

import { useCallback, useEffect } from "react";
import { usePusherChannel } from "@/hooks/use-pusher-channel";
import { useSoundNotification } from "@/hooks/use-sound-notification";
import { useConversationStore } from "@/stores/conversation-store";
import { useQueryClient } from "@tanstack/react-query";
import type {
  TakeoverPayload,
  MessagePayload,
} from "@/hooks/use-pusher-channel";

interface PusherProviderProps {
  orgId: string;
}

export function PusherProvider({ orgId }: PusherProviderProps) {
  const { playNewMessage, playHandoffAlert } = useSoundNotification();
  const queryClient = useQueryClient();
  const hydrateUnreadConversationIds = useConversationStore(
    (s) => s.hydrateUnreadConversationIds,
  );
  const setPendingHandoff = useConversationStore((s) => s.setPendingHandoff);
  const setUsage = useConversationStore((s) => s.setUsage);

  useEffect(() => {
    hydrateUnreadConversationIds(orgId);
  }, [hydrateUnreadConversationIds, orgId]);

  const handleConversationNew = useCallback(() => {
    playNewMessage();
    // Invalidate recent conversations panel
    void queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
  }, [playNewMessage, queryClient]);

  const handleTakeover = useCallback(
    (payload: TakeoverPayload) => {
      if (payload.handoffStatus === "pending_handoff") {
        playHandoffAlert();
        setPendingHandoff(true);
        void queryClient.invalidateQueries({
          queryKey: ["conversations", "pending-count"],
        });
      } else {
        setPendingHandoff(false);
      }
    },
    [playHandoffAlert, setPendingHandoff, queryClient],
  );

  const handleMessage = useCallback(
    (payload: MessagePayload) => {
      const isHumanMode =
        payload.handoffStatus === "human" ||
        payload.handoffStatus === "pending_handoff";
      if (isHumanMode && payload.role === "user") {
        playNewMessage();
      }
      // Invalidate recent conversations so panel row updates live
      void queryClient.invalidateQueries({
        queryKey: ["conversations", "recent"],
      });
    },
    [playNewMessage, queryClient],
  );

  const handleReturn = useCallback(() => {
    setPendingHandoff(false);
    void queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
    });
  }, [setPendingHandoff, queryClient]);

  // Module-level debounce timer for chart invalidations
  let chartInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

  // usage:updated — update Zustand directly + invalidate stat cards immediately
  const handleUsageUpdated = useCallback(
    (payload: { messagesUsed: number; messagesLimit: number }) => {
      // Zustand — BotStatusPanel reads from here, updates instantly
      setUsage(payload.messagesUsed, payload.messagesLimit);

      // Stat cards — invalidate immediately, they're cheap
      void queryClient.invalidateQueries({
        queryKey: ["dashboard", orgId, "stats"],
      });

      // Charts — debounce to avoid excessive refetches
      if (chartInvalidateTimer) clearTimeout(chartInvalidateTimer);
      chartInvalidateTimer = setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["dashboard", orgId, "charts"],
        });
      }, 2000); // 2s debounce
    },
    [setUsage, queryClient, orgId],
  );

  usePusherChannel(orgId, {
    onConversationNew: handleConversationNew,
    onTakeover: handleTakeover,
    onMessage: handleMessage,
    onReturn: handleReturn,
    onUsageUpdated: handleUsageUpdated,
  });

  return null;
}
