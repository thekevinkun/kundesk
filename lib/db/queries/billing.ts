// All billing-related DB queries — imported by Server Actions and webhook handler
// Every query scopes to orgId first — never query by id alone

import { and, eq, gte, lt, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs, payments } from "@/lib/db/schema";
import type {
  BillingPageData,
  PlanName,
  SubscriptionStatus,
} from "@/types/billing";
import { PLAN_LIMITS, PaymentHistoryItem } from "@/types/billing";

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
    paymentHistory: await getPaymentHistory(orgId),
  };
}

// Activates a subscription after successful Midtrans payment
// Called exclusively from the webhook handler — never from client code
export async function activateSubscription(
  orgId: string,
  plan: PlanName,
  paymentMethod: string,
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

// Fetches all orgs where nextBillingDate falls within today — used by renewal cron
// Date window filtering done at DB level — never in memory
export async function resetMessagesUsed(orgId: string): Promise<void> {
  await db.update(orgs).set({ messagesUsed: 0 }).where(eq(orgs.id, orgId));
}

// Fetches all orgs where nextBillingDate falls within today — used by renewal cron
export async function getOrgsDueForRenewal(): Promise<
  Array<{
    id: string;
    name: string;
    plan: PlanName;
    subscriptionStatus: SubscriptionStatus;
    nextBillingDate: Date | null;
    ownerEmail: string | null;
  }>
> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const results = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      plan: orgs.plan,
      subscriptionStatus: orgs.subscriptionStatus,
      nextBillingDate: orgs.nextBillingDate,
      ownerEmail: orgs.ownerEmail,
    })
    .from(orgs)
    .where(
      and(
        eq(orgs.subscriptionStatus, "active"),
        gte(orgs.nextBillingDate, today),
        lt(orgs.nextBillingDate, tomorrow),
      ),
    );

  return results.map((org) => ({
    id: org.id,
    name: org.name,
    ownerEmail: org.ownerEmail,
    plan: org.plan as PlanName,
    subscriptionStatus: org.subscriptionStatus as SubscriptionStatus,
    nextBillingDate: org.nextBillingDate,
  }));
}

// Inserts a payment record after successful Midtrans settlement
// Called exclusively from the webhook handler — after activateSubscription succeeds
// Never called directly — billing history must only reflect confirmed payments
export async function insertPayment(
  orgId: string,
  orderId: string,
  plan: PlanName,
  amount: number,
  paymentMethod: string,
): Promise<void> {
  await db.insert(payments).values({
    orgId,
    orderId,
    plan,
    amount,
    paymentMethod,
    // paidAt defaults to now() — matches when webhook was processed
    status: "success",
  });
}

// Fetches payment history for an org — newest first, max 12 records
// Used by the billing page PaymentHistoryCard
// Scoped to orgId — tenant isolation + IDOR protection
export async function getPaymentHistory(
  orgId: string,
): Promise<PaymentHistoryItem[]> {
  const rows = await db
    .select({
      orderId: payments.orderId,
      plan: payments.plan,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      paidAt: payments.paidAt,
      status: payments.status,
    })
    .from(payments)
    .where(
      // Always scope to org — never fetch payments without orgId
      eq(payments.orgId, orgId),
    )
    .orderBy(desc(payments.paidAt))
    .limit(12);

  return rows.map((row) => ({
    orderId: row.orderId,
    plan: row.plan as PlanName,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    paidAt: row.paidAt,
    status: row.status as PaymentHistoryItem["status"],
  }));
}
