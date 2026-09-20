// Daily cron job — deletes messages older than 90 days across all orgs
// Also closes stale pending payments (housekeeping) — see expireStalePayments
// Reduces PII exposure — customers may type phone numbers or names in chat
// Vercel calls this every day at 20:00 UTC (03:00 WIB)
// Protected by CRON_SECRET header — rejects all other callers

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { deleteOldMessages } from "@/lib/db/queries/dashboard";
import { expireStalePayments } from "@/lib/db/queries/billing";

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

  // ── Housekeeping: close payment rows whose 24h Snap link has passed ──
  // Own try/catch: a failure here must never stop message retention below.
  let expiredPayments = 0;
  try {
    expiredPayments = await expireStalePayments();
    console.log(
      `[cron/retention] Expired ${expiredPayments} stale pending payment(s)`,
    );
  } catch (err) {
    console.error("[cron/retention] Failed to expire stale payments:", err);
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
      expiredPayments,
    });
  } catch (err) {
    console.error("[cron/retention] Failed:", err);
    return NextResponse.json(
      { error: "Retention job failed" },
      { status: 500 },
    );
  }
}
