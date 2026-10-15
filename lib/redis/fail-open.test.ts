// Tests for lib/redis/fail-open.ts — timeout, circuit breaker and throttled Sentry alert.
// Fake timers drive the clock, so nothing here waits in real time.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted so the vi.mock factory below can reference it (rule 163)
const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

import {
  FAIL_OPEN_RATE_LIMIT,
  REDIS_ALERT_INTERVAL_MS,
  REDIS_SKIP_MS,
  REDIS_TIMEOUT_MS,
  failOpenRateLimit,
  redisOrFallback,
  resetRedisFailOpenState,
} from "./fail-open";

describe("lib/redis/fail-open", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Module state (breaker, last alert) must not leak between tests
    resetRedisFailOpenState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("redisOrFallback", () => {
    it("returns the real result when Redis works, with no alert", async () => {
      const result = await redisOrFallback(
        "op",
        async () => "real",
        "fallback",
      );

      expect(result).toBe("real");
      expect(captureException).not.toHaveBeenCalled();
    });

    it("returns the fallback and alerts Sentry when the call fails", async () => {
      const boom = new Error("redis down");

      const result = await redisOrFallback(
        "op",
        () => Promise.reject(boom),
        "fallback",
      );

      expect(result).toBe("fallback");
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(
        boom,
        expect.objectContaining({
          tags: { area: "redis", operation: "op" },
          fingerprint: ["redis-unavailable"],
        }),
      );
    });

    it("gives up on a call that never answers, after the timeout", async () => {
      const pending = redisOrFallback(
        "op",
        () => new Promise<string>(() => undefined),
        "fallback",
      );

      await vi.advanceTimersByTimeAsync(REDIS_TIMEOUT_MS);

      expect(await pending).toBe("fallback");
      expect(captureException).toHaveBeenCalledTimes(1);
    });

    it("does not time out a call that finishes just before the limit", async () => {
      const pending = redisOrFallback(
        "op",
        () =>
          new Promise<string>((resolve) =>
            setTimeout(() => resolve("slow but fine"), REDIS_TIMEOUT_MS - 1),
          ),
        "fallback",
      );

      await vi.advanceTimersByTimeAsync(REDIS_TIMEOUT_MS - 1);

      expect(await pending).toBe("slow but fine");
      expect(captureException).not.toHaveBeenCalled();
    });
  });

  describe("circuit breaker", () => {
    it("after a failure, skips Redis entirely until the skip window ends", async () => {
      await redisOrFallback("op", () => Promise.reject(new Error("x")), "fb");

      const whileOpen = vi.fn().mockResolvedValue("real");
      expect(await redisOrFallback("op", whileOpen, "fb")).toBe("fb");
      expect(whileOpen).not.toHaveBeenCalled();

      // The window ends: Redis is tried again
      vi.advanceTimersByTime(REDIS_SKIP_MS);
      const afterWindow = vi.fn().mockResolvedValue("real");
      expect(await redisOrFallback("op", afterWindow, "fb")).toBe("real");
      expect(afterWindow).toHaveBeenCalledTimes(1);
    });

    it("is shared: a failure in one kind of call makes the others skip Redis", async () => {
      await redisOrFallback(
        "cache-get",
        () => Promise.reject(new Error("x")),
        null,
      );

      const check = vi
        .fn()
        .mockResolvedValue({ success: false, remaining: 0, reset: 0 });
      const result = await failOpenRateLimit("chat-ip-limit", check);

      expect(check).not.toHaveBeenCalled();
      expect(result).toEqual(FAIL_OPEN_RATE_LIMIT);
    });
  });

  describe("alert throttle", () => {
    async function failOnce(): Promise<void> {
      await redisOrFallback("op", () => Promise.reject(new Error("x")), "fb");
    }

    it("sends at most one alert per interval, then alerts again after it", async () => {
      await failOnce();
      expect(captureException).toHaveBeenCalledTimes(1);

      // The breaker has closed again, but the alert interval has not passed
      vi.advanceTimersByTime(REDIS_SKIP_MS + 1);
      await failOnce();
      expect(captureException).toHaveBeenCalledTimes(1);

      // The interval has passed: the next failure alerts again
      vi.advanceTimersByTime(REDIS_ALERT_INTERVAL_MS);
      await failOnce();
      expect(captureException).toHaveBeenCalledTimes(2);
    });
  });

  describe("failOpenRateLimit", () => {
    it("passes a real result through, including a real block", async () => {
      const blocked = { success: false, remaining: 0, reset: 123 };

      const result = await failOpenRateLimit(
        "chat-ip-limit",
        async () => blocked,
      );

      expect(result).toEqual(blocked);
    });

    it("allows the request when the limiter fails", async () => {
      const result = await failOpenRateLimit("chat-ip-limit", () =>
        Promise.reject(new Error("redis down")),
      );

      expect(result).toEqual({ success: true, remaining: -1, reset: 0 });
    });
  });
});
