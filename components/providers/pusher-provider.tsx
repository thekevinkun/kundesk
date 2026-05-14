// Mounts the Pusher subscription once for the entire dashboard session
// Lives in layout.tsx — keeps the channel alive across page navigations

"use client";

import { usePusherChannel } from "@/hooks/use-pusher-channel";

interface PusherProviderProps {
  orgId: string;
}

export function PusherProvider({ orgId }: PusherProviderProps) {
  // Hook handles connect/disconnect lifecycle — nothing to render
  usePusherChannel(orgId);
  return null;
}
