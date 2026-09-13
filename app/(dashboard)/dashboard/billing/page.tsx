import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { requireOrg } from "@/lib/auth";
import { getBillingData } from "@/lib/db/queries/billing";
import { BillingPage, AccessRestricted } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Billing",
};

// Next.js 16 — searchParams is async, like params
interface BillingPageRouteProps {
  searchParams: Promise<{ transaction_status?: string; order_id?: string }>;
}

export default async function BillingPageRoute({
  searchParams,
}: BillingPageRouteProps) {
  const { orgId } = await requireOrg();

  // Billing is admin-only (Phase 16 decision) — render in place, no redirect,
  // so a member landing here via direct URL/bookmark sees a calm explanation
  const { orgRole } = await auth();
  if (orgRole !== "org:admin") {
    return <AccessRestricted featureName="Billing" />;
  }

  const billingData = await getBillingData(orgId);
  // Read Midtrans redirect params — present only right after returning
  // from the Snap payment page (callbacks.finish/pending/error)
  const params = await searchParams;
  const transactionStatus = params.transaction_status ?? null;

  return (
    <BillingPage data={billingData} transactionStatus={transactionStatus} />
  );
}
