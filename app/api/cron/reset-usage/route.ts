// Monthly cron job — resets messagesUsed to 0 for all orgs
// Vercel calls this on the 1st of every month at 00:00 UTC
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header ──
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.cronSecret}`;

  if (authHeader !== expected) {
    console.warn("[cron/reset-usage] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Count orgs first — single aggregation query, no rows loaded into memory
    const countResult = await db.select({ total: count() }).from(orgs);
    const total = countResult[0]?.total ?? 0;

    if (total === 0) {
      console.log("[cron/reset-usage] No orgs found");
      return NextResponse.json({ message: "No orgs found", reset: 0 });
    }

    // Bulk reset — single UPDATE with no WHERE clause resets all orgs at once
    // Applies to all plans including free — consistent behavior, no exceptions
    await db.update(orgs).set({ messagesUsed: 0 });

    console.log(`[cron/reset-usage] Reset messagesUsed for ${total} org(s)`);

    return NextResponse.json({
      message: "Usage reset complete",
      reset: total,
    });
  } catch (error) {
    console.error("[cron/reset-usage] Failed to reset usage", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
