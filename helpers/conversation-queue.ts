// Pure helpers for the dashboard conversation queue: order, filter, count and cap
// Kept out of the component so the rules (pending first, cap never hides urgency) are tested

import type {
  QueueCounts,
  QueueFilter,
  QueueOverflow,
} from "@/types/dashboard";

// How many active conversations the dashboard queue fetches — larger than the display cap
// on purpose, so the filter chips can count over every fetched row
export const QUEUE_FETCH_LIMIT = 30;

// Rows shown at once: desktop has room for five, phones get three (CSS hides the extra rows)
export const QUEUE_CAP_DESKTOP = 5;
export const QUEUE_CAP_MOBILE = 3;

// Minimal row shape the helpers read — the real ConversationRow satisfies it
interface QueueRow {
  handoffStatus: string;
  lastMessageAt: string | Date | null;
  createdAt: string | Date;
}

// Every row belongs to exactly one chip; any unexpected status counts as KUN (same as the status pill)
function queueBucket(status: string): Exclude<QueueFilter, "all"> {
  if (status === "pending_handoff") return "pending_handoff";
  if (status === "human") return "human";
  return "ai";
}

// Latest activity in ms — a conversation with no message time falls back to its creation time
function activityTime(row: QueueRow): number {
  return new Date(row.lastMessageAt ?? row.createdAt).getTime();
}

// Pending handoffs first, then newest activity first — returns a new array
export function sortQueue<T extends QueueRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const aPending = a.handoffStatus === "pending_handoff";
    const bPending = b.handoffStatus === "pending_handoff";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return activityTime(b) - activityTime(a);
  });
}

// Keep only the rows a chip selects — "all" keeps everything
export function filterQueue<T extends QueueRow>(
  rows: readonly T[],
  filter: QueueFilter,
): T[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => queueBucket(row.handoffStatus) === filter);
}

// Count rows per chip so each chip can show its own number
export function countQueue(rows: readonly QueueRow[]): QueueCounts {
  const counts: QueueCounts = {
    all: rows.length,
    pending_handoff: 0,
    ai: 0,
    human: 0,
  };
  for (const row of rows) {
    counts[queueBucket(row.handoffStatus)] += 1;
  }
  return counts;
}

// What a cap hides — expects rows already sorted (pending first), so a pending row
// is hidden only when pending rows alone exceed the cap
export function getQueueOverflow(
  rows: readonly QueueRow[],
  cap: number,
): QueueOverflow {
  const hiddenRows = rows.slice(cap);
  return {
    hidden: hiddenRows.length,
    hiddenPending: hiddenRows.filter(
      (row) => row.handoffStatus === "pending_handoff",
    ).length,
  };
}
