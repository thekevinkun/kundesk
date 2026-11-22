import type {
  LiveOverviewSnapshot,
  LiveOverviewSnapshotInput,
} from "@/types/dashboard";

// Keeps the server-rendered seed and client refetch contract identical.
// Database access remains in lib/db/queries/dashboard.ts.
export function createLiveOverviewSnapshot(
  input: LiveOverviewSnapshotInput,
): LiveOverviewSnapshot {
  return {
    stats: {
      totalMessages: input.totalMessages,
      messagesToday: input.messagesToday,
      answeredRate: input.answeredRate,
      uniqueVisitors: input.uniqueVisitors,
      avgResponseTime: input.avgResponseTime,
      totalHandoffCount: input.totalHandoffCount,
    },
    queue: {
      activeConversationCount: input.activeConversationCount,
      pendingHandoffCount: input.pendingHandoffCount,
    },
    bot: input.bot,
    // requireOrg() guarantees the organization exists in normal operation. Keep
    // this safe fallback so a partially provisioned tenant never breaks /dashboard.
    organization: input.organization ?? {
      slug: "",
      messagesUsed: 0,
      messagesLimit: 100,
      plan: "free",
    },
  };
}
