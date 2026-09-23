import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { KnowledgePage } from "@/components/dashboard";
import {
  getBusinessProfileForEdit,
  getKnowledgeSectionsWithEntries,
  getOrgPlan,
} from "@/lib/db/queries/knowledge";
import type { PlanName } from "@/types/billing";
import type { KnowledgeSectionRow } from "@/types/knowledge";

export const metadata: Metadata = {
  title: "Info Bisnis",
};

const EMPTY_PROFILE = {
  about: null,
  address: null,
  contacts: [],
  hours: [],
  paymentMethods: [],
};

const EMPTY_SECTIONS: KnowledgeSectionRow[] = [];
const DEFAULT_PLAN: PlanName = "free";

export default async function KnowledgeRoute() {
  const { orgId, orgRole } = await auth();
  const isAdmin = orgRole === "org:admin";

  // orgId is guaranteed by proxy.ts's dashboard guard, but fetch defensively
  const [initialProfile, initialSections, plan] = orgId
    ? await Promise.all([
        getBusinessProfileForEdit(orgId),
        getKnowledgeSectionsWithEntries(orgId),
        getOrgPlan(orgId),
      ])
    : ([EMPTY_PROFILE, EMPTY_SECTIONS, DEFAULT_PLAN] as const);

  return (
    <KnowledgePage
      isAdmin={isAdmin}
      initialProfile={initialProfile}
      initialSections={initialSections}
      plan={plan}
    />
  );
}
