// Daily cron — detects knowledge entries/sections whose chunks silently went missing
// Report-only: never repairs anything. Findings go to Sentry as ONE grouped issue.
// Protected by CRON_SECRET header — rejects all other callers

import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  findSectionsMissingSummary,
  findSyncedEntriesMissingChunks,
} from "@/lib/db/queries/knowledge-health";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: verify cron secret header (same pattern as retention) ──
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    console.warn("[cron/knowledge-health] Unauthorized request rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Independent read-only queries — run together
    const [summaryGaps, entryGaps] = await Promise.all([
      findSectionsMissingSummary(),
      findSyncedEntriesMissingChunks(),
    ]);

    const total = summaryGaps.length + entryGaps.length;

    if (total > 0) {
      // Fixed message string → Sentry groups every day's alert into one issue
      Sentry.captureMessage("knowledge-health: missing chunks detected", {
        level: "error",
        extra: { summaryGaps, entryGaps },
      });
      console.error(
        `[cron/knowledge-health] ${summaryGaps.length} section(s) missing summary, ${entryGaps.length} entry(ies) missing chunks`,
      );
    }

    return NextResponse.json({
      message: "Knowledge health check complete",
      summaryGaps: summaryGaps.length,
      entryGaps: entryGaps.length,
    });
  } catch (err) {
    // A failing check must be visible too — otherwise "no alerts" could mean "check is broken"
    console.error("[cron/knowledge-health] Failed:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
