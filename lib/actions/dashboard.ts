"use server";

// Dashboard stat server action — called by TanStack Query on the client
// Same queries as page.tsx but wrapped in a server action for client-side refetch
// requireOrg() enforces auth — never called without a valid session

import { requireOrg } from "@/lib/auth";
import {
  getTotalMessages,
  getAnsweredRate,
  getUniqueVisitors,
  getAvgResponseTime,
  findConversationPage,
} from "@/lib/db/queries/dashboard";
import { getOwnerTimezone } from "@/lib/timezone";
import { getDashboardCharts } from "@/lib/db/queries/dashboard";

export interface DashboardStats {
  totalMessages: number;
  answeredRate: number;
  uniqueVisitors: number;
  avgResponseTime: string | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Auth enforced here — orgId comes from server session, never from client
  const { orgId } = await requireOrg();

  // All four in parallel — same pattern as page.tsx
  const [totalMessages, answeredRate, uniqueVisitors, avgResponseTime] =
    await Promise.all([
      getTotalMessages(orgId),
      getAnsweredRate(orgId),
      getUniqueVisitors(orgId),
      getAvgResponseTime(orgId),
    ]);

  return { totalMessages, answeredRate, uniqueVisitors, avgResponseTime };
}

// ── Find which page a conversation lives on — called by GlobalSearch before navigating ──
// Prevents ?highlight landing on page 1 when the conversation is on page 2+
export async function getConversationPageAction(
  conversationId: number,
): Promise<number> {
  // orgId from server session — never from client input
  const { orgId } = await requireOrg();
  return findConversationPage(conversationId, orgId);
}

// ── Chart data server action — called by TanStack Query when usage:updated fires ──
// Returns all three time-series datasets so charts refresh after each new message
export async function getDashboardChartData(): Promise<{
  dailyTrend: { date: string; count: number }[];
  monthlyCurrent: number[];
  monthlyPrevious: number[];
  weeklyMessages: number[];
  currentYear: number;
}> {
  const { orgId } = await requireOrg();
  const timezone = await getOwnerTimezone();
  return getDashboardCharts(orgId, timezone);
}
