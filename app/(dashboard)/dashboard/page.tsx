import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getTotalMessages,
  getAnsweredRate,
  getUniqueVisitors,
  getDailyMessageTrend,
  getMonthlyMessageComparison,
  getWeeklyMessages,
  getBotStatus,
  getOrgData,
  getAvgResponseTime,
  getRecentActiveConversations,
} from "@/lib/db/queries/dashboard";
import { getOwnerTimezone } from "@/lib/timezone";
import { DashboardOverview } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Force dynamic rendering — dashboard data changes frequently
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { orgId } = await auth();

  // Owner's timezone — used for all time-grouped queries to show local times in charts
  const timezone = await getOwnerTimezone();

  const [
    organization,
    dailyTrend,
    monthlyComparison,
    weeklyMessages,
    botStatus,
    orgData,
    initialTotalMessages,
    initialAnsweredRate,
    initialUniqueVisitors,
    initialAvgResponseTime,
    recentConversations,
  ] = await Promise.all([
    (await clerkClient()).organizations.getOrganization({
      organizationId: orgId!,
    }),
    getDailyMessageTrend(orgId!, timezone),
    getMonthlyMessageComparison(orgId!, timezone),
    getWeeklyMessages(orgId!, timezone),
    getBotStatus(orgId!),
    getOrgData(orgId!),
    getTotalMessages(orgId!),
    getAnsweredRate(orgId!),
    getUniqueVisitors(orgId!),
    getAvgResponseTime(orgId!),
    getRecentActiveConversations(orgId!),
  ]);

  // Derive current year in owner's local timezone — not server UTC
  const currentYear = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone }),
  ).getFullYear();

  return (
    <DashboardOverview
      orgId={orgId!}
      initialStats={{
        totalMessages: initialTotalMessages,
        answeredRate: initialAnsweredRate,
        uniqueVisitors: initialUniqueVisitors,
        avgResponseTime: initialAvgResponseTime,
      }}
      orgName={organization.name}
      dailyTrend={dailyTrend}
      monthlyCurrent={monthlyComparison.current}
      monthlyPrevious={monthlyComparison.previous}
      weeklyMessages={weeklyMessages}
      currentYear={currentYear}
      botStatus={botStatus}
      orgSlug={orgData?.slug ?? ""}
      initialMessagesUsed={orgData?.messagesUsed ?? 0}
      initialMessagesLimit={orgData?.messagesLimit ?? 100}
      initialRecentConversations={recentConversations}
    />
  );
}
