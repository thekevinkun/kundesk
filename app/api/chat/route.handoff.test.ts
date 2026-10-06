// Tests for POST /api/chat — PART B: handoff request (step 6b) and human mode (step 7).
// Part A (front door + quota gate) lives in route.test.ts; parts C and D get their own PRs.
// The mock block is duplicated from route.test.ts on purpose: these tests need different
// fake chains (messages inserts, table-aware updates) and a separate file keeps part A untouched.
// Everything is tested through POST; the route's helpers are private to the file.
// NOTE: SQL behaviour (the atomic increment guard, constraints) cannot be verified with
// mocks (rule 262) — these tests pin the control flow, ordering and payloads.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  conversations,
  messages,
  orgs,
  processedWebhooks,
} from "@/lib/db/schema";
import { POST } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  aiMode: "mock" as string,
  openaiApiKey: "sk-test",
  logoUrl: "https://example.com/logo.png",
}));
const m = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  chatLimit: vi.fn(),
  orgLimit: vi.fn(),
  cachedOrg: vi.fn(),
  cachedChatbot: vi.fn(),
  cachedProfile: vi.fn(),
  detectInjection: vi.fn(),
  detectHandoff: vi.fn(),
  createNotification: vi.fn(),
  trackEvent: vi.fn(),
  sendUsageWarningEmail: vi.fn(),
  triggerOrgEvent: vi.fn(),
  triggerConversationMessage: vi.fn(),
  triggerUsageUpdated: vi.fn(),
  retrieveContext: vi.fn(),
  buildSystemPrompt: vi.fn(),
  getBusinessProfileData: vi.fn(),
  // Spies on what the fake chains receive
  selectWhere: vi.fn(),
  markerValues: vi.fn(),
  conversationValues: vi.fn(),
  messageValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));
// State the fake inserts/updates read
const state = vi.hoisted(() => ({
  markerRows: [] as Array<{ id: number }>,
  conversationRows: [] as Array<Record<string, unknown>>,
  messageError: null as Error | null,
  updateErrors: new Map<unknown, Error>(), // keyed by table
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({
  db: {
    select: m.select,
    insert: m.insert,
    update: m.update,
    transaction: m.transaction,
  },
}));
vi.mock("@/lib/posthog", () => ({ trackEvent: m.trackEvent }));
vi.mock("@/lib/email", () => ({
  sendUsageWarningEmail: m.sendUsageWarningEmail,
}));
vi.mock("@/lib/db/queries/dashboard", () => ({
  createNotification: m.createNotification,
}));
vi.mock("@/lib/ai/rag", () => ({
  retrieveContext: m.retrieveContext,
  buildSystemPrompt: m.buildSystemPrompt,
}));
vi.mock("@/lib/db/queries/knowledge", () => ({
  getBusinessProfileData: m.getBusinessProfileData,
}));
vi.mock("@/lib/redis", () => ({
  checkChatRateLimit: m.chatLimit,
  checkOrgMessageLimit: m.orgLimit,
  getCachedOrg: m.cachedOrg,
  getCachedChatbot: m.cachedChatbot,
  getCachedProfile: m.cachedProfile,
}));
vi.mock("@/lib/pusher", () => ({
  triggerOrgEvent: m.triggerOrgEvent,
  triggerConversationMessage: m.triggerConversationMessage,
  triggerUsageUpdated: m.triggerUsageUpdated,
}));
// Detection patterns are covered in helpers/security.test.ts — here only the routing matters
vi.mock("@/helpers/security", () => ({
  detectInjection: m.detectInjection,
  detectHandoffRequest: m.detectHandoff,
}));
// Operators become plain data so tests can assert the exact filters that were built
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  eq: (a: unknown, b: unknown) => ({ op: "eq", a, b }),
  desc: (a: unknown) => ({ op: "desc", a }),
  inArray: (a: unknown, b: unknown) => ({ op: "inArray", a, b }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings,
    values,
  }),
}));
// Columns are just their own names — enough to tell filters apart
vi.mock("@/lib/db/schema", () => ({
  orgs: {
    id: "orgs.id",
    slug: "orgs.slug",
    name: "orgs.name",
    plan: "orgs.plan",
    subscriptionStatus: "orgs.subscriptionStatus",
    messagesUsed: "orgs.messagesUsed",
    messagesLimit: "orgs.messagesLimit",
    ownerEmail: "orgs.ownerEmail",
    timezone: "orgs.timezone",
  },
  chatbots: {
    id: "chatbots.id",
    orgId: "chatbots.orgId",
    language: "chatbots.language",
    systemPrompt: "chatbots.systemPrompt",
    accentColor: "chatbots.accentColor",
    quickReplies: "chatbots.quickReplies",
    isActive: "chatbots.isActive",
  },
  conversations: {
    id: "conversations.id",
    orgId: "conversations.orgId",
    sessionId: "conversations.sessionId",
    channelToken: "conversations.channelToken",
    handoffStatus: "conversations.handoffStatus",
  },
  messages: {
    orgId: "messages.orgId",
    conversationId: "messages.conversationId",
    role: "messages.role",
    content: "messages.content",
    createdAt: "messages.createdAt",
  },
  processedWebhooks: { id: "processedWebhooks.id" },
}));

