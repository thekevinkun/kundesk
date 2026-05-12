// Midtrans payment notification handler
// Midtrans POSTs here after every payment event — settlement, pending, expire, etc.
// This handler is the ONLY place that advances the subscription state machine
// Security: signature verification + idempotency check + fraud check

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processedWebhooks } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { orgs } from "@/lib/db/schema";
import { verifyMidtransSignature } from "@/lib/midtrans";
import { activateSubscription } from "@/lib/db/queries/billing";
import type { MidtransNotification, PlanName } from "@/types/billing";

// Midtrans sends POST — no auth header, verified via signature instead
export async function POST(req: NextRequest): Promise<NextResponse> {
  let notification: MidtransNotification;

  // Parse notification body — malformed JSON returns 400
  try {
    notification = (await req.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Layer 1: Signature verification ──
  // SHA512(order_id + status_code + gross_amount + server_key)
  // Reject immediately if mismatch — don't process anything
  const signatureValid = verifyMidtransSignature(notification);
  if (!signatureValid) {
    console.warn("[midtrans webhook] Invalid signature — rejected", {
      order_id: notification.order_id,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { order_id, transaction_status, fraud_status, payment_type } =
    notification;

  // ── Layer 2: Idempotency check ──
  // Midtrans retries notifications — processedWebhooks prevents double-processing
  const [alreadyProcessed] = await db
    .select({ id: processedWebhooks.id })
    .from(processedWebhooks)
    .where(
      and(
        eq(processedWebhooks.source, "midtrans"),
        eq(processedWebhooks.externalId, order_id),
      ),
    );

  if (alreadyProcessed) {
    // Return 200 — Midtrans stops retrying on 2xx
    console.log("[midtrans webhook] Already processed — skipping", {
      order_id,
    });
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  // ── Layer 3: Transaction status check ──
  // "settlement" = bank transfer/e-wallet paid
  // "capture" = credit card authorized and captured
  // Everything else (pending, expire, cancel) — no action needed
  const isSettled =
    transaction_status === "settlement" || transaction_status === "capture";

  if (!isSettled) {
    console.log("[midtrans webhook] Non-settlement status — no action", {
      order_id,
      transaction_status,
    });
    return NextResponse.json(
      { message: "No action required" },
      { status: 200 },
    );
  }

  // ── Layer 4: Fraud check ──
  // "challenge" or "deny" = flagged by Midtrans fraud detection
  // Do NOT activate — mark as processed to stop retries, log for manual review
  const isFraudulent = fraud_status === "challenge" || fraud_status === "deny";

  if (isFraudulent) {
    console.error("[midtrans webhook] FRAUD FLAG — manual review required", {
      order_id,
      fraud_status,
    });
    // Mark processed so Midtrans stops retrying
    await db.insert(processedWebhooks).values({
      externalId: order_id,
      source: "midtrans",
    });
    return NextResponse.json(
      { message: "Flagged for review" },
      { status: 200 },
    );
  }

  // ── Layer 5: Parse order_id ──
  // Format: KUNDESK-{orgId.slice(0,8)}-{PLAN}-{timestamp}
  // Example: KUNDESK-org_3DZH-STARTER-1234567890
  const parts = order_id.split("-");

  // Need at least 4 parts: KUNDESK, orgSlice, PLAN, timestamp
  if (parts.length < 4) {
    console.error("[midtrans webhook] Malformed order_id", { order_id });
    return NextResponse.json({ error: "Malformed order_id" }, { status: 400 });
  }

  // TypeScript doesn't narrow array access — assert after length check
  const orgIdSlice = parts[1] as string;
  const planRaw = (parts[2] as string).toLowerCase();

  if (planRaw !== "starter" && planRaw !== "pro") {
    console.error("[midtrans webhook] Unknown plan in order_id", {
      order_id,
      planRaw,
    });
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const plan = planRaw as PlanName;

  // ── Layer 6: Look up org by id prefix ──
  // orgId slice is first 8 chars of Clerk orgId — e.g. "org_3DZH"
  // Using raw SQL LEFT() — Drizzle has no built-in substring on columns
  const matchingOrgs = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(sql`LEFT(${orgs.id}, 8) = ${orgIdSlice}`);

  if (matchingOrgs.length !== 1) {
    console.error("[midtrans webhook] Org not found for order_id", {
      order_id,
      orgIdSlice,
      matches: matchingOrgs.length,
    });
    return NextResponse.json(
      { error: "Org resolution ambiguous" },
      { status: 200 },
    );
  }

  const org = matchingOrgs[0]!;

  // ── Layer 7: Activate subscription ──
  await activateSubscription(org.id, plan, payment_type, order_id);

  // ── Layer 8: Mark as processed ──
  // Insert AFTER activating — if activation throws, we haven't marked it done
  // On retry: activation runs again — activateSubscription is idempotent (SET, not INSERT)
  await db.insert(processedWebhooks).values({
    externalId: order_id,
    source: "midtrans",
  });

  console.log("[midtrans webhook] Subscription activated", {
    orgId: org.id,
    plan,
    order_id,
  });

  return NextResponse.json({ message: "OK" }, { status: 200 });
}
