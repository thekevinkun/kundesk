// Upstash Redis client + 4 rate limiters
// Serverless-compatible — uses HTTP-based @upstash/redis, not ioredis
// Rate limiters are initialized lazily — only when first called

import { env } from "@/lib/env"

// Lazy Redis client — initialized on first use to avoid cold start overhead
let _redis: import("@upstash/redis").Redis | null = null

// Returns the Redis client — throws if credentials are missing
async function getRedis(): Promise<import("@upstash/redis").Redis> {
  if (_redis) return _redis

  if (!env.upstashRedisUrl || !env.upstashRedisToken) {
    throw new Error("Upstash Redis credentials required (UPSTASH_REDIS_REST_URL + TOKEN)")
  }

  const { Redis } = await import("@upstash/redis")
  _redis = new Redis({
    url: env.upstashRedisUrl,
    token: env.upstashRedisToken,
  })

  return _redis
}

// Rate limit result — passed back to route handlers
export interface RateLimitResult {
  success:   boolean  // true = allowed, false = blocked
  remaining: number   // requests remaining in window
  reset:     number   // Unix timestamp when window resets
}

// 4 rate limiters — each scoped to a specific concern

// chatRateLimit — 20 req/min per IP — protects OpenAI credits
export async function checkChatRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = await getRedis()
  const { Ratelimit } = await import("@upstash/ratelimit")

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:chat:ip",
  })

  const result = await limiter.limit(ip)
  return {
    success:   result.success,
    remaining: result.remaining,
    reset:     result.reset,
  }
}

// orgMessageLimit — 60 req/min per org — prevents single org from monopolizing
export async function checkOrgMessageLimit(orgId: string): Promise<RateLimitResult> {
  const redis = await getRedis()
  const { Ratelimit } = await import("@upstash/ratelimit")

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:chat:org",
  })

  const result = await limiter.limit(orgId)
  return {
    success:   result.success,
    remaining: result.remaining,
    reset:     result.reset,
  }
}

// uploadRateLimit — 10 uploads/hour per org — prevents abuse of S3 + processing
export async function checkUploadRateLimit(orgId: string): Promise<RateLimitResult> {
  const redis = await getRedis()
  const { Ratelimit } = await import("@upstash/ratelimit")

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:upload:org",
  })

  const result = await limiter.limit(orgId)
  return {
    success:   result.success,
    remaining: result.remaining,
    reset:     result.reset,
  }
}

// authRateLimit — 10 req/15min per IP — prevents brute force on auth endpoints
export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = await getRedis()
  const { Ratelimit } = await import("@upstash/ratelimit")

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "rl:auth:ip",
  })

  const result = await limiter.limit(ip)
  return {
    success:   result.success,
    remaining: result.remaining,
    reset:     result.reset,
  }
}

// Generic cache get/set — used for response caching in Phase 4+
export async function cacheGet(key: string): Promise<string | null> {
  const redis = await getRedis()
  return redis.get<string>(key)
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  const redis = await getRedis()
  await redis.set(key, value, { ex: ttlSeconds })
}
