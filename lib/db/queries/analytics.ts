// Analytics queries — deeper than dashboard overview
// All queries scoped to orgId first — tenant isolation, never skip
// Called in parallel from analytics page via Promise.all
// timezone param: IANA timezone string e.g. "Asia/Makassar" (WIB UTC+7)
// Time-grouped queries use CTEs to pre-compute local timestamps — avoids PostgreSQL
// GROUP BY parameter mismatch error when using AT TIME ZONE with parameterized values

import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, conversations } from "@/lib/db/schema";
import type { DeliveryChannel } from "@/types/chat";

// ── KPI: Total conversations ──
export async function getTotalConversations(orgId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(conversations)
    .where(eq(conversations.orgId, orgId));

  return result?.total ?? 0;
}

// ── KPI: Handoff rate ──
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
          eq(conversations.wasHandedOff, true),
        ),
      ),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const handoffs = handoffResult[0]?.total ?? 0;

  if (total === 0) return 0;
  return Math.round((handoffs / total) * 1000) / 10;
}

// ── KPI: AI resolution rate ──
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
          eq(conversations.wasHandedOff, false),
        ),
      ),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const resolved = resolvedResult[0]?.total ?? 0;

  if (total === 0) return 0;
  return Math.round((resolved / total) * 1000) / 10;
}

// ── KPI: Avg response time ──
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

// ── Handoff trend — daily handoff count over last 30 days in owner's local timezone ──
// CTE pre-computes local_day once — avoids GROUP BY parameter mismatch
export async function getHandoffTrend(
  orgId: string,
  timezone: string,
): Promise<{ date: string; count: number }[]> {
  const result = await db.execute<{ date: string; count: number }>(
    sql`
      WITH local_convos AS (
        SELECT
          DATE_TRUNC('day', timezone(${timezone}, created_at AT TIME ZONE 'UTC')) AS local_day
        FROM conversations
        WHERE
          org_id = ${orgId}
          AND was_handed_off = true
      )
      SELECT
        TO_CHAR(local_day, 'DD/MM') AS date,
        COUNT(*)::int AS count
      FROM local_convos
      WHERE local_day >= DATE_TRUNC('day', timezone(${timezone}, now()))
        - INTERVAL '29 days'
        AND local_day <= DATE_TRUNC('day', timezone(${timezone}, now()))
      GROUP BY local_day
      ORDER BY local_day ASC
    `,
  );

  return result.rows as { date: string; count: number }[];
}

// ── AI vs handoff split — for donut chart ──
// No timezone needed — not time-windowed
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

// ── Peak hours — message volume grouped by local hour, not UTC hour ──
// CTE pre-computes local_hour once — avoids GROUP BY parameter mismatch
export async function getPeakHours(
  orgId: string,
  timezone: string,
): Promise<number[]> {
  const result = await db.execute<{ hour: number; count: number }>(
    sql`
      WITH local_msgs AS (
        SELECT
          EXTRACT(HOUR FROM timezone(${timezone}, created_at AT TIME ZONE 'UTC'))::int AS hour
        FROM messages
        WHERE
          org_id = ${orgId}
          AND role = 'user'
      )
      SELECT
        hour,
        COUNT(*)::int AS count
      FROM local_msgs
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

// ── Top questions — most frequent user messages ──
// No timezone needed — groups by content, not time
export async function getTopQuestions(
  orgId: string,
): Promise<{ question: string; count: number }[]> {
  const result = await db.execute<{ question: string; count: number }>(
    sql`
      SELECT
        LOWER(TRIM(${messages.content})) AS question,
        COUNT(*)::int AS count
      FROM ${messages}
      WHERE
        ${messages.orgId} = ${orgId}
        AND ${messages.role} = 'user'
        AND LENGTH(TRIM(${messages.content})) >= 5
        AND LENGTH(TRIM(${messages.content})) <= 200
      GROUP BY LOWER(TRIM(${messages.content}))
      ORDER BY count DESC
      LIMIT 50
    `,
  );

  return (result.rows as { question: string; count: number }[]).map((row) => ({
    question: row.question.charAt(0).toUpperCase() + row.question.slice(1),
    count: row.count,
  }));
}

// ── Channel breakdown — conversations per delivery channel ──
// No timezone needed — not time-windowed
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

// ── Response time trend — daily avg over last 30 days in owner's local timezone ──
// CTE pre-computes local_day once — avoids GROUP BY parameter mismatch
export async function getResponseTimeTrend(
  orgId: string,
  timezone: string,
): Promise<{ date: string; avgMs: number }[]> {
  const result = await db.execute<{ date: string; avg_ms: number }>(
    sql`
      WITH local_msgs AS (
        SELECT
          DATE_TRUNC('day', timezone(${timezone}, created_at AT TIME ZONE 'UTC')) AS local_day,
          response_time_ms
        FROM messages
        WHERE
          org_id = ${orgId}
          AND role = 'assistant'
          AND response_time_ms IS NOT NULL
      )
      SELECT
        TO_CHAR(local_day, 'DD/MM') AS date,
        AVG(response_time_ms)::float AS avg_ms
      FROM local_msgs
      WHERE local_day >= DATE_TRUNC('day', timezone(${timezone}, now()))
        - INTERVAL '29 days'
        AND local_day <= DATE_TRUNC('day', timezone(${timezone}, now()))
      GROUP BY local_day
      ORDER BY local_day ASC
    `,
  );

  return (result.rows as { date: string; avg_ms: number }[]).map((row) => ({
    date: row.date,
    avgMs: Math.round(row.avg_ms),
  }));
}
