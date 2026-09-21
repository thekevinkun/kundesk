// Unit tests for lib/redis/index.ts
// Mocks @upstash/redis and @upstash/ratelimit — no real network calls
// Covers: all 4 rate limiters, cacheGet, cacheSet

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Shared mock functions — defined before vi.mock calls ──
// Arrow functions cannot be used with `new` — must use plain vi.fn() references
// that the mock factory closures capture
const mockGet = vi.fn().mockResolvedValue(null);
const mockSet = vi.fn().mockResolvedValue("OK");
const mockLimit = vi.fn().mockResolvedValue({
  success: true,
  remaining: 19,
  reset: Date.now() + 60000,
});

// ── Mock @upstash/redis ──
// Redis is instantiated with `new` — mock must use function keyword, not arrow
vi.mock("@upstash/redis", () => ({
  Redis: function () {
    return { get: mockGet, set: mockSet };
  },
}));

// ── Mock @upstash/ratelimit ──
// Ratelimit is also instantiated with `new` — same function keyword requirement
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    function () {
      return { limit: mockLimit };
    },
    {
      // Static method called as Ratelimit.slidingWindow(n, "window")
      slidingWindow: vi.fn().mockReturnValue("sliding-window-config"),
    },
  ),
}));

// ── Mock lib/env ──
// Provides fake credentials so getRedis() doesn't throw on missing env vars
vi.mock("@/lib/env", () => ({
  env: {
    upstashRedisUrl: "https://fake-redis.upstash.io",
    upstashRedisToken: "fake-token",
  },
}));

// Import after mocks are registered
import {
  checkChatRateLimit,
  checkOrgMessageLimit,
  checkUploadRateLimit,
  checkAuthRateLimit,
  checkKnowledgeWriteLimit,
  getCachedProfile,
  cacheGet,
  cacheSet,
} from "@/lib/redis";

describe("checkChatRateLimit", () => {
  beforeEach(() => {
    mockLimit.mockClear();
  });

  it("returns success: true when under limit", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 19,
      reset: Date.now() + 60000,
    });

    const result = await checkChatRateLimit("127.0.0.1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(19);
  });

  it("returns success: false when rate limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const result = await checkChatRateLimit("127.0.0.1");

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("passes the IP as the limit key", async () => {
    await checkChatRateLimit("203.0.113.42");

    expect(mockLimit).toHaveBeenCalledWith("203.0.113.42");
  });

  it("returns a reset timestamp", async () => {
    const resetTime = Date.now() + 60000;
    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 10,
      reset: resetTime,
    });

    const result = await checkChatRateLimit("127.0.0.1");

    expect(result.reset).toBe(resetTime);
  });
});

describe("checkOrgMessageLimit", () => {
  beforeEach(() => {
    mockLimit.mockClear();
  });

  it("returns success: true when under limit", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 59,
      reset: Date.now() + 60000,
    });

    const result = await checkOrgMessageLimit("org_test123");

    expect(result.success).toBe(true);
  });

  it("returns success: false when org limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const result = await checkOrgMessageLimit("org_test123");

    expect(result.success).toBe(false);
  });

  it("passes orgId as the limit key", async () => {
    await checkOrgMessageLimit("org_abc");

    expect(mockLimit).toHaveBeenCalledWith("org_abc");
  });
});

describe("checkUploadRateLimit", () => {
  beforeEach(() => {
    mockLimit.mockClear();
  });

  it("returns success: true when under limit", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 3600000,
    });

    const result = await checkUploadRateLimit("org_test123");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("returns success: false when upload limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 3600000,
    });

    const result = await checkUploadRateLimit("org_test123");

    expect(result.success).toBe(false);
  });

  it("passes orgId as the limit key", async () => {
    await checkUploadRateLimit("org_upload_test");

    expect(mockLimit).toHaveBeenCalledWith("org_upload_test");
  });
});

