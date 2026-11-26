"use client";

// Ids of manual chats staff opened but customers are still waiting on
// The key carries the org so switching organizations never shows the previous org's ids

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { getAwaitingReplyConversationIdsAction } from "@/lib/actions/dashboard";

// One stable empty array — a fresh [] each render would defeat the memos of callers
const EMPTY_IDS: number[] = [];

export function useAwaitingReplyIds(): number[] {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const { data } = useQuery({
    queryKey: ["conversations", "awaiting-reply", orgId],
    queryFn: getAwaitingReplyConversationIdsAction,
    enabled: !!orgId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    // Safety net for a missed Pusher event
    refetchInterval: 60_000,
  });

  return data ?? EMPTY_IDS;
}
