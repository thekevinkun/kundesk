// Dashboard overview — placeholder for Phase 5
// Stat cards and charts will be built in Phase 5
// This page confirms the layout shell is working correctly

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-organization");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-(--color-text-900)">
          Dashboard
        </h1>
        <p className="text-sm text-(--color-text-500) mt-1">
          Selamat datang kembali 👋
        </p>
      </div>

      {/* Placeholder grid — replaced with real stat cards in Phase 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-(--color-bg-card) border border-(--color-border) rounded-[14px] p-5 h-[100px] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
