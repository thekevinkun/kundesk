// All service mode types — used throughout the app to switch between mock and real
// Validated at startup in lib/env.ts — a typo throws immediately, not silently

export type AIMode = "mock" | "openai";
export type EmbeddingMode = "mock" | "openai";
export type StorageMode = "mock" | "s3";
export type PaymentMode = "mock" | "midtrans";
export type RealtimeMode = "mock" | "pusher";
export type EmailMode = "mock" | "resend";

// Validates KUNDESK_AI_MODE at runtime — throws on invalid value
export function getAIMode(): AIMode {
  const mode = process.env.KUNDESK_AI_MODE;
  if (mode !== "mock" && mode !== "openai") {
    throw new Error(
      `Invalid KUNDESK_AI_MODE: "${mode}". Must be "mock" or "openai"`,
    );
  }
  return mode;
}

// Validates KUNDESK_EMBEDDING_MODE at runtime
export function getEmbeddingMode(): EmbeddingMode {
  const mode = process.env.KUNDESK_EMBEDDING_MODE;
  if (mode !== "mock" && mode !== "openai") {
    throw new Error(
      `Invalid KUNDESK_EMBEDDING_MODE: "${mode}". Must be "mock" or "openai"`,
    );
  }
  return mode;
}

// Validates KUNDESK_STORAGE_MODE at runtime
export function getStorageMode(): StorageMode {
  const mode = process.env.KUNDESK_STORAGE_MODE;
  if (mode !== "mock" && mode !== "s3") {
    throw new Error(
      `Invalid KUNDESK_STORAGE_MODE: "${mode}". Must be "mock" or "s3"`,
    );
  }
  return mode;
}

// Validates KUNDESK_PAYMENT_MODE at runtime
export function getPaymentMode(): PaymentMode {
  const mode = process.env.KUNDESK_PAYMENT_MODE;
  if (mode !== "mock" && mode !== "midtrans") {
    throw new Error(
      `Invalid KUNDESK_PAYMENT_MODE: "${mode}". Must be "mock" or "midtrans"`,
    );
  }
  return mode;
}

// Validates KUNDESK_REALTIME_MODE at runtime
export function getRealtimeMode(): RealtimeMode {
  const mode = process.env.KUNDESK_REALTIME_MODE;
  if (mode !== "mock" && mode !== "pusher") {
    throw new Error(
      `Invalid KUNDESK_REALTIME_MODE: "${mode}". Must be "mock" or "pusher"`,
    );
  }
  return mode;
}

// Validates KUNDESK_EMAIL_MODE at runtime
export function getEmailMode(): EmailMode {
  const mode = process.env.KUNDESK_EMAIL_MODE;
  if (mode !== "mock" && mode !== "resend") {
    throw new Error(
      `Invalid KUNDESK_EMAIL_MODE: "${mode}". Must be "mock" or "resend"`,
    );
  }
  return mode;
}
