// Server Actions for billing — called directly from BillingPage client component
// requireOrg() at the top of every action — never skip this
// Zod validates all input before touching DB or external APIs

"use server";

import { z } from "zod/v4";
import { requireOrg } from "@/lib/auth";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import { cancelSubscription } from "@/lib/db/queries/billing";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { processedWebhooks } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";
import type { PlanName } from "@/types/billing";

// ── Input schema ──
const upgradeSchema = z.object({
  // Only paid plans can be selected — free has no payment flow
  plan: z.enum(["starter", "pro"]),
});

// Return type for createPayment — consistent shape for useActionState
type BillingActionResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string };

// Creates a Midtrans transaction for the selected plan
// Returns a redirectUrl — client redirects to Midtrans payment page
export async function createPayment(
  _prev: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  // Always authenticate first — orgId comes from session, never from client
  const { orgId } = await requireOrg();

  // Validate the selected plan
  const result = upgradeSchema.safeParse({ plan: formData.get("plan") });
  if (!result.success) {
    return { success: false, error: "Invalid plan selected." };
  }

  const { plan } = result.data;

  // ── Idempotency check — one active unpaid transaction per org per plan per day ──
  // Prevents duplicate Midtrans transactions on rapid re-submits or double-clicks
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Idempotency key format: PAYMENT-{orgId}-{plan}-{YYYY-MM-DD}
  const today = todayStart.toISOString().slice(0, 10);
  const idempotencyKey = `PAYMENT-${orgId}-${plan}-${today}`;

  const [existingAttempt] = await db
    .select({ id: processedWebhooks.id })
    .from(processedWebhooks)
    .where(
      and(
        eq(processedWebhooks.source, "midtrans"),
        eq(processedWebhooks.externalId, idempotencyKey),
        // Only block within the same calendar day — next day allows a fresh attempt
        gte(processedWebhooks.processedAt, todayStart),
      ),
    );

  if (existingAttempt) {
    // Transaction already created today — this is a re-submit, not a new intent
    // Return an error prompting them to check their payment or wait until tomorrow
    return {
      success: false,
      error:
        "Transaksi untuk plan ini sudah dibuat hari ini. Selesaikan pembayaran sebelumnya atau coba lagi besok.",
    };
  }

  // Get the customer's email from Clerk — passed to Midtrans for their records
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "noemail@kundesk.app";

  try {
    const { redirectUrl } = await createSubscriptionTransaction(
      orgId,
      plan as PlanName,
      email,
    );

    // ── Record the attempt after successful transaction creation ──
    // Subsequent re-submits today will hit the idempotency check above
    await db.insert(processedWebhooks).values({
      externalId: idempotencyKey,
      source: "midtrans",
    });

    revalidatePath("/dashboard/billing");

    return { success: true, redirectUrl };
  } catch (err) {
    console.error("[createPayment] Midtrans error:", err);
    return {
      success: false,
      error: "Gagal membuat transaksi. Coba lagi dalam beberapa saat.",
    };
  }
}

// Cancels the current subscription — sets status to "cancelled"
export async function cancelSubscriptionAction(
  _prev: { success: boolean; error?: string } | null,
  _formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const { orgId } = await requireOrg();

  try {
    await cancelSubscription(orgId);

    // Revalidate so sidebar badge and billing page both update
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/billing");

    return { success: true };
  } catch (err) {
    console.error("[cancelSubscriptionAction] DB error:", err);
    return {
      success: false,
      error: "Gagal membatalkan langganan. Coba lagi.",
    };
  }
}
