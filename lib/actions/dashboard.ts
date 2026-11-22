"use server";

// Dashboard stat server action — called by TanStack Query on the client
// Same queries as page.tsx but wrapped in a server action for client-side refetch
// requireOrg() enforces auth — never called without a valid session

import { requireOrg } from "@/lib/auth";
import {
  getRecentActiveConversations,
  findConversationPage,
  getHumanUnreadConversationIds,
  getLiveOverviewSnapshot,
} from "@/lib/db/queries/dashboard";
import { getOwnerTimezone } from "@/lib/timezone";
import { getDashboardCharts } from "@/lib/db/queries/dashboard";
import type { ConversationRow as ConversationRowType } from "@/types/api";
import type { LiveOverviewSnapshot } from "@/types/dashboard";

// Snapshot refetch for the dashboard overview. The active org and its timezone
// come exclusively from the server session; the browser cannot select a tenant.
export async function getLiveOverviewSnapshotAction(): Promise<LiveOverviewSnapshot> {
  const { orgId } = await requireOrg();
  const timezone = await getOwnerTimezone();
  return getLiveOverviewSnapshot(orgId, timezone);
}

export async function getRecentActiveConversationsAction(): Promise<
  ConversationRowType[]
> {
  const { orgId } = await requireOrg();
  const rows = await getRecentActiveConversations(orgId);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    takenOverAt: row.takenOverAt ? row.takenOverAt.toISOString() : null,
  }));
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

// ── Get IDs of conversations with unread messages for human agents ──
// used by dashboard and widget to trigger notifications and red badges
export async function getHumanUnreadConversationIdsAction(): Promise<number[]> {
  const { orgId } = await requireOrg();
  return getHumanUnreadConversationIds(orgId);
}