type Row = Record<string, unknown>;

const ORG = {
  id: "org_a",
  slug: "warung-a",
  name: "Warung A",
  plan: "starter",
  subscriptionStatus: "active",
  messagesUsed: 10,
  messagesLimit: 100,
  ownerEmail: "owner@example.com",
  timezone: "Asia/Jakarta",
};
const CHATBOT = {
  id: 1,
  orgId: "org_a",
  language: "id",
  systemPrompt: null,
  accentColor: "#069494",
  quickReplies: null,
  isActive: true,
};
const ALLOWED = { success: true, remaining: 10, reset: 0 };
const HANDOFF_MESSAGE = "bisa bicara sama orangnya?";
const EXISTING_AI = { id: 7, channelToken: "tok-7", handoffStatus: "ai" };
const EXISTING_HUMAN = { id: 7, channelToken: "tok-7", handoffStatus: "human" };
const EXISTING_PENDING = {
  id: 7,
  channelToken: "tok-7",
  handoffStatus: "pending_handoff",
};

// The SQL fragments the route builds for the guarded counter
const INCREMENT_SET = {
  messagesUsed: expect.objectContaining({
    op: "sql",
    values: [orgs.messagesUsed],
  }),
};
const INCREMENT_WHERE = {
  op: "and",
  args: [
    { op: "eq", a: orgs.id, b: "org_a" },
    expect.objectContaining({
      op: "sql",
      values: [orgs.messagesUsed, orgs.messagesLimit],
    }),
  ],
};
const STATUS_UPDATE_WHERE = {
  op: "and",
  args: [
    { op: "eq", a: conversations.id, b: 7 },
    { op: "eq", a: conversations.orgId, b: "org_a" },
    {
      op: "inArray",
      a: conversations.handoffStatus,
      b: ["ai", "pending_handoff"],
    },
  ],
};

function chatReq(overrides: Row = {}): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message: HANDOFF_MESSAGE,
      sessionId: "sess-1",
      orgSlug: "warung-a",
      ...overrides,
    }),
  });
}

// db.select().from().where().limit() — the conversation lookup is the only select on these paths
function queueConversation(row: Row | null): void {
  m.select.mockReturnValueOnce({
    from: () => ({
      where: (arg: unknown) => {
        m.selectWhere(arg);
        return { limit: () => Promise.resolve(row ? [row] : []) };
      },
    }),
  });
}

// An SSE body "data: {...}\n\ndata: {...}\n\n" → parsed events
async function readEvents(res: Response): Promise<Row[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((part) => JSON.parse(part.replace(/^data: /, "")) as Row);
}

// Invocation order of the first call of a spy that matches — for ordering assertions
function orderOf(
  spy: { mock: { calls: unknown[][]; invocationCallOrder: number[] } },
  match: (args: unknown[]) => boolean,
): number {
  const index = spy.mock.calls.findIndex(match);
  const order = spy.mock.invocationCallOrder[index];
  if (index === -1 || order === undefined) throw new Error("call not found");
  return order;
}

