// Startup sanity check for the Midtrans keys.
// A pure function on purpose: lib/env.ts can't be imported in a test, this can.
// Error messages never contain a key value — they end up in build and server logs.

import type { MidtransConfigInput } from "@/types/midtrans-config";

// LIMITED HEURISTIC, not environment validation. Sandbox keys from older accounts start
// with "SB-"; this project's sandbox AND production keys have no prefix at all, so for them
// both prefix checks below can never fire. Only the PRESENCE of "SB-" is a signal. The real
// check that a key matches the selected endpoint is an authenticated call to that endpoint,
// done by hand at rollout (see docs/midtrans-smoke-test.md).
const SANDBOX_PREFIX = "SB-";

export function validateMidtransConfig(input: MidtransConfigInput): void {
  // Mock mode never talks to Midtrans — nothing to check
  if (input.paymentMode !== "midtrans") return;

  const { serverKey, clientKey, isProduction } = input;

  // Both keys are needed the moment real payments are on
  if (!serverKey) {
    throw new Error(
      "Missing MIDTRANS_SERVER_KEY (required when KUNDESK_PAYMENT_MODE=midtrans)",
    );
  }
  if (!clientKey) {
    throw new Error(
      "Missing MIDTRANS_CLIENT_KEY (required when KUNDESK_PAYMENT_MODE=midtrans)",
    );
  }

  // A pasted newline or space makes every Midtrans call fail with an auth error
  if (serverKey !== serverKey.trim() || clientKey !== clientKey.trim()) {
    throw new Error(
      "MIDTRANS_SERVER_KEY or MIDTRANS_CLIENT_KEY has leading or trailing whitespace",
    );
  }

  // A client key in the server slot (or the reverse) is an easy copy-paste mistake
  if (serverKey.includes("Mid-client-") || clientKey.includes("Mid-server-")) {
    throw new Error("MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY look swapped");
  }

  const serverIsSandbox = serverKey.startsWith(SANDBOX_PREFIX);
  const clientIsSandbox = clientKey.startsWith(SANDBOX_PREFIX);

  // Half-changed setup: one key from sandbox, the other from production
  if (serverIsSandbox !== clientIsSandbox) {
    throw new Error(
      "MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY are from different environments (one sandbox, one not)",
    );
  }

  // The one combination that is certainly wrong: production endpoints with a sandbox key
  if (isProduction && serverIsSandbox) {
    throw new Error(
      "MIDTRANS_IS_PRODUCTION=true but the Midtrans keys are sandbox keys",
    );
  }
}
