// Validates all required environment variables at startup
// Import this at the top of any lib/ file that needs env vars
// Never access process.env directly outside of this file

import {
  getAIMode,
  getEmbeddingMode,
  getStorageMode,
  getPaymentMode,
  getRealtimeMode,
  getEmailMode,
} from "@/types/config";

// Throws immediately with a clear message if a required var is missing
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

// All validated env vars — import { env } from "@/lib/env" everywhere
export const env = {
  // ── Database (always real — Neon free tier) ──
  databaseUrl: requireEnv("DATABASE_URL"),

  // ── Auth (always real — Clerk free tier) ──
  clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
  clerkWebhookSecret: requireEnv("CLERK_WEBHOOK_SECRET"),

  // ── App URL ──
  appUrl: requireEnv("NEXT_PUBLIC_APP_URL"),

  // ── Logo URL ──
  logoUrl: requireEnv("LOGO_URL"),

  // Cron secret — validates requests come from Vercel scheduler, not random callers
  cronSecret: requireEnv("CRON_SECRET"),

  // ── AI — only required when mode=openai ──
  openaiApiKey: process.env.OPENAI_API_KEY,

  // ── AWS — only required when mode=s3 ──
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION ?? "ap-southeast-1",
  cloudfrontUrl: process.env.CLOUDFRONT_URL,

  // ── Midtrans — only required when mode=midtrans ──
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY,
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY,
  midtransProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",

  // ── Pusher — only required when mode=pusher ──
  pusherAppId: process.env.PUSHER_APP_ID,
  pusherKey: process.env.PUSHER_KEY,
  pusherSecret: process.env.PUSHER_SECRET,
  pusherCluster: process.env.PUSHER_CLUSTER ?? "ap1",

  // ── PostHog — optional, analytics degrade gracefully if missing ──
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  posthogHost:
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",

  // ── Resend — only required when mode=resend ──
  resendApiKey: process.env.RESEND_API_KEY,

  // ── Upstash Redis ──
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,

  // ── Service modes — validated as typed unions ──
  aiMode: getAIMode(),
  embeddingMode: getEmbeddingMode(),
  storageMode: getStorageMode(),
  paymentMode: getPaymentMode(),
  realtimeMode: getRealtimeMode(),
  emailMode: getEmailMode(),
} as const;
