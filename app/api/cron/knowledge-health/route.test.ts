// Tests the knowledge-health cron: auth, clean run, findings → Sentry, failure → 500
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Hoisted so the vi.mock factories below can reference them
const mocks = vi.hoisted(() => ({
  mockEnv: { cronSecret: "test-secret" },
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  findSectionsMissingSummary: vi.fn(),
  findSyncedEntriesMissingChunks: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mocks.mockEnv }));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: mocks.captureMessage,
  captureException: mocks.captureException,
}));
vi.mock("@/lib/db/queries/knowledge-health", () => ({
  findSectionsMissingSummary: mocks.findSectionsMissingSummary,
  findSyncedEntriesMissingChunks: mocks.findSyncedEntriesMissingChunks,
}));

import { GET } from "./route";

// Builds a request with an optional authorization header
function makeRequest(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/knowledge-health", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/knowledge-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: healthy database
    mocks.findSectionsMissingSummary.mockResolvedValue([]);
    mocks.findSyncedEntriesMissingChunks.mockResolvedValue([]);
    // Keep test output clean — the route logs on warn/error paths
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects a missing authorization header with 401", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    // Auth must fail before any DB work
    expect(mocks.findSectionsMissingSummary).not.toHaveBeenCalled();
    expect(mocks.findSyncedEntriesMissingChunks).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret with 401", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(mocks.findSectionsMissingSummary).not.toHaveBeenCalled();
  });

  it("returns zero counts and sends nothing to Sentry when healthy", async () => {
    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ summaryGaps: 0, entryGaps: 0 });
    expect(mocks.captureMessage).not.toHaveBeenCalled();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("reports a summary gap to Sentry as one grouped error message", async () => {
    const summaryGaps = [{ sectionId: 7, orgId: "org_a", entries: 3 }];
    mocks.findSectionsMissingSummary.mockResolvedValue(summaryGaps);

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ summaryGaps: 1, entryGaps: 0 });
    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
    // Fixed message string is what makes Sentry group every day into one issue
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "knowledge-health: missing chunks detected",
      { level: "error", extra: { summaryGaps, entryGaps: [] } },
    );
  });

  it("reports an entry gap to Sentry", async () => {
    const entryGaps = [{ entryId: 12, orgId: "org_b", sectionId: 4 }];
    mocks.findSyncedEntriesMissingChunks.mockResolvedValue(entryGaps);

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(await res.json()).toMatchObject({ summaryGaps: 0, entryGaps: 1 });
    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("returns 500 and captures the exception when a check throws", async () => {
    const boom = new Error("neon down");
    mocks.findSectionsMissingSummary.mockRejectedValue(boom);

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(500);
    // A broken check must be visible — "no alerts" must never hide "check is broken"
    expect(mocks.captureException).toHaveBeenCalledWith(boom);
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });
});
