"use server";

// Dashboard stat server action — called by TanStack Query on the client
// Same queries as page.tsx but wrapped in a server action for client-side refetch
// requireOrg() enforces auth — never called without a valid session

import { requireOrg } from "@/lib/auth";
import {
  getTotalMessages,
  getAnsweredRate,
  getUniqueVisitors,
  getAvgResponseTime,
} from "@/lib/db/queries/dashboard";

export interface DashboardStats {
  totalMessages: number;
  answeredRate: number;
  uniqueVisitors: number;
  avgResponseTime: string | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Auth enforced here — orgId comes from server session, never from client
  const { orgId } = await requireOrg();

  // All four in parallel — same pattern as page.tsx
  const [totalMessages, answeredRate, uniqueVisitors, avgResponseTime] =
    await Promise.all([
      getTotalMessages(orgId),
      getAnsweredRate(orgId),
      getUniqueVisitors(orgId),
      getAvgResponseTime(orgId),
    ]);

  return { totalMessages, answeredRate, uniqueVisitors, avgResponseTime };
}