describe("checkAuthRateLimit", () => {
  beforeEach(() => {
    mockLimit.mockClear();
  });

  it("returns success: true when under limit", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 900000,
    });

    const result = await checkAuthRateLimit("192.168.1.1");

    expect(result.success).toBe(true);
  });

  it("returns success: false when auth limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 900000,
    });

    const result = await checkAuthRateLimit("192.168.1.1");

    expect(result.success).toBe(false);
  });

  it("passes IP as the limit key", async () => {
    await checkAuthRateLimit("10.0.0.1");

    expect(mockLimit).toHaveBeenCalledWith("10.0.0.1");
  });
});

describe("checkKnowledgeWriteLimit", () => {
  beforeEach(() => {
    mockLimit.mockClear();
  });

  it("returns success: true when under limit", async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 199,
      reset: Date.now() + 3600000,
    });

    const result = await checkKnowledgeWriteLimit("org_test123");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(199);
  });

  it("returns success: false when the limit is exceeded", async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 3600000,
    });

    const result = await checkKnowledgeWriteLimit("org_test123");

    expect(result.success).toBe(false);
  });

  it("passes orgId as the limit key", async () => {
    await checkKnowledgeWriteLimit("org_knowledge");

    expect(mockLimit).toHaveBeenCalledWith("org_knowledge");
  });
});

describe("cacheGet", () => {
  beforeEach(() => {
    mockGet.mockClear();
  });

  it("returns null for missing key", async () => {
    mockGet.mockResolvedValueOnce(null);

    const result = await cacheGet("nonexistent-key");

    expect(result).toBeNull();
  });

  it("returns cached value when key exists", async () => {
    mockGet.mockResolvedValueOnce("cached-value");

    const result = await cacheGet("some-key");

    expect(result).toBe("cached-value");
  });
});

describe("cacheSet", () => {
  beforeEach(() => {
    mockSet.mockClear();
  });

  it("calls set with key, value, and TTL", async () => {
    await cacheSet("test-key", "test-value", 300);

    expect(mockSet).toHaveBeenCalledWith("test-key", "test-value", { ex: 300 });
  });

  it("resolves without error", async () => {
    await expect(cacheSet("key", "value", 60)).resolves.toBeUndefined();
  });
});

describe("getCachedProfile", () => {
  const profile = {
    block: "Alamat: Jalan Pramuka",
    hours: [
      {
        label: "Klinik",
        lines: [{ days: [1], opens: "08:00", closes: "20:00" }],
      },
    ],
  };

  beforeEach(() => {
    mockGet.mockClear();
    mockSet.mockClear();
  });

  it("returns the cached profile without calling fetch", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(profile));
    const fetchFn = vi.fn();

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("accepts an already-parsed cache value", async () => {
    mockGet.mockResolvedValueOnce(profile);
    const fetchFn = vi.fn();

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("treats a cached 'no profile' as a hit", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ block: null, hours: [] }));
    const fetchFn = vi.fn();

    expect(await getCachedProfile("org_1", fetchFn)).toEqual({
      block: null,
      hours: [],
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("treats an old-format entry (no hours) as a miss", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ block: "Alamat: X" }));
    const fetchFn = vi.fn().mockResolvedValue(profile);

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("loads and caches the profile on a miss", async () => {
    mockGet.mockResolvedValueOnce(null);
    const fetchFn = vi.fn().mockResolvedValue(profile);

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(mockSet).toHaveBeenCalledWith(
      "kundesk:cache:profile:org_1",
      JSON.stringify(profile),
      { ex: 600 },
    );
  });

  it("falls back to the loader when the cached value is corrupted", async () => {
    mockGet.mockResolvedValueOnce("{not json");
    const fetchFn = vi.fn().mockResolvedValue(profile);

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("treats malformed hours as a miss", async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify({ block: "Alamat: X", hours: [{}] }),
    );
    const fetchFn = vi.fn().mockResolvedValue(profile);

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("treats old free-text hours as a miss", async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify({
        block: "Alamat: X",
        hours: [
          {
            label: "Klinik",
            lines: [{ days: "Senin – Jumat", time: "08.00 – 20.00" }],
          },
        ],
      }),
    );
    const fetchFn = vi.fn().mockResolvedValue(profile);

    expect(await getCachedProfile("org_1", fetchFn)).toEqual(profile);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
