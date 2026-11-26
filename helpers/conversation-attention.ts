// Pure rule for "does staff still need to look at this conversation?"
// Kept out of SQL and components so every edge case is tested

import type {
  ConversationAttention,
  ConversationAttentionCandidate,
  RowAttention,
} from "@/types/dashboard";

// True when the conversation is new for staff
export function isUnreadForStaff(
  candidate: ConversationAttentionCandidate,
): boolean {
  // A pending handoff is an open request: opening it never clears it, only reply, dismiss or return does
  if (candidate.handoffStatus === "pending_handoff") return true;
  // Nobody ever opened this manual chat
  if (candidate.staffReadAt === null) return true;
  // Unread again when the customer wrote after staff last looked (same instant counts as read)
  return candidate.lastMessageAt.getTime() > candidate.staffReadAt.getTime();
}

// Splits candidates into unread ids and awaiting ids — input order is kept
export function splitAttention(
  candidates: readonly ConversationAttentionCandidate[],
): ConversationAttention {
  const unreadIds: number[] = [];
  const awaitingIds: number[] = [];
  for (const candidate of candidates) {
    // Pending is always unread, so awaiting only ever holds manual chats staff opened and left
    if (isUnreadForStaff(candidate)) unreadIds.push(candidate.id);
    else awaitingIds.push(candidate.id);
  }
  return { unreadIds, awaitingIds };
}

// Marker for one queue or table row
export function getRowAttention(
  handoffStatus: string,
  conversationId: number,
  unread: ReadonlySet<number>,
  awaiting: ReadonlySet<number>,
): RowAttention {
  // Pending rows already have their own red styling — no second marker
  if (handoffStatus === "pending_handoff") return null;
  if (unread.has(conversationId)) return "unread";
  if (awaiting.has(conversationId)) return "awaiting";
  return null;
}
