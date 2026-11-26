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
  // Clerk userId of the staff member who took over — only meaningful in manual mode
  takenOverBy: string | null;
  // First name of that staff member, resolved on the server from the org's members — null when unknown
  takenOverByName: string | null;
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

// Filter chips of the dashboard conversation queue
export type QueueFilter = "all" | "pending_handoff" | "ai" | "human";

// How many fetched conversations each chip selects
export type QueueCounts = Record<QueueFilter, number>;

// How many rows the display cap hides, and how many of those still need staff
export interface QueueOverflow {
  hidden: number;
  hiddenPending: number;
}
