// Tests for the org-purge cron — permanent deletion after the 30-day grace period
// NOTE: the eligibility filters (deletionRequestedAt <= cutoff, purgingAt IS NULL) live in
// SQL conditions, which a mocked Drizzle chain cannot verify (rule 262) — these tests cover
// the route's control flow: auth, claim, Clerk-then-DB order, error handling, batching.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({ cronSecret: "test-cron-secret" }));
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
const claimSet = vi.hoisted(() => vi.fn());
const deleteOrganization = vi.hoisted(() => vi.fn());
const txDeleteWhere = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
// clerkClient is async in the route (`await clerkClient()`) — a plain async fn is enough
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ organizations: { deleteOrganization } }),
}));

// Fixed "now" so the purgingAt stamp is deterministic
const NOW = new Date("2026-10-05T20:00:00.000Z");

// A claim older than the 6-hour cutoff — what an abandoned claim looks like in the snapshot
const STALE_CLAIM = new Date("2026-10-05T06:00:00.000Z");

// Queue the candidate snapshot (the first db.select() in the route).
// staleIds = candidates that already carry an old claim (a takeover)
function mockCandidates(ids: string[], staleIds: string[] = []): void {
  mockDb.select.mockReturnValueOnce({
    from: () => ({
      where: () =>
        Promise.resolve(
          ids.map((id) => ({
            id,
            purgingAt: staleIds.includes(id) ? STALE_CLAIM : null,
          })),
        ),
    }),
  });
}

// Queue one claim result per org, in the order the route claims them:
// [{ id }] = claim won, [] = org no longer eligible
function queueClaims(results: Array<Array<{ id: string }>>): void {
  for (const rows of results) {
    mockDb.update.mockReturnValueOnce({
      set: (values: Record<string, unknown>) => {
        claimSet(values);
        return { where: () => ({ returning: () => Promise.resolve(rows) }) };
      },
    });
  }
}