function expectAscending(orders: number[]): void {
  expect([...orders].sort((a, b) => a - b)).toEqual(orders);
}

// Calls of the update spy for one table
function updatesOf(table: unknown): unknown[][] {
  return m.updateSet.mock.calls.filter((call) => call[0] === table);
}

// Lets fire-and-forget work (the background quota check) finish
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("POST /api/chat — handoff request and human mode", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Only fake Date (quota marker keys use the billing month) — real timers keep promises flowing
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockEnv.aiMode = "mock";
    state.markerRows = [{ id: 1 }];
    state.conversationRows = [];
    state.messageError = null;
    state.updateErrors.clear();

    // Happy defaults: allowed, org and chatbot found, nothing detected as injection
    m.chatLimit.mockResolvedValue(ALLOWED);
    m.orgLimit.mockResolvedValue(ALLOWED);
    m.cachedOrg.mockResolvedValue(ORG);
    m.cachedChatbot.mockResolvedValue(CHATBOT);
    m.detectInjection.mockReturnValue(false);
    m.detectHandoff.mockReturnValue(false);
    // The route calls .catch() on all of these, so the defaults must be real promises
    m.createNotification.mockResolvedValue(undefined);
    m.triggerOrgEvent.mockResolvedValue(undefined);
    m.triggerConversationMessage.mockResolvedValue(undefined);
    m.triggerUsageUpdated.mockResolvedValue(undefined);

    // Fake inserts, routed by table
    m.insert.mockImplementation((table: unknown) => {
      if (table === processedWebhooks) {
        return {
          values: (values: Row) => {
            m.markerValues(values);
            return {
              onConflictDoNothing: () => ({
                returning: () => Promise.resolve(state.markerRows),
              }),
            };
          },
        };
      }
      if (table === conversations) {
        return {
          values: (values: Row) => {
            m.conversationValues(values);
            return { returning: () => Promise.resolve(state.conversationRows) };
          },
        };
      }
      if (table === messages) {
        return {
          // Awaited directly by the route
          values: (values: Row) => {
            m.messageValues(values);
            return state.messageError
              ? Promise.reject(state.messageError)
              : Promise.resolve(undefined);
          },
        };
      }
      throw new Error("unexpected table inserted into");
    });

    // Fake updates, routed by table; a table can be made to fail
    m.update.mockImplementation((table: unknown) => ({
      set: (values: Row) => {
        m.updateSet(table, values);
        return {
          where: (arg: unknown) => {
            m.updateWhere(table, arg);
            const error = state.updateErrors.get(table);
            return error ? Promise.reject(error) : Promise.resolve(undefined);
          },
        };
      },
    }));
  });

  afterEach(async () => {
    // Drain background work (quota checks) so it cannot leak into the next test's mocks
    await flush();
    vi.useRealTimers();
  });

  describe("step 6b — handoff request, existing AI conversation", () => {
    beforeEach(() => {
      m.detectHandoff.mockReturnValue(true);
      queueConversation(EXISTING_AI);
    });

    it("checks the customer's raw message for a handoff request", async () => {
      await POST(chatReq({ message: "tolong panggilkan admin" }));

      expect(m.detectHandoff).toHaveBeenCalledWith("tolong panggilkan admin");
    });

    it("moves the conversation to pending_handoff and flags it permanently, scoped to the org and the status", async () => {
      await POST(chatReq());

      expect(m.updateSet).toHaveBeenCalledWith(conversations, {
        handoffStatus: "pending_handoff",
        wasHandedOff: true,
      });
      expect(m.updateWhere).toHaveBeenCalledWith(
        conversations,
        STATUS_UPDATE_WHERE,
      );
      // An existing conversation is never re-created
      expect(m.conversationValues).not.toHaveBeenCalled();
    });

    it("tells the dashboard and the customer's channel, with the right payloads", async () => {
      await POST(chatReq());

      expect(m.triggerOrgEvent).toHaveBeenCalledTimes(1);
      expect(m.triggerOrgEvent).toHaveBeenCalledWith(
        "org_a",
        "conversation:takeover",
        {
          conversationId: 7,
          handoffStatus: "pending_handoff",
        },
      );
      expect(m.triggerConversationMessage).toHaveBeenCalledWith(
        "org_a",
        "tok-7",
        {
          conversationId: 7,
          role: "user",
          content: HANDOFF_MESSAGE,
          handoffStatus: "pending_handoff",
        },
      );
    });

    it("notifies staff with the session prefix and the message", async () => {
      await POST(chatReq({ sessionId: "session-abcdef" }));

      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "pending_handoff",
        "Pelanggan meminta bantuan staff",
        `session-|${HANDOFF_MESSAGE}`,
        7,
      );
    });

    it("truncates a long message to 60 characters plus an ellipsis in the notification", async () => {
      await POST(
        chatReq({ sessionId: "session-abcdef", message: "x".repeat(61) }),
      );

      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "pending_handoff",
        "Pelanggan meminta bantuan staff",
        `session-|${"x".repeat(60)}...`,
        7,
      );
    });

    it("saves the customer's message and counts it with the atomic guard", async () => {
      await POST(chatReq());

      expect(m.messageValues).toHaveBeenCalledWith({
        orgId: "org_a",
        conversationId: 7,
        role: "user",
        content: HANDOFF_MESSAGE,
      });
      expect(m.updateSet).toHaveBeenCalledWith(orgs, INCREMENT_SET);
      expect(m.updateWhere).toHaveBeenCalledWith(orgs, INCREMENT_WHERE);
    });

    it("fires the usage event with an optimistic count (cached count + 1)", async () => {
      await POST(chatReq());

      expect(m.triggerUsageUpdated).toHaveBeenCalledWith("org_a", {
        messagesUsed: 11,
        messagesLimit: 100,
      });
    });

    it("answers with a holding message and the pending_handoff state", async () => {
      const res = await POST(chatReq());

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      const events = await readEvents(res);
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        token: expect.stringContaining("menghubungkan kakak dengan staff"),
      });
      expect(events[1]).toEqual({
        done: true,
        conversationId: 7,
        channelToken: "tok-7",
        handoffStatus: "pending_handoff",
      });
    });

    it("never calls the AI path: no quota re-read, no RAG, no prompt", async () => {
      await POST(chatReq());

      // Only the conversation lookup ran — the quota gate (step 8) is bypassed
      expect(m.select).toHaveBeenCalledTimes(1);
      expect(m.retrieveContext).not.toHaveBeenCalled();
      expect(m.buildSystemPrompt).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
    });

    it("tracks handoff_requested for an existing conversation", async () => {
      await POST(chatReq());

      expect(m.trackEvent).toHaveBeenCalledWith("org_a", "handoff_requested", {
        delivery_channel: "web_widget",
        is_new_conversation: false,
      });
    });

    // CHARACTERIZATION — on this path the conversation's status UPDATE is awaited BEFORE any
    // Pusher event; only the message save and the counter come after Pusher. (The earlier
    // conversation lookup has already woken the database by then.)
    it("runs in the real order: status update → Pusher events → notification → message save → counter → usage event", async () => {
      await POST(chatReq());

      expectAscending([
        orderOf(m.updateSet, (call) => call[0] === conversations),
        orderOf(m.triggerOrgEvent, () => true),
        orderOf(m.triggerConversationMessage, () => true),
        orderOf(m.createNotification, (call) => call[1] === "pending_handoff"),
        orderOf(m.messageValues, () => true),
        orderOf(m.updateSet, (call) => call[0] === orgs),
        orderOf(m.triggerUsageUpdated, () => true),
      ]);
    });
  });

  describe("step 6b — handoff request, first message (no conversation yet)", () => {
    beforeEach(() => {
      m.detectHandoff.mockReturnValue(true);
      queueConversation(null);
      state.conversationRows = [{ id: 42, channelToken: "tok-new" }];
    });

    it("creates the conversation directly as pending_handoff and flagged", async () => {
      await POST(chatReq());

      expect(m.conversationValues).toHaveBeenCalledWith({
        orgId: "org_a",
        sessionId: "sess-1",
        deliveryChannel: "web_widget",
        handoffStatus: "pending_handoff",
        wasHandedOff: true,
        channelToken: expect.any(String),
      });
      // Nothing to update — the row is created in its final state
      expect(updatesOf(conversations)).toHaveLength(0);
    });

    it("uses the new conversation's id and token in the events and the response", async () => {
      const res = await POST(chatReq());

      expect(m.triggerOrgEvent).toHaveBeenCalledWith(
        "org_a",
        "conversation:takeover",
        {
          conversationId: 42,
          handoffStatus: "pending_handoff",
        },
      );
      expect(m.triggerConversationMessage).toHaveBeenCalledWith(
        "org_a",
        "tok-new",
        expect.objectContaining({
          conversationId: 42,
          handoffStatus: "pending_handoff",
        }),
      );
      expect(m.messageValues).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 42, role: "user" }),
      );
      const events = await readEvents(res);
      expect(events[1]).toEqual({
        done: true,
        conversationId: 42,
        channelToken: "tok-new",
        handoffStatus: "pending_handoff",
      });
    });

    it("tracks handoff_requested as a new conversation", async () => {
      await POST(chatReq());

      expect(m.trackEvent).toHaveBeenCalledWith("org_a", "handoff_requested", {
        delivery_channel: "web_widget",
        is_new_conversation: true,
      });
    });

    // CHARACTERIZATION — unlike a normal first message, this path never fires conversation:new
    // or the conversation_new notification; the dashboard learns only through the takeover
    // event and the pending_handoff notification
    it("fires only the takeover event and the pending_handoff notification, never conversation:new", async () => {
      await POST(chatReq());

      expect(m.triggerOrgEvent).toHaveBeenCalledTimes(1);
      expect(m.createNotification).toHaveBeenCalledTimes(1);
      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "pending_handoff",
        expect.any(String),
        expect.any(String),
        42,
      );
    });

    it("answers 500 and does nothing else when the conversation insert returns no row", async () => {
      state.conversationRows = [];

      const res = await POST(chatReq());

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to create conversation",
      });
      expect(m.triggerOrgEvent).not.toHaveBeenCalled();
      expect(m.triggerConversationMessage).not.toHaveBeenCalled();
      expect(m.messageValues).not.toHaveBeenCalled();
      expect(updatesOf(orgs)).toHaveLength(0);
    });
  });

  describe("step 6b — quota bypass (rule 70)", () => {
    beforeEach(() => {
      m.detectHandoff.mockReturnValue(true);
      queueConversation(EXISTING_AI);
    });

    it("a full quota never blocks a handoff request: no 402, no quota re-read, message saved and counted", async () => {
      m.cachedOrg.mockResolvedValue({
        ...ORG,
        messagesUsed: 100,
        messagesLimit: 100,
      });

      const res = await POST(chatReq());

      expect(res.status).toBe(200);
      expect(m.select).toHaveBeenCalledTimes(1);
      expect(m.messageValues).toHaveBeenCalledTimes(1);
      // The SQL guard (messagesUsed < messagesLimit) decides whether the counter moves
      expect(m.updateSet).toHaveBeenCalledWith(orgs, INCREMENT_SET);
    });

    // CHARACTERIZATION — the live count is optimistic (cached + 1), so at the limit the
    // dashboard is told 101 of 100 until its next refetch corrects it
    it("at the limit the usage event reports an optimistic count above the limit", async () => {
      m.cachedOrg.mockResolvedValue({
        ...ORG,
        messagesUsed: 100,
        messagesLimit: 100,
      });

      await POST(chatReq());

      expect(m.triggerUsageUpdated).toHaveBeenCalledWith("org_a", {
        messagesUsed: 101,
        messagesLimit: 100,
      });
    });

    it("crossing 80% in the background sends the quota-warning notification once", async () => {
      m.cachedOrg.mockResolvedValue({
        ...ORG,
        messagesUsed: 79,
        messagesLimit: 100,
      });

      await POST(chatReq());
      await flush();

      expect(m.markerValues).toHaveBeenCalledWith({
        externalId: "QUOTA-WARN-org_a-2026-10",
        source: "system",
      });
      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "quota_warning",
        "Kuota pesan hampir habis",
        "80 dari 100 pesan telah digunakan bulan ini",
      );
    });
  });

  describe("step 6b — failures", () => {
    beforeEach(() => {
      m.detectHandoff.mockReturnValue(true);
      queueConversation(EXISTING_AI);
    });

    it("a failing Pusher call never changes the response, and the message is still saved", async () => {
      m.triggerOrgEvent.mockRejectedValueOnce(new Error("pusher down"));

      const res = await POST(chatReq());

      expect(res.status).toBe(200);
      expect(m.messageValues).toHaveBeenCalledTimes(1);
    });

    it("a failing staff notification never changes the response", async () => {
      m.createNotification.mockRejectedValueOnce(new Error("db down"));

      const res = await POST(chatReq());

      expect(res.status).toBe(200);
      expect(m.messageValues).toHaveBeenCalledTimes(1);
    });

    it("a failing status update fails the request before anything is pushed or saved", async () => {
      state.updateErrors.set(conversations, new Error("neon timeout"));

      await expect(POST(chatReq())).rejects.toThrow("neon timeout");

      expect(m.triggerOrgEvent).not.toHaveBeenCalled();
      expect(m.messageValues).not.toHaveBeenCalled();
    });

    // CHARACTERIZATION — Pusher runs before the message save, so a failed save leaves staff
    // with a notification and a live message that were never stored; the request then fails
    // and the counter is not incremented
    it("a failing message save fails the request AFTER staff were already told, with no counter and no usage event", async () => {
      state.messageError = new Error("neon timeout");

      await expect(POST(chatReq())).rejects.toThrow("neon timeout");

      expect(m.triggerOrgEvent).toHaveBeenCalledTimes(1);
      expect(m.triggerConversationMessage).toHaveBeenCalledTimes(1);
      expect(m.createNotification).toHaveBeenCalledTimes(1);
      expect(updatesOf(orgs)).toHaveLength(0);
      expect(m.triggerUsageUpdated).not.toHaveBeenCalled();
    });
  });

  describe("handoff keyword on a conversation that is already with staff (rule 94)", () => {
    beforeEach(() => {
      m.detectHandoff.mockReturnValue(true);
    });

    it.each([
      ["pending_handoff", EXISTING_PENDING],
      ["human", EXISTING_HUMAN],
    ])(
      "a %s conversation is not handed off again: no status update, no takeover event, no notification",
      async (status, existing) => {
        queueConversation(existing);

        const res = await POST(chatReq());

        expect(updatesOf(conversations)).toHaveLength(0);
        expect(m.triggerOrgEvent).not.toHaveBeenCalled();
        expect(m.createNotification).not.toHaveBeenCalled();
        expect(m.trackEvent).not.toHaveBeenCalled();
        // It falls through to human mode (step 7)
        expect(await readEvents(res)).toEqual([
          {
            done: true,
            conversationId: 7,
            channelToken: "tok-7",
            handoffStatus: status,
          },
        ]);
      },
    );
  });

  describe("step 7 — human mode (message to a conversation already with staff)", () => {
    beforeEach(() => {
      queueConversation(EXISTING_HUMAN);
    });

    it("pushes the customer's message to the conversation channel with the current handoff status", async () => {
      await POST(chatReq({ message: "halo kak" }));

      expect(m.triggerConversationMessage).toHaveBeenCalledWith(
        "org_a",
        "tok-7",
        {
          conversationId: 7,
          role: "user",
          content: "halo kak",
          handoffStatus: "human",
        },
      );
    });

    it("uses pending_handoff as the status while staff has not taken over yet", async () => {
      m.select.mockReset();
      queueConversation(EXISTING_PENDING);

      const res = await POST(chatReq({ message: "halo kak" }));

      expect(m.triggerConversationMessage).toHaveBeenCalledWith(
        "org_a",
        "tok-7",
        expect.objectContaining({ handoffStatus: "pending_handoff" }),
      );
      expect(await readEvents(res)).toEqual([
        {
          done: true,
          conversationId: 7,
          channelToken: "tok-7",
          handoffStatus: "pending_handoff",
        },
      ]);
    });

    it("saves the message and counts it with the atomic guard", async () => {
      await POST(chatReq({ message: "halo kak" }));

      expect(m.messageValues).toHaveBeenCalledWith({
        orgId: "org_a",
        conversationId: 7,
        role: "user",
        content: "halo kak",
      });
      expect(m.updateSet).toHaveBeenCalledWith(orgs, INCREMENT_SET);
      expect(m.updateWhere).toHaveBeenCalledWith(orgs, INCREMENT_WHERE);
    });

    it("answers silently: only a done event carrying the handoff state, no AI token", async () => {
      const res = await POST(chatReq({ message: "halo kak" }));

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(await readEvents(res)).toEqual([
        {
          done: true,
          conversationId: 7,
          channelToken: "tok-7",
          handoffStatus: "human",
        },
      ]);
    });

    it("does no AI work and fires no dashboard-wide event or notification", async () => {
      await POST(chatReq({ message: "halo kak" }));

      // Only the conversation lookup ran — the quota gate (step 8) is bypassed
      expect(m.select).toHaveBeenCalledTimes(1);
      expect(m.retrieveContext).not.toHaveBeenCalled();
      expect(m.buildSystemPrompt).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
      expect(m.conversationValues).not.toHaveBeenCalled();
      expect(updatesOf(conversations)).toHaveLength(0);
      expect(m.triggerOrgEvent).not.toHaveBeenCalled();
      expect(m.createNotification).not.toHaveBeenCalled();
      expect(m.trackEvent).not.toHaveBeenCalled();
    });

    it("fires the usage event with an optimistic count (cached count + 1)", async () => {
      await POST(chatReq({ message: "halo kak" }));

      expect(m.triggerUsageUpdated).toHaveBeenCalledWith("org_a", {
        messagesUsed: 11,
        messagesLimit: 100,
      });
    });

    it("runs in the real order: Pusher message → usage event → message save → counter", async () => {
      await POST(chatReq({ message: "halo kak" }));

      expectAscending([
        orderOf(m.triggerConversationMessage, () => true),
        orderOf(m.triggerUsageUpdated, () => true),
        orderOf(m.messageValues, () => true),
        orderOf(m.updateSet, (call) => call[0] === orgs),
      ]);
    });

    it("a full quota never blocks a customer talking to staff (rule 70): no 402, no quota re-read", async () => {
      m.cachedOrg.mockResolvedValue({
        ...ORG,
        messagesUsed: 100,
        messagesLimit: 100,
      });

      const res = await POST(chatReq({ message: "halo kak" }));

      expect(res.status).toBe(200);
      expect(m.select).toHaveBeenCalledTimes(1);
      expect(m.messageValues).toHaveBeenCalledTimes(1);
      expect(m.updateSet).toHaveBeenCalledWith(orgs, INCREMENT_SET);
    });

    describe("failures", () => {
      it("a failing Pusher call never changes the response, and the message is still saved", async () => {
        m.triggerConversationMessage.mockRejectedValueOnce(
          new Error("pusher down"),
        );

        const res = await POST(chatReq({ message: "halo kak" }));

        expect(res.status).toBe(200);
        expect(m.messageValues).toHaveBeenCalledTimes(1);
      });

      // CHARACTERIZATION — Pusher and the usage event run before the save, so a failed save
      // leaves staff looking at a message that was never stored; the counter is not incremented
      it("a failing message save fails the request AFTER staff saw the message and the usage event fired", async () => {
        state.messageError = new Error("neon timeout");

        await expect(POST(chatReq({ message: "halo kak" }))).rejects.toThrow(
          "neon timeout",
        );

        expect(m.triggerConversationMessage).toHaveBeenCalledTimes(1);
        expect(m.triggerUsageUpdated).toHaveBeenCalledTimes(1);
        expect(updatesOf(orgs)).toHaveLength(0);
      });

      // CHARACTERIZATION — the message is already saved when the counter fails, yet the
      // request still fails
      it("a failing counter increment fails the request even though the message was saved", async () => {
        state.updateErrors.set(orgs, new Error("neon timeout"));

        await expect(POST(chatReq({ message: "halo kak" }))).rejects.toThrow(
          "neon timeout",
        );

        expect(m.messageValues).toHaveBeenCalledTimes(1);
      });
    });
  });
});
