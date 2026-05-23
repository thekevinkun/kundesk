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
    dailyTrend,
    monthlyComparison,
    weeklyMessages,
    botStatus,
    orgData,
    // Stats now fetched client-side via TanStack — only initial values needed here
    initialTotalMessages,
    initialAnsweredRate,
    initialUniqueVisitors,
    initialAvgResponseTime,
  ] = await Promise.all([
    (await clerkClient()).organizations.getOrganization({
      organizationId: orgId!,
    }),
    getDailyMessageTrend(orgId!),
    getMonthlyMessageComparison(orgId!),
    getWeeklyMessages(orgId!),
    getBotStatus(orgId!),
    getOrgData(orgId!),
    getTotalMessages(orgId!),
    getAnsweredRate(orgId!),
    getUniqueVisitors(orgId!),
    getAvgResponseTime(orgId!),
  ]);

  const currentYear = new Date().getFullYear();

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
    />
  );
}
