import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { ConversationsPage } from "@/components/dashboard";
import { getRecentConversations } from "@/lib/db/queries/dashboard";

export const metadata: Metadata = {
  title: "Percakapan",
};

export default async function ConversationsRoute() {
  const { orgId } = await auth();

  const conversations = await getRecentConversations(orgId!);

  return <ConversationsPage conversations={conversations} />;
}
