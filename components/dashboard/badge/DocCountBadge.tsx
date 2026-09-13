"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { getDocumentCount } from "@/lib/actions/chatbot";
import { cn } from "@/lib/utils";

const DocCountBadge = () => {
  // Reactive active-org id — re-renders this component on org switch,
  // unlike window.Clerk?.organization?.id which doesn't trigger React updates
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const { data: count } = useQuery({
    // orgId in the key is the actual fix — without it, switching orgs kept
    // serving the previous org's cached count instead of fetching a fresh one
    queryKey: ["documents", "count", orgId],
    queryFn: () => getDocumentCount(),
    // Only run once we actually know which org is active — avoids a request
    // firing with a stale/undefined org context during the switch itself
    enabled: !!orgId,
    // Safe to keep now that orgId is part of the key — this only holds over
    // the previous count within the SAME org while a background refetch
    // happens, never bleeds across orgs anymore since the key itself changes
    placeholderData: (prev) => prev,
  });

  // Don't render badge at all while count is unknown — avoids "0" flash
  if (count === undefined) return null;

  return (
    <span
      className={cn(
        "text-[10.5px] font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1.5",
        "bg-(--color-bg-page) text-(--color-text-400) border border-(--color-border)",
      )}
      aria-label={`${count} dokumen`}
    >
      {count}
    </span>
  );
};

export default DocCountBadge;
