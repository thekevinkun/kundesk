import type { Metadata } from "next";
import { requireOrg } from "@/lib/auth";
import { getBillingData } from "@/lib/db/queries/billing";
import { BillingPage } from "@/components/dashboard";

export const metadata: Metadata = {
  // Root layout template appends " | Kundesk" automatically
  title: "Billing",
};

export default async function BillingPageRoute() {
  // requireOrg() — always first, orgId comes from session never from URL
  const { orgId } = await requireOrg();

  // Fetch all billing data in one query — no Promise.all needed, single source
  const billingData = await getBillingData(orgId);

  return <BillingPage data={billingData} />;
}
