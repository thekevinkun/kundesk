import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { ConversationsPage } from "@/components/dashboard";
import { getPaginatedConversations } from "@/lib/db/queries/dashboard";

export const metadata: Metadata = {
  title: "Percakapan",
};

// searchParams are async in Next.js 16
type Props = {
  searchParams: Promise<{ page?: string; highlight?: string }>;
};

export default async function ConversationsRoute({ searchParams }: Props) {
  const { orgId } = await auth();
  const { page: pageParam, highlight } = await searchParams;

  // Parse page — clamp to 1 minimum, invalid values default to 1
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { rows, total, totalPages } = await getPaginatedConversations(
    orgId!,
    page,
  );

  return (
    <ConversationsPage
      conversations={rows}
      total={total}
      page={page}
      totalPages={totalPages}
      // Pass highlight so the right row auto-opens even after page navigation
      highlightId={highlight ? Number(highlight) : null}
    />
  );
}
