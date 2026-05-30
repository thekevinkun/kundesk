// Daily cron job — deletes messages older than 90 days across all orgs
// Reduces PII exposure — customers may type phone numbers or names in chat
// Vercel calls this every day at 20:00 UTC (03:00 WIB)
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { deleteOldMessages } from "@/lib/db/queries/dashboard";

// Messages older than this are deleted — balances utility vs PII exposure
const RETENTION_DAYS = 90;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header ──
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${env.cronSecret}`;

  if (authHeader !== expected) {
    console.warn("[cron/retention] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(
      `[cron/retention] Deleting messages older than ${RETENTION_DAYS} days`,
    );

    const deletedCount = await deleteOldMessages(RETENTION_DAYS);

    console.log(`[cron/retention] Deleted ${deletedCount} messages`);

    return NextResponse.json({
      message: "Retention run complete",
      deletedCount,
      retentionDays: RETENTION_DAYS,
    });
  } catch (err) {
    console.error("[cron/retention] Failed:", err);
    return NextResponse.json(
      { error: "Retention job failed" },
      { status: 500 },
    );
  }
}
