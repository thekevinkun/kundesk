import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { KnowledgePage } from "@/components/dashboard";
import { getBusinessProfileForEdit } from "@/lib/db/queries/knowledge";

export const metadata: Metadata = {
  title: "Info Bisnis",
};

export default async function KnowledgeRoute() {
  const { orgId, orgRole } = await auth();
  const isAdmin = orgRole === "org:admin";

  // orgId is guaranteed by proxy.ts's dashboard guard, but fetch defensively
  // rather than asserting non-null across the query boundary
  const initialProfile = orgId
    ? await getBusinessProfileForEdit(orgId)
    : {
        about: null,
        address: null,
        contacts: [],
        hours: [],
        paymentMethods: [],
      };

  return <KnowledgePage isAdmin={isAdmin} initialProfile={initialProfile} />;
}
