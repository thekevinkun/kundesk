import type { SubscriptionStatus } from "@/types/billing";

export interface LiveOverviewSnapshot {
  stats: {
    totalMessages: number;
    messagesToday: number;
    answeredRate: number;
    uniqueVisitors: number;
    avgResponseTime: string | null;
    totalHandoffCount: number;
    // All conversations ever started — the base for "finished without staff"
    totalConversationCount: number;
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
    // Payment state — drives the "Pembayaran jatuh tempo" priority
    subscriptionStatus: SubscriptionStatus;
  };
  // Counts the knowledge rail and the priority card need — both scoped to this org
  knowledgeHealth: {
    // Documents whose processing failed — KUN cannot learn from them
    failedDocumentCount: number;
    // Entries whose latest change has not reached KUN yet
    staleEntryCount: number;
  };
}

export interface LiveOverviewSnapshotInput {
  totalMessages: number;
  messagesToday: number;
  answeredRate: number;
  uniqueVisitors: number;
  avgResponseTime: string | null;
  totalHandoffCount: number;
  totalConversationCount: number;
  activeConversationCount: number;
  pendingHandoffCount: number;
  bot: LiveOverviewSnapshot["bot"];
  organization: LiveOverviewSnapshot["organization"] | null;
  knowledgeHealth: LiveOverviewSnapshot["knowledgeHealth"];
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

// A manual or pending conversation whose newest message is from the customer (last 24 hours)
export interface ConversationAttentionCandidate {
  id: number;
  handoffStatus: string;
  lastMessageAt: Date;
  // When any staff member last opened it — null if nobody ever did
  staffReadAt: Date | null;
}

// The candidates split into "new for staff" and "opened but still unanswered"
export interface ConversationAttention {
  unreadIds: number[];
  awaitingIds: number[];
}

// What a queue or table row marks: new for staff, opened but unanswered, or nothing
export type RowAttention = "unread" | "awaiting" | null;

// ── Prioritas Sekarang ──
// Colors the item's box: danger needs someone now, warning needs someone soon
export type PriorityTone = "danger" | "warning";

// One id per kind of item — stable keys for list animation
export type PriorityId =
  | "pending-handoff"
  | "payment-past-due"
  | "quota-full"
  | "kun-inactive"
  | "quota-warning"
  | "documents-failed"
  | "knowledge-stale";

export interface PriorityItem {
  id: PriorityId;
  tone: PriorityTone;
  title: string;
  detail: string;
  // Where the owner fixes it
  href: string;
}

// Everything the rule needs — all of it is already known on the dashboard
export interface PriorityInput {
  // Admin-only items stay hidden from members (members handle conversations only)
  isAdmin: boolean;
  pendingHandoffCount: number;
  botActive: boolean;
  quotaUsed: number;
  quotaLimit: number;
  subscriptionStatus: SubscriptionStatus;
  failedDocumentCount: number;
  staleEntryCount: number;
}

export interface PriorityResult {
  // Most urgent first — the card shows the first three and offers the rest
  items: PriorityItem[];
  // Shown when there are no items
  allClear: { title: string; detail: string };
}

// What the dashboard hands to the document preview dialog — it only needs these two fields
export interface DocumentPreviewTarget {
  id: number;
  name: string;
}