function makeReq(secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/org-purge", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

type RouteBody = {
  message: string;
  processed: number;
  failed: number;
  retriedStale: number;
};

async function run(): Promise<RouteBody> {
  const res = await GET(makeReq(mockEnv.cronSecret));
  return (await res.json()) as RouteBody;
}

// An error shaped like Clerk's API errors: an Error carrying an HTTP status
function clerkError(status: number): Error {
  return Object.assign(new Error(`clerk ${status}`), { status });
}

describe("GET /api/cron/org-purge", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Only fake Date — real timers keep promises flowing
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    // Silence route logging; keep a handle on console.error for assertions
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Happy defaults: Clerk delete succeeds, DB transaction runs its callback
    deleteOrganization.mockResolvedValue(undefined);
    txDeleteWhere.mockResolvedValue(undefined);
    mockDb.transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ delete: () => ({ where: txDeleteWhere }) }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("auth", () => {
    it("rejects a missing authorization header with 401", async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(401);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret with 401", async () => {
      const res = await GET(makeReq("wrong-secret"));
      expect(res.status).toBe(401);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  it("returns processed 0 and deletes nothing when no org is due", async () => {
    mockCandidates([]);
    const body = await run();
    expect(body.processed).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(deleteOrganization).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  describe("happy path", () => {
    it("claims the org, deletes it from Clerk, then deletes the DB row", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      const body = await run();

      expect(body.processed).toBe(1);
      expect(body.failed).toBe(0);
      // A fresh claim is not a takeover
      expect(body.retriedStale).toBe(0);
      // The claim stamps purgingAt with the current time
      expect(claimSet).toHaveBeenCalledWith({ purgingAt: NOW });
      expect(deleteOrganization).toHaveBeenCalledWith("org_a");
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(txDeleteWhere).toHaveBeenCalledTimes(1);
    });

    it("runs in the safe order: claim → Clerk delete → DB delete", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      await run();
      const order = [
        mockDb.update.mock.invocationCallOrder[0],
        deleteOrganization.mock.invocationCallOrder[0],
        mockDb.transaction.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });

  describe("claim", () => {
    it("skips an org that is no longer eligible (e.g. admin cancelled) and deletes nothing", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[]]);
      const body = await run();
      expect(body.processed).toBe(0);
      expect(deleteOrganization).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("takes over an abandoned claim and counts it", async () => {
      // org_a already carries an old purgingAt in the snapshot
      mockCandidates(["org_a"], ["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      const body = await run();
      expect(body.processed).toBe(1);
      expect(body.retriedStale).toBe(1);
      expect(deleteOrganization).toHaveBeenCalledWith("org_a");
    });

    it("does not count a takeover that lost the race", async () => {
      // Another run took the stale claim first, so ours matches no row
      mockCandidates(["org_a"], ["org_a"]);
      queueClaims([[]]);
      const body = await run();
      expect(body.processed).toBe(0);
      expect(body.retriedStale).toBe(0);
      expect(deleteOrganization).not.toHaveBeenCalled();
    });

    it("a failing claim UPDATE is reported with step 'claim' and nothing is deleted", async () => {
      mockCandidates(["org_a"]);
      mockDb.update.mockImplementationOnce(() => {
        throw new Error("neon timeout");
      });
      const body = await run();
      expect(body.failed).toBe(1);
      expect(deleteOrganization).not.toHaveBeenCalled();
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { cron: "org-purge", step: "claim" },
        }),
      );
    });
  });

  describe("Clerk errors", () => {
    it("treats an already-missing Clerk org (404) as success and still deletes the DB row", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      deleteOrganization.mockRejectedValueOnce(clerkError(404));
      const body = await run();
      expect(body.processed).toBe(1);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(captureException).not.toHaveBeenCalled();
    });

    // Flipped from CHARACTERIZATION (rule 281). The claim is KEPT on purpose — releasing it could
    // let cancelOrgDeletion restore an org that is already gone from Clerk. The next run takes it
    // over once it is stale, and the failure is reported to Sentry now.
    it("on a non-404 Clerk error: no DB delete, claim kept, failure sent to Sentry with step 'clerk'", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      deleteOrganization.mockRejectedValueOnce(clerkError(500));
      const body = await run();
      expect(body.processed).toBe(0);
      expect(body.failed).toBe(1);
      expect(mockDb.transaction).not.toHaveBeenCalled();
      // Only the claim UPDATE ran — the claim is deliberately not released
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { cron: "org-purge", step: "clerk" },
          extra: { orgId: "org_a", action: "org-purge" },
        }),
      );
    });

    it("does not treat an error without a 404 status as already-deleted", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      deleteOrganization.mockRejectedValueOnce(new Error("network down"));
      const body = await run();
      expect(body.processed).toBe(0);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("DB errors", () => {
    // Flipped from CHARACTERIZATION (rule 281): Clerk is already gone here, so the claim must
    // stay — the next run retries safely (the Clerk 404 counts as success) after it goes stale
    it("when the DB transaction fails after Clerk deletion: not counted, reported with step 'db'", async () => {
      mockCandidates(["org_a"]);
      queueClaims([[{ id: "org_a" }]]);
      mockDb.transaction.mockRejectedValueOnce(new Error("neon timeout"));
      const body = await run();
      expect(body.processed).toBe(0);
      expect(body.failed).toBe(1);
      expect(deleteOrganization).toHaveBeenCalledWith("org_a");
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { cron: "org-purge", step: "db" },
        }),
      );
    });
  });

  describe("batch behaviour", () => {
    it("a Clerk failure on one org does not stop the next", async () => {
      mockCandidates(["org_a", "org_b"]);
      queueClaims([[{ id: "org_a" }], [{ id: "org_b" }]]);
      deleteOrganization
        .mockRejectedValueOnce(clerkError(500))
        .mockResolvedValueOnce(undefined);
      const body = await run();
      expect(body.processed).toBe(1);
      expect(body.failed).toBe(1);
      expect(deleteOrganization).toHaveBeenCalledTimes(2);
      expect(deleteOrganization).toHaveBeenLastCalledWith("org_b");
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("a lost claim on one org does not stop the next", async () => {
      mockCandidates(["org_a", "org_b"]);
      queueClaims([[], [{ id: "org_b" }]]);
      const body = await run();
      expect(body.processed).toBe(1);
      expect(deleteOrganization).toHaveBeenCalledTimes(1);
      expect(deleteOrganization).toHaveBeenCalledWith("org_b");
    });

    it("counts every org it purges", async () => {
      mockCandidates(["org_a", "org_b", "org_c"]);
      queueClaims([[{ id: "org_a" }], [{ id: "org_b" }], [{ id: "org_c" }]]);
      const body = await run();
      expect(body.processed).toBe(3);
      expect(mockDb.transaction).toHaveBeenCalledTimes(3);
    });
  });

  describe("candidate query failure", () => {
    it("alerts Sentry and answers 500 instead of looking like 'nothing to do'", async () => {
      mockDb.select.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.reject(new Error("neon down")),
        }),
      });
      const res = await GET(makeReq(mockEnv.cronSecret));
      expect(res.status).toBe(500);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(deleteOrganization).not.toHaveBeenCalled();
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { cron: "org-purge", step: "candidates" },
        }),
      );
    });
  });
});
