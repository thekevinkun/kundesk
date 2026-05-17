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
} from "@/lib/db/queries/dashboard";
import { DashboardOverview } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { orgId } = await auth();

  // All queries in parallel — 8 round trips become 1 wait
  const [
    organization,
    totalMessages,
    answeredRate,
    uniqueVisitors,
    dailyTrend,
    monthlyComparison,
    weeklyMessages,
    botStatus,
    orgData,
    avgResponseTime,
  ] = await Promise.all([
    (await clerkClient()).organizations.getOrganization({
      organizationId: orgId!,
    }),
    getTotalMessages(orgId!),
    getAnsweredRate(orgId!),
    getUniqueVisitors(orgId!),
    getDailyMessageTrend(orgId!),
    getMonthlyMessageComparison(orgId!),
    getWeeklyMessages(orgId!),
    getBotStatus(orgId!),
    getOrgData(orgId!),
    getAvgResponseTime(orgId!),
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <DashboardOverview
      totalMessages={totalMessages}
      answeredRate={answeredRate}
      uniqueVisitors={uniqueVisitors}
      orgName={organization.name}
      dailyTrend={dailyTrend}
      monthlyCurrent={monthlyComparison.current}
      monthlyPrevious={monthlyComparison.previous}
      weeklyMessages={weeklyMessages}
      currentYear={currentYear}
      botStatus={botStatus}
      orgSlug={orgData?.slug ?? ""}
      messagesUsed={orgData?.messagesUsed ?? 0}
      messagesLimit={orgData?.messagesLimit ?? 100}
      avgResponseTime={avgResponseTime}
    />
  );
}
