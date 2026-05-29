// Server Actions for billing — called directly from BillingPage client component
// requireOrg() at the top of every action — never skip this
// Zod validates all input before touching DB or external APIs

"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod/v4";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { processedWebhooks, orgs } from "@/lib/db/schema";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import {
  cancelSubscription,
  validatePromoCode,
} from "@/lib/db/queries/billing";
import type { PlanName } from "@/types/billing";
import { PLAN_PRICE, PLAN_FIRST_TIME_PRICE } from "@/types/billing";

// ── Input schema ──
const upgradeSchema = z.object({
  // Only paid plans can be selected — free has no payment flow
  plan: z.enum(["starter", "pro"]),
  // Optional promo code — validated server-side, never trusted from client
  promoCode: z.string().trim().max(50).optional(),
});

// Return type for createPayment — consistent shape for useActionState
type BillingActionResult =
  | { success: true; redirectUrl: string; finalAmount: number }
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
  const rawPromoCode = formData.get("promoCode");
  const result = upgradeSchema.safeParse({
    plan: formData.get("plan"),
    promoCode: typeof rawPromoCode === "string" ? rawPromoCode : undefined,
  });

  if (!result.success) {
    return { success: false, error: "Invalid plan selected." };
  }

  const { plan, promoCode } = result.data;

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

  // Fetch org data and customer email in parallel — both needed before Midtrans call
  const [user, org] = await Promise.all([
    currentUser(),
    db
      .select({
        hasUsedFirstPurchase: orgs.hasUsedFirstPurchase,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .then((rows) => rows[0] ?? null),
  ]);

  if (!org) return { success: false, error: "Organisasi tidak ditemukan." };

  const email = user?.emailAddresses[0]?.emailAddress ?? "noemail@kundesk.app";

  // ── Discount logic ──
  // Priority: promo code > first-time discount. No stacking.
  let finalAmount = PLAN_PRICE[plan];
  let appliedPromoId: number | null = null;

  if (promoCode) {
    // Validate promo code server-side — never trust client price
    const promo = await validatePromoCode(promoCode, plan);
    if (!promo) {
      return {
        success: false,
        error:
          "Kode promo tidak valid, sudah habis, atau tidak berlaku untuk plan ini.",
      };
    }
    // Apply percentage discount — floor to avoid fractional Rupiah
    finalAmount = Math.floor(
      PLAN_PRICE[plan] * (1 - promo.discountPercent / 100),
    );
    appliedPromoId = promo.id;
  } else if (!org.hasUsedFirstPurchase) {
    // No promo code — apply first-time discount if still eligible
    finalAmount = PLAN_FIRST_TIME_PRICE[plan];
  }

  try {
    // ── Record the attempt BEFORE calling Midtrans ──
    // Prevents duplicate transactions on concurrent requests (double-click, rapid resubmit)
    // Consistent with cron renewal pattern — insert before external call, not after
    // Tradeoff: a transient Midtrans failure blocks the user for the day — acceptable
    // because Midtrans Sandbox + production are reliable, and the error message is clear
    await db.insert(processedWebhooks).values({
      externalId: idempotencyKey,
      source: "midtrans",
    });

    const { redirectUrl } = await createSubscriptionTransaction(
      orgId,
      plan as PlanName,
      email,
      finalAmount,
      appliedPromoId ?? undefined,
    );

    revalidatePath("/dashboard/billing");

    return { success: true, redirectUrl, finalAmount };
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
