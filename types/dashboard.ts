export interface LiveOverviewSnapshot {
  stats: {
    totalMessages: number;
    messagesToday: number;
    answeredRate: number;
    uniqueVisitors: number;
    avgResponseTime: string | null;
    totalHandoffCount: number;
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
    plan: "free" | "starter" | "pro";
  };
}

export interface LiveOverviewSnapshotInput {
  totalMessages: number;
  messagesToday: number;
  answeredRate: number;
  uniqueVisitors: number;
  avgResponseTime: string | null;
  totalHandoffCount: number;
  activeConversationCount: number;
  pendingHandoffCount: number;
  bot: LiveOverviewSnapshot["bot"];
  organization: LiveOverviewSnapshot["organization"] | null;
}

export interface DashboardChartData {
  dailyTrend: { date: string; count: number }[];
  monthlyCurrent: number[];
  monthlyPrevious: number[];
  weeklyMessages: number[];
  currentYear: number;
  currentMonth: number;
}

export interface LiveConversationPreview {
  id: number;
  sessionId: string;
  deliveryChannel: string;
  handoffStatus: "ai" | "pending_handoff" | "human";
  messages: {
    id: number;
    role: "user" | "assistant" | "human_agent";
    content: string;
    createdAt: string;
  }[];
}

export interface RecentKnowledgeItem {
  id: number;
  source: "document" | "manual";
  title: string;
  kind: string | null;
  chunkCount: number;
  entryCount: number | null;
  status: string | null;
  updatedAt: string;
}
