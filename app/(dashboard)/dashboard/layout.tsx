import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Toaster } from "sonner";
import { Sidebar, Topbar } from "@/components/dashboard";
import { QueryProvider } from "@/components/providers/query-provider";
import { getBillingData } from "@/lib/db/queries/billing";
import type { SubscriptionStatus } from "@/types/billing";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { userId, orgId } = await auth();

  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-organization");

  // Fetch subscription status at layout level — passed to Sidebar as prop
  // Billing status changes infrequently — server fetch is correct, no polling needed
  // Fallback to "free" if billing query fails — layout must never crash over a badge
  let subscriptionStatus: SubscriptionStatus = "free";
  try {
    const billing = await getBillingData(orgId);
    subscriptionStatus = billing.subscriptionStatus;
  } catch (err) {
    console.error("[dashboard/layout] Failed to fetch billing status:", err);
  }

  return (
    <QueryProvider>
      <div className="min-h-screen bg-(--color-bg-page) flex">
        {/* Pass subscriptionStatus so Sidebar can show billing warning badge */}
        <Sidebar subscriptionStatus={subscriptionStatus} />

        <div className="flex-1 flex flex-col min-h-screen lg:ml-[230px]">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-7">{children}</main>
        </div>
      </div>
      <Toaster
        position="bottom-right"
        duration={5000}
        toastOptions={{
          style: {
            display: "flex",
            alignItems: "start",
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-card)",
            color: "var(--color-text-900)",
          },
          classNames: {
            icon: "pt-1",
          },
        }}
      />
    </QueryProvider>
  );
}
