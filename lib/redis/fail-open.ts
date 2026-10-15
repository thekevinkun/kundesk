// Keeps the chat path alive when Upstash Redis is down or slow.
// For chat, Redis is only an optimisation (rate limits and caches): the plan quota is enforced
// from Neon, so a Redis outage must degrade the chat, never take it down.
// Three rules: every Redis call is bounded by a timeout; a failure opens a short circuit breaker
// so the next calls skip Redis instead of each waiting out the timeout; and failures reach
// Sentry at most once per interval (an outage would otherwise send several events per message).
// State lives at module level, so the breaker is per server instance — enough for this purpose.

import * as Sentry from "@sentry/nextjs";
import type { RateLimitResult } from "@/lib/redis";

// A Redis call that takes longer than this counts as a failure
export const REDIS_TIMEOUT_MS = 2_000;
// After a failure, skip Redis for this long
export const REDIS_SKIP_MS = 30_000;
// At most one Sentry alert per this interval, per server instance
export const REDIS_ALERT_INTERVAL_MS = 5 * 60 * 1000;

// What a rate limiter reports when Redis is unavailable: allowed. remaining -1 = unknown.
export const FAIL_OPEN_RATE_LIMIT: RateLimitResult = {
  success: true,
  remaining: -1,
  reset: 0,
};

// Timestamp until which Redis is skipped (0 = breaker closed)
let skipRedisUntil = 0;
// Timestamp of the last Sentry alert
let lastAlertAt = 0;

// Test hook: closes the breaker and forgets the last alert
export function resetRedisFailOpenState(): void {
  skipRedisUntil = 0;
  lastAlertAt = 0;
}

// Runs the call, but gives up after REDIS_TIMEOUT_MS
async function withRedisTimeout<T>(work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`Redis call timed out after ${REDIS_TIMEOUT_MS}ms`)),
      REDIS_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([work(), timeout]);
  } finally {
    // Always clear the timer so a fast call leaves nothing pending
    clearTimeout(timer);
  }
}

// Opens the breaker and reports the failure (throttled)
function recordRedisFailure(operation: string, err: unknown): void {
  const now = Date.now();
  skipRedisUntil = now + REDIS_SKIP_MS;

  // Name and message only — never the whole error object
  const reason =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(
    `[redis] ${operation} failed — skipping Redis for ${REDIS_SKIP_MS / 1000}s: ${reason}`,
  );

  if (now - lastAlertAt < REDIS_ALERT_INTERVAL_MS) return;
  lastAlertAt = now;
  // One fixed fingerprint groups every outage alert into a single Sentry issue
  Sentry.captureException(err, {
    tags: { area: "redis", operation },
    fingerprint: ["redis-unavailable"],
  });
}

// Runs a Redis call. If Redis is being skipped, fails, or times out, returns the fallback instead.
export async function redisOrFallback<T>(
  operation: string,
  work: () => Promise<T>,
  fallback: T,
): Promise<T> {
  // Breaker open: do not even try
  if (Date.now() < skipRedisUntil) return fallback;

  try {
    return await withRedisTimeout(work);
  } catch (err) {
    recordRedisFailure(operation, err);
    return fallback;
  }
}

// A rate limiter that fails OPEN: if Redis is unavailable the request is allowed.
// A real "blocked" answer from a working Redis is passed through untouched.
export function failOpenRateLimit(
  operation: string,
  check: () => Promise<RateLimitResult>,
): Promise<RateLimitResult> {
  return redisOrFallback(operation, check, FAIL_OPEN_RATE_LIMIT);
}
