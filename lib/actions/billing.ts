"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { env } from "@/lib/env";
import { orgs } from "@/lib/db/schema";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import { sendPaymentPendingEmail } from "@/lib/email";
import {
  cancelSubscription,
  validatePromoCode,
  getPendingPayment,
  insertPendingPayment,
  cancelPendingPayment,
} from "@/lib/db/queries/billing";
import type { PlanName } from "@/types/billing";
import { PLAN_PRICE, PLAN_FIRST_TIME_PRICE } from "@/types/billing";

// ── Input schema ──
const upgradeSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  promoCode: z.string().trim().max(50).optional(),
});

type BillingActionResult =
  | { success: true; redirectUrl: string; finalAmount: number }
  | { success: false; error: string; redirectUrl?: string };

export async function createPayment(
  _prev: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const { orgId } = await requireOrg();

  const rawPromoCode = formData.get("promoCode");
  const result = upgradeSchema.safeParse({
    plan: formData.get("plan"),
    promoCode: typeof rawPromoCode === "string" ? rawPromoCode : undefined,
  });

  if (!result.success) {
    return { success: false, error: "Invalid plan selected." };
  }

  const { plan, promoCode } = result.data;

  // ── Pending payment check — replaces the old processedWebhooks lock ──
  // If a pending payment <24h old exists, don't create a new transaction —
  // return its redirectUrl so the client can resume that payment instead
  const pending = await getPendingPayment(orgId);

  if (pending) {
    return {
      success: false,
      error:
        "Kamu masih memiliki pembayaran yang belum diselesaikan. Selesaikan pembayaran sebelumnya atau tunggu hingga link kedaluwarsa.",
      redirectUrl: pending.redirectUrl,
    };
  }

  // Fetch org data and customer email in parallel — both needed before Midtrans call
  // Widened to include name + ownerEmail — used for the pending payment email
  const [user, org] = await Promise.all([
    currentUser(),
    db
      .select({
        name: orgs.name,
        ownerEmail: orgs.ownerEmail,
        hasUsedFirstPurchase: orgs.hasUsedFirstPurchase,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .then((rows) => rows[0] ?? null),
  ]);

  if (!org) return { success: false, error: "Organisasi tidak ditemukan." };

  const email = user?.emailAddresses[0]?.emailAddress ?? "noemail@kundesk.app";

  // ── Discount logic — unchanged ──
  let finalAmount = PLAN_PRICE[plan];
  let appliedPromoId: number | null = null;

  if (promoCode) {
    const promo = await validatePromoCode(promoCode, plan);
    if (!promo) {
      return {
        success: false,
        error:
          "Kode promo tidak valid, sudah habis, atau tidak berlaku untuk plan ini.",
      };
    }
    finalAmount = Math.floor(
      PLAN_PRICE[plan] * (1 - promo.discountPercent / 100),
    );
    appliedPromoId = promo.id;
  } else if (!org.hasUsedFirstPurchase) {
    finalAmount = PLAN_FIRST_TIME_PRICE[plan];
  }

  try {
    const { redirectUrl, orderId } = await createSubscriptionTransaction(
      orgId,
      plan as PlanName,
      email,
      finalAmount,
      appliedPromoId ?? undefined,
    );

    // Record this attempt as "pending" — single source of truth for
    // same-day lock, resume banner, and payment history
    await insertPendingPayment(orgId, orderId, plan, finalAmount, redirectUrl);

    // Fire-and-forget — email failure shouldn't block checkout redirect
    sendPaymentPendingEmail(
      org.ownerEmail ?? email,
      org.name,
      plan as PlanName,
      finalAmount,
      redirectUrl,
      env.logoUrl,
    ).catch((err) =>
      console.error(
        "[createPayment] Failed to send pending payment email:",
        err,
      ),
    );

    revalidatePath("/dashboard/billing");

    return { success: true, redirectUrl, finalAmount };
  } catch (err) {
    // If insertPendingPayment hit the unique constraint, a concurrent request
    // already created a pending payment — fetch it and return its redirectUrl
    // instead of erroring, so the user still gets somewhere useful
    if (err instanceof Error && "code" in err && err.code === "23505") {
      const existing = await getPendingPayment(orgId);
      if (existing) {
        return {
          success: false,
          error: "Transaksi sudah dibuat. Lanjutkan pembayaran yang sudah ada.",
          redirectUrl: existing.redirectUrl,
        };
      }
    }

    console.error("[createPayment] Midtrans error:", err);
    return {
      success: false,
      error: "Gagal membuat transaksi. Coba lagi dalam beberapa saat.",
    };
  }
}

// cancelPendingPayment action
export async function cancelPendingPaymentAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { orgId } = await requireOrg();
    await cancelPendingPayment(orgId);
    revalidatePath("/dashboard/billing");
    return { success: true };
  } catch (err) {
    console.error("[cancelPendingPaymentAction] error:", err);
    return { success: false, error: "Gagal membatalkan transaksi. Coba lagi." };
  }
}

// cancelSubscriptionAction — unchanged
export async function cancelSubscriptionAction(
  _prev: { success: boolean; error?: string } | null,
  _formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const { orgId } = await requireOrg();

  try {
    await cancelSubscription(orgId);
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
