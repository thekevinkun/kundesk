// Dashboard layout — wraps all protected dashboard routes
// Sidebar + topbar shell. Clerk org guard lives here.
// Mobile: sidebar becomes Sheet drawer. Desktop: fixed sidebar.

import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardSidebar, DashboardTopbar } from "@/components/dashboard";

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
    <div className="min-h-screen bg-(--color-bg-page) flex">
      {/* Sidebar — hidden on mobile, fixed on desktop */}
      <DashboardSidebar />

      {/* Main area — offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[230px]">
        {/* Topbar — sticky at top */}
        <DashboardTopbar />

        {/* Page content — each dashboard route renders here */}
        <main className="flex-1 p-4 md:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
