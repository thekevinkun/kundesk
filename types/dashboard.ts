export interface LiveOverviewSnapshot {
  stats: {
    totalMessages: number;
    messagesToday: number;
    answeredRate: number;
    uniqueVisitors: number;
    avgResponseTime: string | null;
  };
  queue: {
    activeConversationCount: number;
    pendingHandoffCount: number;
  };
  bot: {
    language: string;
    isActive: boolean;
    accentColor: string;
    documentCount: number;
    totalChunks: number;
  } | null;
  organization: {
    slug: string;
    messagesUsed: number;
    messagesLimit: number;
  };
}

export interface LiveOverviewSnapshotInput {
  totalMessages: number;
  messagesToday: number;
  answeredRate: number;
  uniqueVisitors: number;
  avgResponseTime: string | null;
  activeConversationCount: number;
  pendingHandoffCount: number;
  bot: LiveOverviewSnapshot["bot"];
  organization: LiveOverviewSnapshot["organization"] | null;
}
