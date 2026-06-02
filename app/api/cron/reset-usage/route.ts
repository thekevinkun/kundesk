// Monthly cron job — resets messagesUsed to 0 for all orgs
// Vercel calls this on the 1st of every month at 00:00 UTC
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { count, ne } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { createNotification } from "@/lib/db/queries/dashboard";

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

    // Fetch all org IDs — needed to create per-org notifications after reset
    // Only non-cancelled orgs — cancelled orgs don't need reset notifications
    const activeOrgs = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(ne(orgs.subscriptionStatus, "cancelled"));

    // Bulk reset — single UPDATE resets all orgs at once
    await db.update(orgs).set({ messagesUsed: 0 });

    console.log(`[cron/reset-usage] Reset messagesUsed for ${total} org(s)`);

    // Notify each org — fire in background, don't block cron response
    // createNotification also fires Pusher so open dashboards update live
    Promise.all(
      activeOrgs.map((org) =>
        createNotification(
          org.id,
          "quota_reset",
          "Kuota pesan direset",
          "Kuota bulan baru siap digunakan",
        ).catch(console.error),
      ),
    ).catch(console.error);

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
