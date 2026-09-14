import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { AnalyticsPage, AccessRestricted } from "@/components/dashboard";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { PLAN_LIMITS, type PlanName } from "@/types/billing";
import {
  getTotalConversations,
  getHandoffRate,
  getAiResolutionRate,
  getAnalyticsAvgResponseTime,
  getHandoffTrend,
  getAiVsHandoffSplit,
  getPeakHours,
  getTopQuestions,
  getChannelBreakdown,
  getResponseTimeTrend,
} from "@/lib/db/queries/analytics";
import { getOwnerTimezone } from "@/lib/timezone";
import { clusterTopQuestions } from "@/lib/ai/cluster";
import { getDailyMessageTrend } from "@/lib/db/queries/dashboard";

export const metadata: Metadata = {
  title: "Analytics",
};

// Force dynamic rendering — dashboard data changes frequently
export const dynamic = "force-dynamic";

export default async function AnalyticsRoute() {
  // requireOrg — throws if no session, caught by dashboard layout error boundary
  const { orgId } = await requireOrg();

  // Analytics is admin-only (Phase 16 decision) — check before running any of
  // the queries below, so a member hitting this URL costs zero DB round-trips
  const { orgRole } = await auth();

  if (orgRole !== "org:admin") {
    return <AccessRestricted featureName="Analytics" />;
  }

  // Plan gate — Free doesn't lose the page entirely, just 3 specific cards
  // (Handoff insight, Top Questions, Peak Hours). Starter/Pro see everything.
  const [orgRow] = await db
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  const plan = (orgRow?.plan as PlanName) ?? "free";
  const hasFullAnalytics = PLAN_LIMITS[plan].analytics;

  // Skip AI clustering entirely when locked — no reason to spend OpenAI cost
  // producing a result the person won't see unblurred anyway
  const clusteredQuestionsPromise = hasFullAnalytics
    ? getTopQuestions(orgId).then((rows) => clusterTopQuestions(rows))
    : Promise.resolve([]);

  // Owner's timezone — used for all time-grouped queries to show local times in charts
  const timezone = await getOwnerTimezone();

  // All queries in parallel — no query waits for another
  const [
    totalConversations,
    handoffRate,
    resolutionRate,
    avgResponseTime,
    handoffTrend,
    aiVsHandoff,
    peakHours,
    clusteredQuestions,
    channelBreakdown,
    responseTrend,
    dailyTrend,
  ] = await Promise.all([
    getTotalConversations(orgId),
    getHandoffRate(orgId),
    getAiResolutionRate(orgId),
    getAnalyticsAvgResponseTime(orgId),
    getHandoffTrend(orgId, timezone),
    getAiVsHandoffSplit(orgId),
    getPeakHours(orgId, timezone),
    clusteredQuestionsPromise,
    getChannelBreakdown(orgId),
    getResponseTimeTrend(orgId, timezone),
    getDailyMessageTrend(orgId, timezone),
  ]);

  return (
    <AnalyticsPage
      totalConversations={totalConversations}
      resolutionRate={resolutionRate}
      handoffRate={handoffRate}
      avgResponseTime={avgResponseTime}
      aiCount={aiVsHandoff.aiCount}
      handoffCount={aiVsHandoff.handoffCount}
      handoffTrend={handoffTrend}
      topQuestions={clusteredQuestions}
      channelBreakdown={channelBreakdown}
      peakHours={peakHours}
      dailyTrend={dailyTrend}
      responseTrend={responseTrend}
      isAnalyticsLocked={!hasFullAnalytics}
    />
  );
}
