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

  // All queries in parallel — no query waits for another
  const [
    totalConversations,
    handoffRate,
    resolutionRate,
    avgResponseTime,
    handoffTrend,
    aiVsHandoff,
    peakHours,
    topQuestions,
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
    getTopQuestions(orgId),
    getChannelBreakdown(orgId),
    getResponseTimeTrend(orgId),
    getDailyMessageTrend(orgId),
  ]);

  // Cluster raw questions into semantic topics — AI groups similar questions together
  // Falls back to mock grouping when KUNDESK_AI_MODE=mock
  const clusteredQuestions = await clusterTopQuestions(topQuestions);

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
