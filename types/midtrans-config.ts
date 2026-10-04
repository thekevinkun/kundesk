// Input for the startup check of the Midtrans keys (see helpers/midtrans-config.ts)

import type { PaymentMode } from "@/types/config";

export interface MidtransConfigInput {
  paymentMode: PaymentMode; // only "midtrans" mode is validated
  serverKey: string | undefined; // MIDTRANS_SERVER_KEY
  clientKey: string | undefined; // MIDTRANS_CLIENT_KEY
  isProduction: boolean; // MIDTRANS_IS_PRODUCTION === "true"
}
