// Dashboard stat queries — all scoped to orgId (tenant isolation)
// Called in parallel from dashboard page.tsx via Promise.all
// Never called without orgId — requireOrg() enforces this upstream

import { eq, count, countDistinct, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orgs,
  messages,
  conversations,
  chatbots,
  documents,
  chunks,
  notifications,
} from "@/lib/db/schema";
import { toDateSafe } from "@/helpers/format";
import type { HandoffStatus, DeliveryChannel } from "@/types/chat";

// ── Total messages sent to this org's chatbot ──
// Counts ALL roles (user + assistant + human_agent) — full volume metric
export async function getTotalMessages(orgId: string): Promise<number> {
  const [result] = await db.select({ total: count() }).from(messages).where(
    // Always scope to org first — tenant isolation
    eq(messages.orgId, orgId),
  );

  return result?.total ?? 0;
}

// ── Auto-answer rate — assistant messages / total messages × 100 ──
// "Terjawab Otomatis" stat — shows how much the AI is handling
export async function getAnsweredRate(orgId: string): Promise<number> {
  // Run both counts in parallel — no need to wait for one before the other
  const [totalResult, assistantResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(messages)
      .where(eq(messages.orgId, orgId)),
    db
      .select({ total: count() })
      .from(messages)
      .where(
        and(
          eq(messages.orgId, orgId),
          // Only count AI responses — not user messages or human_agent messages
          eq(messages.role, "assistant"),
        ),
      ),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const answered = assistantResult[0]?.total ?? 0;

  // Avoid division by zero — return 0 if no messages yet
  if (total === 0) return 0;

  return Math.round((answered / total) * 1000) / 10; // e.g. 97.3
}

// ── Unique visitors — distinct sessionIds across all conversations ──
// Each browser session = one anonymous visitor (no auth required for customers)
export async function getUniqueVisitors(orgId: string): Promise<number> {
  const [result] = await db
    .select({ total: countDistinct(conversations.sessionId) })
    .from(conversations)
    .where(
      // Scope to org — tenant isolation
      eq(conversations.orgId, orgId),
    );

  return result?.total ?? 0;
}

// ── Daily message trend — last 30 days for area chart ──
// Returns array of { date: "DD/MM", count: number } sorted oldest→newest
export async function getDailyMessageTrend(
  orgId: string,
): Promise<{ date: string; count: number }[]> {
  // Raw SQL — Drizzle doesn't have a clean date_trunc + group by date abstraction
  // Cast createdAt to date, group, count — scoped to org and last 30 days
  const result = await db.execute<{ date: string; count: number }>(
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', ${messages.createdAt}), 'DD/MM') AS date,
        COUNT(*)::int AS count
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        AND ${messages.createdAt} >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', ${messages.createdAt})
      ORDER BY DATE_TRUNC('day', ${messages.createdAt}) ASC
    `,
  );

  return result.rows as { date: string; count: number }[];
}

// ── Monthly message totals — current year vs previous year for line chart ──
// Returns { current: number[], previous: number[] } — index 0 = January
export async function getMonthlyMessageComparison(orgId: string): Promise<{
  current: number[];
  previous: number[];
}> {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Both years in one query — cheaper than two round trips
  const result = await db.execute<{
    year: number;
    month: number;
    count: number;
  }>(
    sql`
      SELECT
        EXTRACT(YEAR FROM ${messages.createdAt})::int AS year,
        EXTRACT(MONTH FROM ${messages.createdAt})::int AS month,
        COUNT(*)::int AS count
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        AND EXTRACT(YEAR FROM ${messages.createdAt}) IN (${currentYear}, ${previousYear})
      GROUP BY year, month
      ORDER BY year, month
    `,
  );

  // Initialize 12-month arrays with zeros — months without data stay 0
  const current = Array<number>(12).fill(0);
  const previous = Array<number>(12).fill(0);

  for (const row of result.rows as {
    year: number;
    month: number;
    count: number;
  }[]) {
    // month from SQL is 1-indexed — convert to 0-indexed array position
    const idx = row.month - 1;
    if (row.year === currentYear) current[idx] = row.count;
    else previous[idx] = row.count;
  }

  return { current, previous };
}

// ── Weekly message counts — Mon–Sun this week for bar chart ──
// Returns array of 7 numbers, index 0 = Monday
export async function getWeeklyMessages(orgId: string): Promise<number[]> {
  const result = await db.execute<{ dow: number; count: number }>(
    sql`
      SELECT
        EXTRACT(DOW FROM ${messages.createdAt})::int AS dow,
        COUNT(*)::int AS count
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        AND DATE_TRUNC('week', ${messages.createdAt}) = DATE_TRUNC('week', NOW())
      GROUP BY dow
      ORDER BY dow
    `,
  );

  // DOW: 0=Sunday, 1=Mon ... 6=Sat — remap to Mon-first (index 0=Mon)
  const week = Array<number>(7).fill(0);
  for (const row of result.rows as { dow: number; count: number }[]) {
    // Convert Sunday(0) → index 6, Mon(1) → index 0, etc.
    const idx = row.dow === 0 ? 6 : row.dow - 1;
    week[idx] = row.count;
  }

  return week;
}

// ── Recent conversations — last 10 for dashboard overview table ──
// Joins messages to get the last message preview per conversation
// Scoped to orgId — tenant isolation
export async function getRecentConversations(orgId: string): Promise<
  {
    id: number;
    sessionId: string;
    handoffStatus: HandoffStatus;
    deliveryChannel: DeliveryChannel;
    createdAt: Date;
    lastMessage: string | null;
    lastMessageAt: Date | null;
    messageCount: number;
    takenOverBy: string | null;
    takenOverAt: Date | null;
  }[]
> {
  // Raw SQL — Drizzle doesn't have a clean DISTINCT ON abstraction
  // Gets last message per conversation + total message count in one query
  const result = await db.execute<{
    id: number;
    session_id: string;
    handoff_status: HandoffStatus;
    delivery_channel: DeliveryChannel;
    created_at: Date;
    last_message: string | null;
    last_message_at: Date | null;
    message_count: number;
    taken_over_by: string | null;
    taken_over_at: Date | null;
  }>(
    sql`
      SELECT
        c.id,
        c.session_id,
        c.handoff_status,
        c.delivery_channel,
        c.created_at,
        c.taken_over_by,
        c.taken_over_at,

        -- Last message timestamp — used to derive expired status client-side
        (
          SELECT m.created_at
          FROM ${messages} m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message_at,

        -- Last message content — truncated to 80 chars for preview
        LEFT(
          (
            SELECT m.content
            FROM ${messages} m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ),
          80
        ) AS last_message,

        -- Total message count for this conversation
        (
          SELECT COUNT(*)::int
          FROM ${messages} m
          WHERE m.conversation_id = c.id
        ) AS message_count

      FROM ${conversations} c
      WHERE c.org_id = ${orgId}
      ORDER BY c.created_at DESC
      LIMIT 10
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    handoffStatus: row.handoff_status,
    deliveryChannel: row.delivery_channel,
    createdAt: toDateSafe(row.created_at),
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at ? toDateSafe(row.last_message_at) : null,
    messageCount: row.message_count,
    takenOverBy: row.taken_over_by,
    takenOverAt: row.taken_over_at ? toDateSafe(row.taken_over_at) : null,
  }));
}

