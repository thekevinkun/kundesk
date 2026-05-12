// All billing-related DB queries — imported by Server Actions and webhook handler
// Every query scopes to orgId first — never query by id alone

import { db } from "@/lib/db";
import { orgs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type {
  BillingPageData,
  PlanName,
  SubscriptionStatus,
} from "@/types/billing";
import { PLAN_LIMITS } from "@/types/billing";

// Fetches all billing data the billing page needs in one query
// Called in /dashboard/billing/page.tsx via Promise.all alongside other fetches
export async function getBillingData(orgId: string): Promise<BillingPageData> {
  const [org] = await db
    .select({
      plan: orgs.plan,
      subscriptionStatus: orgs.subscriptionStatus,
      messagesUsed: orgs.messagesUsed,
      messagesLimit: orgs.messagesLimit,
      currentPeriodEnd: orgs.currentPeriodEnd,
      nextBillingDate: orgs.nextBillingDate,
      lastPaymentMethod: orgs.lastPaymentMethod,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId));

  // Org must exist if requireOrg() passed — but guard anyway
  if (!org) throw new Error("Organization not found");

  return {
    currentPlan: org.plan as PlanName,
    subscriptionStatus: org.subscriptionStatus as SubscriptionStatus,
    messagesUsed: org.messagesUsed,
    messagesLimit: org.messagesLimit,
    currentPeriodEnd: org.currentPeriodEnd,
    nextBillingDate: org.nextBillingDate,
    lastPaymentMethod: org.lastPaymentMethod,
    // Phase 6: empty array — real Midtrans transaction history in Phase 7
    paymentHistory: [],
  };
}

// Activates a subscription after successful Midtrans payment
// Called exclusively from the webhook handler — never from client code
export async function activateSubscription(
  orgId: string,
  plan: PlanName,
  paymentMethod: string,
  _orderId: string,
): Promise<void> {
  const now = new Date();

  // Billing period: 30 days from payment date
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  // Next billing date: same as period end — cron picks this up
  const nextBilling = new Date(periodEnd);

  await db
    .update(orgs)
    .set({
      plan,
      subscriptionStatus: "active",
      messagesLimit: PLAN_LIMITS[plan].messagesPerMonth,
      currentPeriodEnd: periodEnd,
      nextBillingDate: nextBilling,
      lastPaymentMethod: paymentMethod,
    })
    .where(eq(orgs.id, orgId));
}

// Marks a subscription as past_due — called by cron when payment link is ignored
// Business owner has 3 days to pay before moving to suspended
export async function markPastDue(orgId: string): Promise<void> {
  await db
    .update(orgs)
    .set({ subscriptionStatus: "past_due" })
    .where(eq(orgs.id, orgId));
}

// Suspends a subscription — called by cron after 7 days unpaid
// Pro features blocked, dashboard still accessible
export async function suspendSubscription(orgId: string): Promise<void> {
  await db
    .update(orgs)
    .set({ subscriptionStatus: "suspended" })
    .where(eq(orgs.id, orgId));
}

// Cancels a subscription — called when owner explicitly cancels
// Immediately sets status; messagesLimit stays until period end
export async function cancelSubscription(orgId: string): Promise<void> {
  await db
    .update(orgs)
    .set({
      subscriptionStatus: "cancelled",
      nextBillingDate: null,
    })
    .where(eq(orgs.id, orgId));
}

// Resets monthly message usage — called by the monthly reset cron
// Runs on the first day of each billing period
export async function resetMessagesUsed(orgId: string): Promise<void> {
  await db.update(orgs).set({ messagesUsed: 0 }).where(eq(orgs.id, orgId));
}

// Fetches all orgs where nextBillingDate falls within today — used by renewal cron
export async function getOrgsDueForRenewal(): Promise<
  Array<{ id: string; plan: PlanName; subscriptionStatus: SubscriptionStatus }>
> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const results = await db
    .select({
      id: orgs.id,
      plan: orgs.plan,
      subscriptionStatus: orgs.subscriptionStatus,
      nextBillingDate: orgs.nextBillingDate,
    })
    .from(orgs)
    .where(eq(orgs.subscriptionStatus, "active"));

  // Filter to orgs whose nextBillingDate is today
  return results
    .filter((org) => {
      if (!org.nextBillingDate) return false;
      const d = new Date(org.nextBillingDate);
      return d >= today && d < tomorrow;
    })
    .map((org) => ({
      id: org.id,
      plan: org.plan as PlanName,
      subscriptionStatus: org.subscriptionStatus as SubscriptionStatus,
    }));
}
