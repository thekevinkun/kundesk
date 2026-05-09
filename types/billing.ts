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