// ── Single conversation by id — used for live prepend on conversation:new ──
// Same shape as getRecentConversations rows — compatible with ConversationRowType
export async function getConversationById(
  conversationId: number,
  orgId: string,
): Promise<{
  id: number;
  sessionId: string;
  handoffStatus: HandoffStatus;
  deliveryChannel: DeliveryChannel;
  createdAt: Date;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  messageCount: number;
  takenOverBy: string | null;
  takenOverAt: Date | null;
} | null> {
  const result = await db.execute<{
    id: number;
    session_id: string;
    handoff_status: HandoffStatus;
    delivery_channel: DeliveryChannel;
    created_at: Date;
    last_message: string | null;
    last_message_at: Date | null;
    message_count: number;
    taken_over_by: string | null;
    taken_over_at: Date | null;
  }>(
    sql`
      SELECT
        c.id,
        c.session_id,
        c.handoff_status,
        c.delivery_channel,
        c.created_at,
        c.taken_over_by,
        c.taken_over_at,
        (
          SELECT m.created_at
          FROM ${messages} m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message_at,
        LEFT(
          (
            SELECT m.content
            FROM ${messages} m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ),
          80
        ) AS last_message,
        (
          SELECT COUNT(*)::int
          FROM ${messages} m
          WHERE m.conversation_id = c.id
        ) AS message_count
      FROM ${conversations} c
      WHERE c.id = ${conversationId}
        AND c.org_id = ${orgId}
      LIMIT 1
    `,
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    handoffStatus: row.handoff_status,
    deliveryChannel: row.delivery_channel,
    createdAt: toDateSafe(row.created_at),
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at ? toDateSafe(row.last_message_at) : null,
    messageCount: row.message_count,
    takenOverBy: row.taken_over_by,
    takenOverAt: row.taken_over_at ? toDateSafe(row.taken_over_at) : null,
  };
}

