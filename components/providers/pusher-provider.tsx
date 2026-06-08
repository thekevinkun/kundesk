"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePusherChannel } from "@/hooks/use-pusher-channel";
import { useSoundNotification } from "@/hooks/use-sound-notification";
import { useConversationStore } from "@/stores/conversation-store";
import { useQueryClient } from "@tanstack/react-query";
import type {
  TakeoverPayload,
  MessagePayload,
} from "@/hooks/use-pusher-channel";

// Module-level timer — survives re-renders, one instance for the entire app session
let chartInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
interface PusherProviderProps {
  orgId: string;
}

export function PusherProvider({ orgId }: PusherProviderProps) {
  const { playNewMessage, playHandoffAlert } = useSoundNotification();
  const queryClient = useQueryClient();

  // Read only what we need — minimize re-render triggers
  const hydrateUnreadConversationIds = useConversationStore(
    (s) => s.hydrateUnreadConversationIds,
  );
  const setUsage = useConversationStore((s) => s.setUsage);

  // Stable refs for sound functions — avoids recreating callbacks when sound hook re-renders
  const soundRef = useRef({ playNewMessage, playHandoffAlert });
  useEffect(() => {
    soundRef.current = { playNewMessage, playHandoffAlert };
  });

  // Stable ref for setUsage and queryClient
  const stableRef = useRef({ setUsage, queryClient, orgId });
  useEffect(() => {
    stableRef.current = { setUsage, queryClient, orgId };
  });

  useEffect(() => {
    hydrateUnreadConversationIds(orgId);
  }, [hydrateUnreadConversationIds, orgId]);

  // Cleanup chart timer on unmount
  useEffect(() => {
    return () => {
      if (chartInvalidateTimer) {
        clearTimeout(chartInvalidateTimer);
        chartInvalidateTimer = null;
      }
    };
  }, []);

  const handleConversationNew = useCallback(() => {
    soundRef.current.playNewMessage();
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
  }, []);

  const handleTakeover = useCallback((payload: TakeoverPayload) => {
    if (payload.handoffStatus === "pending_handoff") {
      soundRef.current.playHandoffAlert();
    }
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
    });
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
  }, []);

  const handleMessage = useCallback((payload: MessagePayload) => {
    const isHumanMode =
      payload.handoffStatus === "human" ||
      payload.handoffStatus === "pending_handoff";
    if (isHumanMode && payload.role === "user") {
      soundRef.current.playNewMessage();
    }
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
  }, []);

  const handleReturn = useCallback(() => {
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "pending-count"],
    });
    void stableRef.current.queryClient.invalidateQueries({
      queryKey: ["conversations", "recent"],
    });
  }, []);

  const handleUsageUpdated = useCallback(
    (payload: { messagesUsed: number; messagesLimit: number }) => {
      // console.log("[Pusher] usage:updated received", payload);
      // console.log("[QueryClient] invalidating stats...");

      // Update usage bar instantly via Zustand
      stableRef.current.setUsage(payload.messagesUsed, payload.messagesLimit);

      // Stat cards — invalidate immediately
      void stableRef.current.queryClient.invalidateQueries({
        queryKey: ["dashboard", stableRef.current.orgId, "stats"],
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
    onUsageUpdated: handleUsageUpdated,
  });

  return null;
}
