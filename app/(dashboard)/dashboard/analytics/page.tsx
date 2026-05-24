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
import { clusterTopQuestions } from "@/lib/ai/cluster";
import { getDailyMessageTrend } from "@/lib/db/queries/dashboard";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsRoute() {
  // requireOrg — throws if no session, caught by dashboard layout error boundary
  const { orgId } = await requireOrg();
  const clusteredQuestionsPromise = getTopQuestions(orgId).then((rows) =>
    clusterTopQuestions(rows),
  );

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
    getHandoffTrend(orgId),
    getAiVsHandoffSplit(orgId),
    getPeakHours(orgId),
    clusteredQuestionsPromise,
    getChannelBreakdown(orgId),
    getResponseTimeTrend(orgId),
    getDailyMessageTrend(orgId),
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
