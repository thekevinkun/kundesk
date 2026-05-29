import type { Metadata } from "next";
import { AnalyticsPage } from "@/components/dashboard";
import { requireOrg } from "@/lib/auth";
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
  const clusteredQuestionsPromise = getTopQuestions(orgId).then((rows) =>
    clusterTopQuestions(rows),
  );

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
    />
  );
}
