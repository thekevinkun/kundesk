// Monthly cron job — resets messagesUsed to 0 for all active orgs
// Vercel calls this on the 1st of every month at 00:00 UTC
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header ──
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.cronSecret}`;

  if (authHeader !== expected) {
    console.warn("[cron/reset-usage] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all org IDs that should have usage reset
  // Reset applies to: active, past_due, suspended — not free or cancelled
  // Free orgs have a fixed 100 limit that resets here too — consistent behavior
  const allOrgs = await db.select({ id: orgs.id }).from(orgs);

  if (allOrgs.length === 0) {
    console.log("[cron/reset-usage] No orgs found");
    return NextResponse.json({ message: "No orgs found", reset: 0 });
  }

  await db.update(orgs).set({ messagesUsed: 0 });

  console.log(
    `[cron/reset-usage] Reset messagesUsed for ${allOrgs.length} org(s)`,
  );

  return NextResponse.json({
    message: "Usage reset complete",
    reset: allOrgs.length,
  });
}
