// Mounts the Pusher subscription once for the entire dashboard session
// Lives in layout.tsx — keeps the channel alive across page navigations
// Also owns sound notifications — plays on relevant Pusher events

"use client";

import { useCallback } from "react";
import { usePusherChannel } from "@/hooks/use-pusher-channel";
import { useSoundNotification } from "@/hooks/use-sound-notification";
import type {
  TakeoverPayload,
  MessagePayload,
} from "@/hooks/use-pusher-channel";

interface PusherProviderProps {
  orgId: string;
}

export function PusherProvider({ orgId }: PusherProviderProps) {
  const { playNewMessage, playHandoffAlert } = useSoundNotification();

  // New conversation started — always play new-message sound
  const handleConversationNew = useCallback(() => {
    playNewMessage();
  }, [playNewMessage]);

  // Takeover event — play handoff-alert only when customer requests handoff
  // Staff-initiated takeover (handoffStatus === "human") gets no sound — staff did it themselves
  const handleTakeover = useCallback(
    (payload: TakeoverPayload) => {
      if (payload.handoffStatus === "pending_handoff") {
        playHandoffAlert();
      }
    },
    [playHandoffAlert],
  );

  // New message — play new-message sound only when customer writes in human/pending mode
  // AI mode messages are silent — only the new conversation event sounds there
  const handleMessage = useCallback(
    (payload: MessagePayload) => {
      const isHumanMode =
        payload.handoffStatus === "human" ||
        payload.handoffStatus === "pending_handoff";

      if (isHumanMode && payload.role === "user") {
        playNewMessage();
      }
    },
    [playNewMessage],
  );

  usePusherChannel(orgId, {
    onConversationNew: handleConversationNew,
    onTakeover: handleTakeover,
    onMessage: handleMessage,
  });

  return null;
}
