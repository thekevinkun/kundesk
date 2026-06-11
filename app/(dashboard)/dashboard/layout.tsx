import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Toaster } from "sonner";

import { Sidebar, Topbar } from "@/components/dashboard";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { PusherProvider } from "@/components/providers/pusher-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { AccentColorProvider } from "@/components/providers/accent-color-provider";

import { getBotStatus } from "@/lib/db/queries/dashboard";
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

  // Fetch accent color at layout level — passed to AccentColorProvider and Topbar as prop
  let accentColor = "#069494";
  try {
    const botStatus = await getBotStatus(orgId);
    accentColor = botStatus?.accentColor ?? "#069494";
  } catch (err) {
    console.error("[dashboard/layout] Failed to fetch accent color:", err);
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryProvider>
        <PostHogProvider orgId={orgId}>
          <AccentColorProvider accentColor={accentColor} />

          <PusherProvider orgId={orgId} />

          {/* Skip link — keyboard users jump past sidebar directly to main content */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
            focus:z-[9999] focus:px-4 focus:py-2 focus:bg-(--color-brand) 
            focus:text-white focus:rounded-[10px] focus:font-semibold focus:text-sm"
          >
            Lewati navigasi
          </a>

          <div className="min-h-screen bg-(--color-bg-page) flex">
            {/* Pass subscriptionStatus so Sidebar can show billing warning badge */}
            <Sidebar subscriptionStatus={subscriptionStatus} />

            <div className="flex-1 flex flex-col min-h-screen lg:ml-[230px]">
              <Topbar initialAccentColor={accentColor} />

              <main id="main-content" className="flex-1 p-4 md:p-6 lg:p-7">
                {children}
              </main>
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
        </PostHogProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
