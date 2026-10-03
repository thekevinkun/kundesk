// Types for settling a paid Midtrans order and for reading its status back from Midtrans

// What settlePaidOrder needs to know about a PAID order
export interface SettleInput {
  orderId: string; // Midtrans order_id (KUNDESK-...)
  grossAmount: string; // As Midtrans reports it, e.g. "149000" or "99000.00"
  paymentType: string; // bank_transfer, qris, gopay, ...
}

// What happened — each caller maps this to its own response
export type SettleResult =
  | { kind: "activated" } // subscription activated and payment recorded
  | { kind: "already_processed" } // a concurrent run finished this order first
  | { kind: "flagged"; body: { message: string } | { error: string } }; // NOT activated — Sentry was alerted

// Result of asking Midtrans for an order's real status (Core API Get Status)
export type MidtransStatusResult =
  | { found: false } // Midtrans has no transaction for this order — never paid
  | {
      found: true;
      statusCode: string; // "200" for a normal settlement
      transactionStatus: string; // settlement, capture, pending, expire, ...
      fraudStatus?: string | undefined; // accept | challenge | deny (absent on some payment types)
      grossAmount: string; // e.g. "99000.00"
      paymentType: string; // qris, bank_transfer, ...
    };
