// Analytics queries — deeper than dashboard overview
// All queries scoped to orgId first — tenant isolation, never skip
// Called in parallel from analytics page via Promise.all

import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, conversations } from "@/lib/db/schema";
import type { DeliveryChannel } from "@/types/chat";

// ── KPI: Total conversations (not messages) ──
// Distinct from getTotalMessages — conversations = sessions, messages = individual turns
export async function getTotalConversations(orgId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(conversations)
    .where(eq(conversations.orgId, orgId));

  return result?.total ?? 0;
}

// ── KPI: Handoff rate — conversations that were handed off / total conversations ──
// "human" + "pending_handoff" both count — customer initiated contact with staff
export async function getHandoffRate(orgId: string): Promise<number> {
  const [totalResult, handoffResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(conversations)
      .where(eq(conversations.orgId, orgId)),
    db
      .select({ total: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          // Both states mean customer wanted human — pending = waiting, human = taken over
          eq(conversations.wasHandedOff, true),
        ),
      ),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const handoffs = handoffResult[0]?.total ?? 0;

  if (total === 0) return 0;

  return Math.round((handoffs / total) * 1000) / 10; // e.g. 4.2
}

// ── KPI: AI resolution rate — conversations fully handled by AI (never handed off) ──
// Inverse of handoff rate — conversations where handoffStatus stayed "ai"
export async function getAiResolutionRate(orgId: string): Promise<number> {
  const [totalResult, resolvedResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(conversations)
      .where(eq(conversations.orgId, orgId)),
    db
      .select({ total: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          // Only conversations the AI handled entirely — no handoff requested
          eq(conversations.wasHandedOff, false),
        ),
      ),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const resolved = resolvedResult[0]?.total ?? 0;

  if (total === 0) return 0;

  return Math.round((resolved / total) * 1000) / 10;
}

// ── KPI: Avg response time across all assistant messages ──
// Returns formatted string e.g. "1.4s" — null if no assistant messages yet
export async function getAnalyticsAvgResponseTime(
  orgId: string,
): Promise<string | null> {
  const [result] = await db
    .select({
      avgMs: sql<number>`AVG(${messages.responseTimeMs})::float`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.orgId, orgId),
        // NULL responseTimeMs on user/human_agent rows — AVG ignores NULLs automatically
        eq(messages.role, "assistant"),
      ),
    );

  const avgMs = result?.avgMs;
  if (avgMs == null) return null;

  return `${(avgMs / 1000).toFixed(1)}s`;
}

// ── Handoff trend — daily handoff count over last 30 days ──
// Powers the HandoffInsightCard line chart
// Returns { date: "DD/MM", count: number }[] sorted oldest→newest
export async function getHandoffTrend(
  orgId: string,
): Promise<{ date: string; count: number }[]> {
  const result = await db.execute<{ date: string; count: number }>(
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', ${conversations.createdAt}), 'DD/MM') AS date,
        COUNT(*)::int AS count
      FROM ${conversations}
      WHERE
        ${conversations.orgId} = ${orgId}
        AND ${conversations.wasHandedOff} = true
        AND ${conversations.createdAt} >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', ${conversations.createdAt})
      ORDER BY DATE_TRUNC('day', ${conversations.createdAt}) ASC
    `,
  );

  return result.rows as { date: string; count: number }[];
}

// ── AI vs handoff split — for donut chart in HandoffInsightCard ──
// Returns { aiCount, handoffCount } — two slices of the donut
export async function getAiVsHandoffSplit(orgId: string): Promise<{
  aiCount: number;
  handoffCount: number;
}> {
  const [aiResult, handoffResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.wasHandedOff, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.wasHandedOff, true),
        ),
      ),
  ]);

  return {
    aiCount: aiResult[0]?.total ?? 0,
    handoffCount: handoffResult[0]?.total ?? 0,
  };
}

// ── Peak hours — message volume grouped by hour of day (0–23) ──
// Powers HourlyBarChart — tells owner when customers are most active
// Returns array of 24 numbers, index = hour (0=midnight, 12=noon)
export async function getPeakHours(orgId: string): Promise<number[]> {
  const result = await db.execute<{ hour: number; count: number }>(
    sql`
      SELECT
        EXTRACT(HOUR FROM ${messages.createdAt})::int AS hour,
        COUNT(*)::int AS count
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        -- Only user messages — we want when customers are active, not AI response volume
        AND ${messages.role} = 'user'
      GROUP BY hour
      ORDER BY hour ASC
    `,
  );

  // Initialize all 24 hours to zero — hours with no messages stay 0
  const hours = Array<number>(24).fill(0);
  for (const row of result.rows as { hour: number; count: number }[]) {
    hours[row.hour] = row.count;
  }

  return hours;
}

// ── Top questions — most frequent user messages, grouped by similarity ──
// Exact text match grouping — works well for short questions like "jam buka?"
// Returns top 8 questions with their frequency count
// Note: for a real production system this would use embeddings clustering —
// exact match is sufficient for MVP with < 10k messages
export async function getTopQuestions(
  orgId: string,
): Promise<{ question: string; count: number }[]> {
  const result = await db.execute<{ question: string; count: number }>(
    sql`
      SELECT
        -- Trim and lowercase for grouping — "Jam buka?" and "jam buka?" merge
        LOWER(TRIM(${messages.content})) AS question,
        COUNT(*)::int AS count
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        AND ${messages.role} = 'user'
        -- Ignore very short inputs — less than 5 chars are noise ("ok", "ya", "thx")
        AND LENGTH(TRIM(${messages.content})) >= 5
        -- Ignore very long messages — these are context-heavy, not repeating questions
        AND LENGTH(TRIM(${messages.content})) <= 200
      GROUP BY LOWER(TRIM(${messages.content}))
      ORDER BY count DESC
      LIMIT 50
    `,
  );

  return (result.rows as { question: string; count: number }[]).map((row) => ({
    // Capitalize first letter for display — grouped as lowercase, shown nicely
    question: row.question.charAt(0).toUpperCase() + row.question.slice(1),
    count: row.count,
  }));
}

// ── Channel breakdown — conversations per delivery channel ──
// Powers ChannelBreakdownCard donut — web_widget vs qr_link vs whatsapp
export async function getChannelBreakdown(
  orgId: string,
): Promise<{ channel: DeliveryChannel; count: number }[]> {
  const result = await db.execute<{
    channel: DeliveryChannel;
    count: number;
  }>(
    sql`
      SELECT
        ${conversations.deliveryChannel} AS channel,
        COUNT(*)::int AS count
      FROM ${conversations}
      WHERE ${conversations.orgId} = ${orgId}
      GROUP BY ${conversations.deliveryChannel}
      ORDER BY count DESC
    `,
  );

  return result.rows as { channel: DeliveryChannel; count: number }[];
}

// ── Response time trend — daily avg response time over last 30 days ──
// Powers ResponseTrendChart — shows if AI is getting faster/slower over time
// Returns { date: "DD/MM", avgMs: number }[] sorted oldest→newest
export async function getResponseTimeTrend(
  orgId: string,
): Promise<{ date: string; avgMs: number }[]> {
  const result = await db.execute<{ date: string; avg_ms: number }>(
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', ${messages.createdAt}), 'DD/MM') AS date,
        AVG(${messages.responseTimeMs})::float AS avg_ms
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        AND ${messages.role} = 'assistant'
        -- Only messages with a recorded response time
        AND ${messages.responseTimeMs} IS NOT NULL
        AND ${messages.createdAt} >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', ${messages.createdAt})
      ORDER BY DATE_TRUNC('day', ${messages.createdAt}) ASC
    `,
  );

  return (result.rows as { date: string; avg_ms: number }[]).map((row) => ({
    date: row.date,
    // Keep as ms in the query result — chart component converts to seconds for display
    avgMs: Math.round(row.avg_ms),
  }));
}
