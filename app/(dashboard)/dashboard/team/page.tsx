import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { TeamPage } from "@/components/dashboard";
import { getTeamMembers } from "@/lib/actions/team";

export const metadata: Metadata = {
  title: "Tim",
};

export default async function TeamRoute() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) redirect("/sign-in");

  // Fetch current user's role — needed to control admin UI on client
  const client = await clerkClient();
  const { data } = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    userId: [userId],
    limit: 1,
  });

  const currentUserRole = data[0]?.role ?? "org:member";

  // Fetch all members server-side — no loading flash on first render
  const initialMembers = await getTeamMembers();

  return (
    <TeamPage
      initialMembers={initialMembers}
      currentUserRole={currentUserRole}
    />
  );
}
