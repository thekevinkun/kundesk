// Upstash Redis client + 4 rate limiters
// Serverless-compatible — uses HTTP-based @upstash/redis, not ioredis
// Rate limiters are initialized lazily — only when first called

import { env } from "@/lib/env";

// Lazy Redis client — initialized on first use to avoid cold start overhead
let _redis: import("@upstash/redis").Redis | null = null;

// Returns the Redis client — throws if credentials are missing
async function getRedis(): Promise<import("@upstash/redis").Redis> {
  if (_redis) return _redis;

  if (!env.upstashRedisUrl || !env.upstashRedisToken) {
    throw new Error(
      "Upstash Redis credentials required (UPSTASH_REDIS_REST_URL + TOKEN)",
    );
  }

  const { Redis } = await import("@upstash/redis");
  _redis = new Redis({
    url: env.upstashRedisUrl,
    token: env.upstashRedisToken,
  });

  return _redis;
}

// Rate limit result — passed back to route handlers
export interface RateLimitResult {
  success: boolean; // true = allowed, false = blocked
  remaining: number; // requests remaining in window
  reset: number; // Unix timestamp when window resets
}

// 4 rate limiters — each scoped to a specific concern

// chatRateLimit — 20 req/min per IP — protects OpenAI credits
export async function checkChatRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = await getRedis();
  const { Ratelimit } = await import("@upstash/ratelimit");

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "kundesk:rl:chat:ip",
  });

  const result = await limiter.limit(ip);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// orgMessageLimit — 60 req/min per org — prevents single org from monopolizing
export async function checkOrgMessageLimit(
  orgId: string,
): Promise<RateLimitResult> {
  const redis = await getRedis();
  const { Ratelimit } = await import("@upstash/ratelimit");

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "kundesk:rl:chat:org",
  });

  const result = await limiter.limit(orgId);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// uploadRateLimit — 10 uploads/hour per org — prevents abuse of S3 + processing
export async function checkUploadRateLimit(
  orgId: string,
): Promise<RateLimitResult> {
  const redis = await getRedis();
  const { Ratelimit } = await import("@upstash/ratelimit");

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "kundesk:rl:upload:org",
  });

  const result = await limiter.limit(orgId);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// authRateLimit — 10 req/15min per IP — prevents brute force on auth endpoints
export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = await getRedis();
  const { Ratelimit } = await import("@upstash/ratelimit");

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "kundesk:rl:auth:ip",
  });

  const result = await limiter.limit(ip);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Generic cache get/set — used for response caching
export async function cacheGet(key: string): Promise<string | null> {
  const redis = await getRedis();
  return redis.get<string>(key);
}

// Sets a cached value with TTL (in seconds)
// used for caching expensive responses like embeddings or LLM output
export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  const redis = await getRedis();
  await redis.set(key, value, { ex: ttlSeconds });
}

// Deletes a cached key immediately — used for cache invalidation on writes
// Called whenever org or chatbot data changes so stale data is never served
export async function cacheDelete(key: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(key);
}

// Cache key helpers — centralized so naming is never inconsistent
export const CacheKeys = {
  // Keyed by slug — used in chat route (entry point is always slug)
  orgBySlug: (slug: string) => `kundesk:cache:org:slug:${slug}`,
  // Keyed by orgId — used for invalidation from billing/chatbot actions
  orgById: (orgId: string) => `kundesk:cache:org:id:${orgId}`,
  // Keyed by orgId — chatbot config rarely changes
  chatbot: (orgId: string) => `kundesk:cache:chatbot:${orgId}`,
} as const;

// Org cache TTL — 5 minutes
// Short because messagesUsed, messagesLimit, subscriptionStatus change frequently
const ORG_TTL = 300;

// Chatbot cache TTL — 10 minutes
// Longer because config changes are intentional and infrequent
const CHATBOT_TTL = 600;

// Org shape stored in cache — only the fields chat route actually needs
export interface CachedOrg {
  id: string;
  slug: string;
  name: string | null;
  plan: string;
  subscriptionStatus: string;
  messagesUsed: number;
  messagesLimit: number;
  ownerEmail: string | null;
}

// Chatbot shape stored in cache — full config needed to build system prompt
export interface CachedChatbot {
  id: number;
  orgId: string;
  name: string;
  language: string;
  tone: string;
  greetingMessage: string | null;
  systemPrompt: string | null;
  accentColor: string;
  quickReplies: string | null;
  isActive: boolean;
}

// Returns cached org or fetches from Neon and caches it
// Stores under both slug and orgId keys — so invalidation works from either side
export async function getCachedOrg(
  slug: string,
  fetchFn: () => Promise<CachedOrg | null>,
): Promise<CachedOrg | null> {
  const slugKey = CacheKeys.orgBySlug(slug);

  // Try cache first
  const cached = await cacheGet(slugKey);
  if (cached) {
    try {
      return JSON.parse(cached) as CachedOrg;
    } catch {
      // Corrupted cache entry — fall through to DB fetch
    }
  }

  // Cache miss — fetch from DB
  const org = await fetchFn();
  if (!org) return null;

  // Store under both keys so invalidation works from orgId side too
  const serialized = JSON.stringify(org);
  await Promise.all([
    cacheSet(slugKey, serialized, ORG_TTL),
    cacheSet(CacheKeys.orgById(org.id), serialized, ORG_TTL),
  ]);

  return org;
}

// Returns cached chatbot or fetches from Neon and caches it
export async function getCachedChatbot(
  orgId: string,
  fetchFn: () => Promise<CachedChatbot | null>,
): Promise<CachedChatbot | null> {
  const key = CacheKeys.chatbot(orgId);

  const cached = await cacheGet(key);
  if (cached) {
    try {
      return JSON.parse(cached) as CachedChatbot;
    } catch {
      // Corrupted cache entry — fall through to DB fetch
    }
  }

  const chatbot = await fetchFn();
  if (!chatbot) return null;

  await cacheSet(key, JSON.stringify(chatbot), CHATBOT_TTL);
  return chatbot;
}
