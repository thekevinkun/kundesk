// Dashboard layout — wraps all protected dashboard routes
// Sidebar + topbar shell. Clerk org guard lives here.
// Mobile: sidebar becomes Sheet drawer. Desktop: fixed sidebar.

import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Sidebar, Topbar } from "@/components/dashboard";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  // Guard — requireOrg pattern from Project Bible
  // proxy.ts handles redirect for no userId
  // Here we double-check orgId — redirect to select-organization if missing
  const { userId, orgId } = await auth();

  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-organization");

  return (
    // QueryProvider wraps everything — TanStack Query available to all dashboard pages
    <QueryProvider>
      <div className="min-h-screen bg-(--color-bg-page) flex">
        {/* Sidebar — hidden on mobile, fixed on desktop */}
        <Sidebar />

        {/* Main area — offset by sidebar width on desktop */}
        <div className="flex-1 flex flex-col min-h-screen lg:ml-[230px]">
          {/* Topbar — sticky at top */}
          <Topbar />

          {/* Page content — each dashboard route renders here */}
          <main className="flex-1 p-4 md:p-6 lg:p-7">{children}</main>
        </div>
      </div>
      {/* Sonner toast container — positioned bottom-right, matches design system */}
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
            // Targets the icon container
            icon: "pt-1",
          },
        }}
      />
    </QueryProvider>
  );
}
