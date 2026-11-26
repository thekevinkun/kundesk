"use server";

// Dashboard stat server action — called by TanStack Query on the client
// Same queries as page.tsx but wrapped in a server action for client-side refetch
// requireOrg() enforces auth — never called without a valid session

import { z } from "zod/v4";
import { requireOrg } from "@/lib/auth";
import {
  getRecentActiveConversations,
  findConversationPage,
  getHumanUnreadConversationIds,
  getAwaitingReplyConversationIds,
  markConversationRead,
  getLiveOverviewSnapshot,
  getLiveConversationPreview,
  getRecentKnowledgeItems,
} from "@/lib/db/queries/dashboard";
import { getOwnerTimezone } from "@/lib/timezone";
import { getDashboardCharts } from "@/lib/db/queries/dashboard";
import type {
  ActionResult,
  ConversationRow as ConversationRowType,
} from "@/types/api";
import type {
  DashboardChartData,
  LiveConversationPreview,
  RecentKnowledgeItem,
  LiveOverviewSnapshot,
} from "@/types/dashboard";

// Snapshot refetch for the dashboard overview. The active org and its timezone
// come exclusively from the server session; the browser cannot select a tenant.
export async function getLiveOverviewSnapshotAction(): Promise<LiveOverviewSnapshot> {
  const { orgId } = await requireOrg();
  const timezone = await getOwnerTimezone();
  return getLiveOverviewSnapshot(orgId, timezone);
}

export async function getLiveConversationPreviewAction(): Promise<LiveConversationPreview | null> {
  const { orgId } = await requireOrg();
  return getLiveConversationPreview(orgId);
}

export async function getRecentKnowledgeItemsAction(): Promise<
  RecentKnowledgeItem[]
> {
  const { orgId } = await requireOrg();
  return getRecentKnowledgeItems(orgId);
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
export async function getDashboardChartData(): Promise<DashboardChartData> {
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

// Conversations staff opened but the customer is still waiting on — quiet "Belum dibalas" marker
export async function getAwaitingReplyConversationIdsAction(): Promise<
  number[]
> {
  const { orgId } = await requireOrg();
  return getAwaitingReplyConversationIds(orgId);
}

const markReadSchema = z.number().int().positive();

// Staff opened (or closed) a conversation — the org comes from the session, never from the browser
export async function markConversationReadAction(
  rawConversationId: unknown,
): Promise<ActionResult> {
  const parsed = markReadSchema.safeParse(rawConversationId);
  if (!parsed.success) return { success: false, error: "Invalid conversation" };
  const { orgId } = await requireOrg();
  await markConversationRead(parsed.data, orgId);
  return { success: true, data: undefined };
}
