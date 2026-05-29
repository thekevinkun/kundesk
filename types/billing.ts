// Billing, plan, and Midtrans types
// Subscription state machine: free → active → past_due → suspended → cancelled

export type PlanName = "free" | "starter" | "pro";

export type SubscriptionStatus =
  | "free"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

// Plan limits — enforced server-side on every chat message
export interface PlanLimits {
  messagesPerMonth: number;
  documents: number;
  chatbots: number;
  embedWidget: boolean;
  whatsapp: boolean;
  analytics: boolean;
  customBranding: boolean;
  apiAccess: boolean;
}

// Plan limits lookup — single source of truth
export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    messagesPerMonth: 100,
    documents: 3,
    chatbots: 1,
    embedWidget: false,
    whatsapp: false,
    analytics: false,
    customBranding: false,
    apiAccess: false,
  },
  starter: {
    messagesPerMonth: 1000,
    documents: 20,
    chatbots: 1,
    embedWidget: true,
    whatsapp: false,
    analytics: true,
    customBranding: false,
    apiAccess: false,
  },
  pro: {
    messagesPerMonth: 10000,
    documents: Infinity,
    chatbots: 3,
    embedWidget: true,
    whatsapp: true,
    analytics: true,
    customBranding: true,
    apiAccess: true,
  },
};

// Plan pricing in Rupiah
export const PLAN_PRICE: Record<PlanName, number> = {
  free: 0,
  starter: 149000,
  pro: 399000,
};

// First-time discount prices — fixed amounts, only applies before first purchase
// Once any paid plan is bought, hasUsedFirstPurchase flips to true and these never show again
export const PLAN_FIRST_TIME_PRICE: Record<"starter" | "pro", number> = {
  starter: 99_000,
  pro: 299_000,
};

// Matches the promoCodes table — used by validatePromoCode query return type
export interface PromoCode {
  id: number;
  code: string;
  discountPercent: number;
  applicablePlans: PlanName[] | null; // null = all paid plans
  validUntil: Date | null;
  maxUses: number | null;
  usedCount: number;
}

// Midtrans webhook notification payload
export interface MidtransNotification {
  order_id: string;
  transaction_status: string;
  fraud_status: string;
  gross_amount: string;
  payment_type: string;
  transaction_id: string;
  signature_key: string;
  status_code: string;
}

// Represents a single past payment — for the history table on billing page
// Populated from processedWebhooks + orgs
// Extended with real Midtrans transaction history in a future phase
export interface PaymentHistoryItem {
  orderId: string;
  plan: PlanName;
  amount: number;
  paymentMethod: string;
  paidAt: Date;
  status: "success" | "failed" | "pending";
}

// All data the billing page needs — fetched once in page.tsx via Promise.all
export interface BillingPageData {
  currentPlan: PlanName;
  subscriptionStatus: SubscriptionStatus;
  messagesUsed: number;
  messagesLimit: number;
  currentPeriodEnd: Date | null;
  nextBillingDate: Date | null;
  lastPaymentMethod: string | null;
  paymentHistory: PaymentHistoryItem[];
  hasUsedFirstPurchase: boolean;
  // true if at least one promo code is active and not expired right now
  // drives whether the promo code input appears on the billing page
  hasActivePromo: boolean;
}
