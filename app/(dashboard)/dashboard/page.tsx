import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getLiveOverviewSnapshot,
  getRecentActiveConversations,
  getLiveConversationPreview,
  getDashboardCharts,
  getRecentKnowledgeItems,
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
  const timezone = await getOwnerTimezone();

  const [
    organization,
    initialLiveOverview,
    recentConversations,
    liveConversationPreview,
    initialDashboardCharts,
    initialKnowledgeItems,
  ] = await Promise.all([
    (await clerkClient()).organizations.getOrganization({
      organizationId: orgId!,
    }),
    getLiveOverviewSnapshot(orgId!, timezone),
    getRecentActiveConversations(orgId!),
    getLiveConversationPreview(orgId!),
    getDashboardCharts(orgId!, timezone),
    getRecentKnowledgeItems(orgId!),
  ]);

  return (
    <DashboardOverview
      orgId={orgId!}
      initialLiveOverview={initialLiveOverview}
      orgName={organization.name}
      orgImageUrl={organization.imageUrl ?? null}
      initialRecentConversations={recentConversations}
      initialLiveConversationPreview={liveConversationPreview}
      initialDashboardCharts={initialDashboardCharts}
      initialKnowledgeItems={initialKnowledgeItems}
    />
  );
}