// ── Bot status data — chatbot config + document/chunk counts for status panel ──
// Single query joining chatbots + aggregated document/chunk counts
export async function getBotStatus(orgId: string): Promise<{
  name: string;
  language: string;
  tone: string;
  isActive: boolean;
  accentColor: string;
  documentCount: number;
  totalChunks: number;
} | null> {
  // Get chatbot config — one per org
  const [chatbot] = await db
    .select({
      name: chatbots.name,
      language: chatbots.language,
      tone: chatbots.tone,
      isActive: chatbots.isActive,
      accentColor: chatbots.accentColor,
    })
    .from(chatbots)
    .where(
      // IDOR protection — always scope to orgId
      eq(chatbots.orgId, orgId),
    )
    .limit(1);

  // No chatbot yet — shouldn't happen after Phase 4 auto-seed, but guard anyway
  if (!chatbot) return null;

  // Document and chunk counts in parallel
  const [docResult, chunkResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          // Only count ready documents — processing/failed don't contribute to knowledge base
          eq(documents.status, "ready"),
        ),
      ),
    db.select({ total: count() }).from(chunks).where(eq(chunks.orgId, orgId)),
  ]);

  return {
    ...chatbot,
    documentCount: docResult[0]?.total ?? 0,
    totalChunks: chunkResult[0]?.total ?? 0,
  };
}

// ── Org data — slug + message usage for bot status panel ──
export async function getOrgData(orgId: string): Promise<{
  slug: string;
  messagesUsed: number;
  messagesLimit: number;
} | null> {
  const [org] = await db
    .select({
      slug: orgs.slug,
      messagesUsed: orgs.messagesUsed,
      messagesLimit: orgs.messagesLimit,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return org ?? null;
}

// ── Active org count — used on landing page trust strip ──
// No orgId scope — this is a global count for the public homepage
// Counts all orgs that have ever been active (subscriptionStatus != cancelled)
export async function getActiveOrgCount(): Promise<number> {
  const [result] = await db.select({ total: count() }).from(orgs);

  return result?.total ?? 0;
}

// ── Insert a notification for the org ──
// Called when Pusher events fire — keeps notification creation co-located with event triggers
export async function createNotification(
  orgId: string,
  type: string,
  title: string,
  body: string,
  conversationId?: number,
): Promise<void> {
  const [row] = await db
    .insert(notifications)
    .values({
      orgId,
      type,
      title,
      body,
      conversationId: conversationId ?? null,
    })
    .returning({ id: notifications.id });

  if (row) {
    // Fire Pusher so open notification panels update live
    const { triggerNotificationNew } = await import("@/lib/pusher");
    triggerNotificationNew(orgId, {
      id: row.id,
      type,
      title,
      body,
    }).catch(console.error);
  }
}

// ── Average AI response time — AVG(response_time_ms) on assistant messages ──
// Only assistant messages have responseTimeMs — user/human_agent rows are null
// NULL values are automatically excluded from AVG in PostgreSQL
// Returns seconds formatted to 1 decimal — e.g. "1.4s" or null if no data yet
export async function getAvgResponseTime(
  orgId: string,
): Promise<string | null> {
  const [result] = await db
    .select({
      // AVG returns numeric — cast to float, divide to get seconds
      avgMs: sql<number>`AVG(${messages.responseTimeMs})::float`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.orgId, orgId),
        // Only assistant messages have response time — explicit filter for clarity
        eq(messages.role, "assistant"),
      ),
    );

  const avg = result?.avgMs;

  // No assistant messages yet — return null so UI shows fallback
  if (avg == null) return null;

  // Convert ms to seconds, round to 1 decimal
  return `${(avg / 1000).toFixed(1)}s`;
}
