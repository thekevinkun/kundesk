// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mutable state shared with the fake database — reset in beforeEach
const mocks = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  triggerConversationMessage: vi.fn(),
  triggerOrgEvent: vi.fn(),
  state: {
    rows: [] as Array<{ handoffStatus: string; channelToken: string }>,
    setCalls: [] as unknown[],
    insertCalls: [] as unknown[],
  },
}));

vi.mock("@/lib/auth", () => ({ requireOrg: mocks.requireOrg }));
vi.mock("@/lib/pusher", () => ({
  triggerConversationMessage: mocks.triggerConversationMessage,
  triggerOrgEvent: mocks.triggerOrgEvent,
}));
// Drizzle operators and schema columns as plain data — the route is tested through its handler only
vi.mock("drizzle-orm", () => ({
  and: (...parts: unknown[]) => ({ and: parts }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
}));
vi.mock("@/lib/db/schema", () => ({
  conversations: {
    id: "id",
    orgId: "orgId",
    handoffStatus: "handoffStatus",
    channelToken: "channelToken",
  },
  messages: {},
}));
// Fake transaction: select → configured rows, update → recorded, insert → recorded
vi.mock("@/lib/db", () => {
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({ for: async () => mocks.state.rows }),
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        mocks.state.setCalls.push(values);
        return { where: async () => undefined };
      },
    }),
    insert: () => ({
      values: async (values: unknown) => {
        mocks.state.insertCalls.push(values);
      },
    }),
  };
  return {
    db: {
      transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    },
  };
});

import { POST } from "./route";

// Build a POST request and route params like Next does
const call = (id: string, body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/conversations/${id}/reply`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  );

describe("POST /api/conversations/[id]/reply", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.state.rows = [];
    mocks.state.setCalls = [];
    mocks.state.insertCalls = [];
    mocks.requireOrg.mockResolvedValue({
      orgId: "org_1",
      userId: "user_staff",
    });
    mocks.triggerConversationMessage.mockResolvedValue(undefined);
    mocks.triggerOrgEvent.mockResolvedValue(undefined);
  });

  it("records the replying staff member when the first reply takes over", async () => {
    mocks.state.rows = [
      { handoffStatus: "pending_handoff", channelToken: "tok_1" },
    ];

    const response = await call("5", { content: "Halo" });

    expect(response.status).toBe(200);
    expect(mocks.state.setCalls).toHaveLength(1);
    expect(mocks.state.setCalls[0]).toMatchObject({
      handoffStatus: "human",
      takenOverBy: "user_staff",
    });
    expect(
      (mocks.state.setCalls[0] as { takenOverAt: unknown }).takenOverAt,
    ).toBeInstanceOf(Date);
    expect(mocks.state.insertCalls[0]).toMatchObject({
      orgId: "org_1",
      conversationId: 5,
      role: "human_agent",
      content: "Halo",
    });
  });

  it("announces the takeover to the dashboard with the staff member", async () => {
    mocks.state.rows = [
      { handoffStatus: "pending_handoff", channelToken: "tok_1" },
    ];

    await call("5", { content: "Halo" });

    expect(mocks.triggerOrgEvent).toHaveBeenCalledWith(
      "org_1",
      "conversation:takeover",
      {
        conversationId: 5,
        takenOverBy: "user_staff",
        handoffStatus: "human",
      },
    );
  });

  it("tells the customer widget the status is human", async () => {
    mocks.state.rows = [
      { handoffStatus: "pending_handoff", channelToken: "tok_1" },
    ];

    await call("5", { content: "Halo" });

    expect(mocks.triggerConversationMessage).toHaveBeenCalledWith(
      "org_1",
      "tok_1",
      {
        conversationId: 5,
        role: "human_agent",
        content: "Halo",
        handoffStatus: "human",
      },
    );
  });

  it("does not overwrite the taker when the conversation is already human", async () => {
    mocks.state.rows = [{ handoffStatus: "human", channelToken: "tok_1" }];

    const response = await call("5", { content: "Halo lagi" });

    expect(response.status).toBe(200);
    expect(mocks.state.setCalls).toHaveLength(0);
    expect(mocks.triggerOrgEvent).not.toHaveBeenCalled();
    expect(mocks.state.insertCalls).toHaveLength(1);
  });

  it("refuses a reply while KUN is handling the conversation", async () => {
    mocks.state.rows = [{ handoffStatus: "ai", channelToken: "tok_1" }];

    const response = await call("5", { content: "Halo" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Conversation is not in human handoff mode",
    });
    expect(mocks.state.insertCalls).toHaveLength(0);
    expect(mocks.state.setCalls).toHaveLength(0);
  });

  it("answers 404 when the conversation is missing or belongs to another org", async () => {
    mocks.state.rows = [];

    const response = await call("5", { content: "Halo" });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: "Conversation not found",
    });
    expect(mocks.state.insertCalls).toHaveLength(0);
  });

  it("rejects a non-numeric conversation id before touching the database", async () => {
    const response = await call("abc", { content: "Halo" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid conversation ID",
    });
    expect(mocks.state.insertCalls).toHaveLength(0);
  });

  it("rejects invalid JSON, empty content and content over 500 characters", async () => {
    const badJson = await call("5", "{not json");
    const empty = await call("5", { content: "" });
    const tooLong = await call("5", { content: "x".repeat(501) });

    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toMatchObject({ error: "Invalid JSON body" });
    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toMatchObject({
      error: "Content is required (max 500 chars)",
    });
    expect(mocks.state.insertCalls).toHaveLength(0);
  });
});
