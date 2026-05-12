// Server Actions for billing — called directly from BillingPage client component
// requireOrg() at the top of every action — never skip this
// Zod validates all input before touching DB or external APIs

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { currentUser } from "@clerk/nextjs/server";
import { requireOrg } from "@/lib/auth";
import { createSubscriptionTransaction } from "@/lib/midtrans";
import { cancelSubscription } from "@/lib/db/queries/billing";
import type { PlanName } from "@/types/billing";

// ── Input schemas ──

const upgradeSchema = z.object({
  // Only paid plans can be selected — free has no payment flow
  plan: z.enum(["starter", "pro"]),
});

// Return type for all billing actions — consistent shape for useActionState
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
  const result = upgradeSchema.safeParse({
    plan: formData.get("plan"),
  });

  if (!result.success) {
    return { success: false, error: "Invalid plan selected." };
  }

  const { plan } = result.data;

  // Get the customer's email from Clerk — passed to Midtrans for their records
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "noemail@kundesk.app";

  try {
    const { redirectUrl } = await createSubscriptionTransaction(
      orgId,
      plan as PlanName,
      email,
    );

    // Revalidate billing page so status reflects any immediate changes
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
// Immediate effect — no refund logic (out of scope for Phase 6)
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
