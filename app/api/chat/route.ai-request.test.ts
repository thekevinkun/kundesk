// Tests for POST /api/chat — PART C: building the AI request (steps 9–12):
// conversation resolve/create, history, RAG + profile lookups, buildSystemPrompt arguments.
// Parts A (front door + quota gate) and B (handoff + human paths) live in their own files;
// part D covers what the stream does (tokens, errors, the post-stream transaction).
// The route runs in "openai" mode with a mocked SDK that returns an EMPTY stream, so the request
// reaches the model call and we can assert on the exact messages sent, without testing the stream.
// The mock block is duplicated from the other route test files on purpose.
// NOTE: SQL behaviour cannot be verified with mocks (rule 262) — these tests pin control flow,
// ordering and what is passed to each collaborator.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { conversations, messages, processedWebhooks } from "@/lib/db/schema";
import { POST } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  aiMode: "openai" as string,
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
  openaiCreate: vi.fn(),
  openaiCtor: vi.fn(),
  // Spies on what the fake chains receive
  selectWhere: vi.fn(),
  historyOrderBy: vi.fn(),
  historyLimit: vi.fn(),
  markerValues: vi.fn(),
  conversationValues: vi.fn(),
}));
// Rows the fake inserts resolve to
const state = vi.hoisted(() => ({
  markerRows: [] as Array<{ id: number }>,
  conversationRows: [] as Array<Record<string, unknown>>,
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
// The OpenAI SDK — the route imports it dynamically and builds `new OpenAI({ apiKey })`.
// Real classes inside the factory, because the route uses `new` and `instanceof` (rules 20, 163)
vi.mock("openai", () => {
  class OpenAI {
    chat = { completions: { create: m.openaiCreate } };
    constructor(options: unknown) {
      m.openaiCtor(options);
    }
  }
  class APIConnectionError extends Error {}
  class APIConnectionTimeoutError extends Error {}
  return { default: OpenAI, APIConnectionError, APIConnectionTimeoutError };
});
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

const MESSAGE = "Jam buka hari ini?";
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
const OK_QUOTA = [{ messagesUsed: 10, messagesLimit: 100 }];
const EXISTING_AI = { id: 7, channelToken: "tok-7", handoffStatus: "ai" };
const NEW_CONVERSATION = { id: 42, channelToken: "tok-new" };

function chatReq(overrides: Row = {}): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message: MESSAGE,
      sessionId: "sess-1",
      orgSlug: "warung-a",
      ...overrides,
    }),
  });
}

// db.select().from().where().limit() — the conversation lookup and the quota re-read
function queueSelect(rows: Row[]): void {
  m.select.mockReturnValueOnce({
    from: () => ({
      where: (arg: unknown) => {
        m.selectWhere(arg);
        return { limit: () => Promise.resolve(rows) };
      },
    }),
  });
}

// db.select().from().where().orderBy().limit() — the history query
function queueHistory(rows: Row[]): void {
  m.select.mockReturnValueOnce({
    from: () => ({
      where: (arg: unknown) => {
        m.selectWhere(arg);
        return {
          orderBy: (order: unknown) => {
            m.historyOrderBy(order);
            return {
              limit: (count: number) => {
                m.historyLimit(count);
                return Promise.resolve(rows);
              },
            };
          },
        };
      },
    }),
  });
}

// The three selects every request that reaches the AI path makes, in call order:
// conversation lookup, fresh quota re-read, history
function setup(
  conversation: Row | null,
  history: Row[],
  quota: Row[] = OK_QUOTA,
): void {
  queueSelect(conversation ? [conversation] : []);
  queueSelect(quota);
  queueHistory(history);
}

// An async iterable shaped like the OpenAI streaming response
function streamOf(tokens: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) {
        yield { choices: [{ delta: { content: token } }] };
      }
    },
  };
}

// An SSE body "data: {...}\n\ndata: {...}\n\n" → parsed events
async function readEvents(res: Response): Promise<Row[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((part) => JSON.parse(part.replace(/^data: /, "")) as Row);
}

// Sends the request and reads the whole response, so the model call has happened
async function send(
  overrides: Row = {},
): Promise<{ res: Response; events: Row[] }> {
  const res = await POST(chatReq(overrides));
  return { res, events: await readEvents(res) };
}

// The second element (type / event name) of every call to a spy
function secondArgs(spy: { mock: { calls: unknown[][] } }): unknown[] {
  return spy.mock.calls.map((call) => call[1]);
}

function expectAscending(orders: Array<number | undefined>): void {
  const defined = orders as number[];
  expect([...defined].sort((a, b) => a - b)).toEqual(defined);
}

// Waits (without fake timers) until a condition holds — for tests that need a request mid-flight
async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Lets fire-and-forget work (post-stream events, quota checks) finish
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("POST /api/chat — building the AI request", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Only fake Date — real timers keep promises flowing
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockEnv.aiMode = "openai";
    state.markerRows = [{ id: 1 }];
    state.conversationRows = [];

    // Happy defaults: allowed, org and chatbot found, nothing detected
    m.chatLimit.mockResolvedValue(ALLOWED);
    m.orgLimit.mockResolvedValue(ALLOWED);
    m.cachedOrg.mockResolvedValue(ORG);
    m.cachedChatbot.mockResolvedValue(CHATBOT);
    m.detectInjection.mockReturnValue(false);
    m.detectHandoff.mockReturnValue(false);
    // The route calls .catch() on these, so the defaults must be real promises
    m.createNotification.mockResolvedValue(undefined);
    m.triggerOrgEvent.mockResolvedValue(undefined);
    m.triggerConversationMessage.mockResolvedValue(undefined);
    m.triggerUsageUpdated.mockResolvedValue(undefined);
    // The AI collaborators
    m.retrieveContext.mockResolvedValue([]);
    m.cachedProfile.mockResolvedValue({ block: null, hours: [] });
    m.buildSystemPrompt.mockReturnValue("SYSTEM PROMPT");
    m.openaiCreate.mockResolvedValue(streamOf([]));

    // Fake inserts: only the tables this path may touch. Anything else throws, so an unexpected
    // write (e.g. saving the customer's message before streaming) would fail the test.
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
      throw new Error("unexpected table inserted into");
    });
  });

  afterEach(async () => {
    // Drain background work (post-stream events, quota checks) so it cannot leak into the next test
    await flush();
    vi.useRealTimers();
  });

  describe("step 9 — existing conversation", () => {
    beforeEach(() => {
      setup(EXISTING_AI, []);
    });

    it("reuses the conversation: no insert, and the response carries its id and token", async () => {
      const { events } = await send();

      expect(m.conversationValues).not.toHaveBeenCalled();
      expect(events[events.length - 1]).toEqual({
        done: true,
        conversationId: 7,
        channelToken: "tok-7",
      });
    });

    it("announces nothing: no new-conversation event, notification or tracking", async () => {
      await send();

      expect(secondArgs(m.triggerOrgEvent)).not.toContain("conversation:new");
      expect(secondArgs(m.createNotification)).not.toContain(
        "conversation_new",
      );
      expect(secondArgs(m.trackEvent)).not.toContain("conversation_started");
    });
  });

  describe("step 9 — first message (new conversation)", () => {
    beforeEach(() => {
      state.conversationRows = [NEW_CONVERSATION];
      setup(null, []);
    });

    it("creates an AI-mode conversation with an unguessable channel token", async () => {
      await send();

      expect(m.conversationValues).toHaveBeenCalledTimes(1);
      expect(m.conversationValues).toHaveBeenCalledWith({
        orgId: "org_a",
        sessionId: "sess-1",
        deliveryChannel: "web_widget",
        handoffStatus: "ai",
        channelToken: expect.stringMatching(/^[0-9a-f-]{36}$/),
      });
    });

    it("uses the new id and token in the history query and in the response", async () => {
      const { events } = await send();

      // History is read for the NEW conversation id (the third select)
      expect(m.selectWhere).toHaveBeenNthCalledWith(3, {
        op: "and",
        args: [
          { op: "eq", a: messages.orgId, b: "org_a" },
          { op: "eq", a: messages.conversationId, b: 42 },
        ],
      });
      expect(events[events.length - 1]).toEqual({
        done: true,
        conversationId: 42,
        channelToken: "tok-new",
      });
    });

    it("tracks the new conversation and tells the dashboard", async () => {
      await send({ sessionId: "session-abcdef" });

      expect(m.trackEvent).toHaveBeenCalledWith(
        "org_a",
        "conversation_started",
        {
          delivery_channel: "web_widget",
        },
      );
      expect(m.triggerOrgEvent).toHaveBeenCalledWith(
        "org_a",
        "conversation:new",
        {
          conversationId: 42,
          sessionId: "session-abcdef",
        },
      );
    });

    it("notifies staff with the session prefix and the customer's first message", async () => {
      await send({ sessionId: "session-abcdef" });

      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "conversation_new",
        "Percakapan baru dimulai",
        `session-|${MESSAGE}`,
        42,
      );
    });

    it("truncates a long first message to 60 characters plus an ellipsis in the notification", async () => {
      await send({ sessionId: "session-abcdef", message: "x".repeat(61) });

      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "conversation_new",
        "Percakapan baru dimulai",
        `session-|${"x".repeat(60)}...`,
        42,
      );
    });

    it("answers 500 and does nothing else when the insert returns no row", async () => {
      state.conversationRows = [];

      const res = await POST(chatReq());

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to create conversation",
      });
      expect(secondArgs(m.triggerOrgEvent)).not.toContain("conversation:new");
      expect(m.trackEvent).not.toHaveBeenCalled();
      expect(m.retrieveContext).not.toHaveBeenCalled();
      expect(m.openaiCreate).not.toHaveBeenCalled();
    });

    it("a failing dashboard event never blocks the answer", async () => {
      m.triggerOrgEvent.mockRejectedValueOnce(new Error("pusher down"));

      const { res } = await send();

      expect(res.status).toBe(200);
      expect(m.openaiCreate).toHaveBeenCalledTimes(1);
    });

    it("a failing staff notification never blocks the answer", async () => {
      m.createNotification.mockRejectedValueOnce(new Error("db down"));

      const { res } = await send();

      expect(res.status).toBe(200);
      expect(m.openaiCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("step 10 — conversation history", () => {
    it("reads at most the last 6 messages of THIS conversation, newest first, scoped to the org", async () => {
      setup(EXISTING_AI, []);

      await send();

      expect(m.selectWhere).toHaveBeenNthCalledWith(3, {
        op: "and",
        args: [
          { op: "eq", a: messages.orgId, b: "org_a" },
          { op: "eq", a: messages.conversationId, b: 7 },
        ],
      });
      expect(m.historyOrderBy).toHaveBeenCalledWith({
        op: "desc",
        a: messages.createdAt,
      });
      expect(m.historyLimit).toHaveBeenCalledWith(6);
    });

    it("sends the history to OpenAI oldest first, between the system prompt and the new message", async () => {
      setup(EXISTING_AI, [
        // The database returns newest first
        { role: "assistant", content: "c" },
        { role: "user", content: "b" },
        { role: "assistant", content: "a" },
      ]);

      await send();

      expect(m.openaiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "SYSTEM PROMPT" },
            { role: "assistant", content: "a" },
            { role: "user", content: "b" },
            { role: "assistant", content: "c" },
            { role: "user", content: MESSAGE },
          ],
        }),
      );
    });

    // OpenAI rejects unknown roles — staff replies are stored as human_agent
    it("remaps staff replies (human_agent) to assistant before they reach OpenAI", async () => {
      setup(EXISTING_AI, [
        { role: "assistant", content: "KUN kembali menangani percakapan ini." },
        { role: "human_agent", content: "Halo kak, saya staff" },
        { role: "user", content: "Mau bicara dengan staff" },
      ]);

      await send();

      expect(m.openaiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "SYSTEM PROMPT" },
            { role: "user", content: "Mau bicara dengan staff" },
            { role: "assistant", content: "Halo kak, saya staff" },
            {
              role: "assistant",
              content: "KUN kembali menangani percakapan ini.",
            },
            { role: "user", content: MESSAGE },
          ],
        }),
      );
    });

    it("with no history the model sees only the system prompt and the new message", async () => {
      setup(EXISTING_AI, []);

      await send();

      expect(m.openaiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "SYSTEM PROMPT" },
            { role: "user", content: MESSAGE },
          ],
        }),
      );
    });
  });

  describe("step 11 — RAG context and business profile", () => {
    beforeEach(() => {
      setup(EXISTING_AI, []);
    });

    it("retrieves context for the customer's message within the org", async () => {
      await send();

      expect(m.retrieveContext).toHaveBeenCalledWith(MESSAGE, "org_a");
    });

    it("loads the profile through the cache for this org, and a miss reads it from the database", async () => {
      m.cachedProfile.mockImplementation(
        async (_orgId: string, fetchFn: () => Promise<unknown>) => fetchFn(),
      );
      m.getBusinessProfileData.mockResolvedValue({
        block: "Alamat: Jl. Mawar",
        hours: [],
      });

      await send();

      expect(m.cachedProfile).toHaveBeenCalledWith(
        "org_a",
        expect.any(Function),
      );
      expect(m.getBusinessProfileData).toHaveBeenCalledWith("org_a");
    });

    it("starts the profile lookup while retrieval is still pending (they run in parallel)", async () => {
      let release!: (chunks: string[]) => void;
      m.retrieveContext.mockReturnValueOnce(
        new Promise<string[]>((resolve) => {
          release = resolve;
        }),
      );

      const pending = POST(chatReq());
      await until(() => m.cachedProfile.mock.calls.length > 0);

      // Retrieval has not resolved, yet the profile lookup already started
      expect(m.cachedProfile).toHaveBeenCalledTimes(1);
      expect(m.buildSystemPrompt).not.toHaveBeenCalled();

      release(["chunk"]);
      await (await pending).text();
      expect(m.buildSystemPrompt).toHaveBeenCalledTimes(1);
    });

    it("a profile failure never breaks chat: it falls back to no profile and logs the error", async () => {
      const boom = new Error("redis down");
      m.cachedProfile.mockRejectedValueOnce(boom);

      const { res } = await send();

      expect(res.status).toBe(200);
      expect(console.error).toHaveBeenCalledWith(
        "[chat] Failed to load business profile:",
        boom,
      );
      expect(m.buildSystemPrompt).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ profileBlock: null, hours: [] }),
      );
    });

    // CHARACTERIZATION — unlike the profile, a failing retrieval has no fallback: the request
    // throws, after a new conversation was already created and announced
    it("a retrieval failure fails the request, with no prompt built and no model call", async () => {
      m.retrieveContext.mockRejectedValueOnce(new Error("rag down"));

      await expect(POST(chatReq())).rejects.toThrow("rag down");

      expect(m.buildSystemPrompt).not.toHaveBeenCalled();
      expect(m.openaiCreate).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
    });

    it("a retrieval failure on a first message leaves the new conversation created and announced", async () => {
      m.select.mockReset();
      state.conversationRows = [NEW_CONVERSATION];
      setup(null, []);
      m.retrieveContext.mockRejectedValueOnce(new Error("rag down"));

      await expect(POST(chatReq())).rejects.toThrow("rag down");

      expect(m.conversationValues).toHaveBeenCalledTimes(1);
      expect(secondArgs(m.triggerOrgEvent)).toContain("conversation:new");
    });
  });

  describe("step 12 — buildSystemPrompt arguments", () => {
    it("passes the chatbot config, the retrieved chunks and the request context", async () => {
      setup(EXISTING_AI, []);
      m.retrieveContext.mockResolvedValueOnce(["chunk-1", "chunk-2"]);
      m.cachedProfile.mockResolvedValueOnce({
        block: "Alamat: Jl. Mawar",
        hours: [],
      });

      await send();

      expect(m.buildSystemPrompt).toHaveBeenCalledTimes(1);
      expect(m.buildSystemPrompt).toHaveBeenCalledWith(
        {
          language: "id",
          accentColor: "#069494",
          systemPrompt: null,
          quickReplies: null,
        },
        ["chunk-1", "chunk-2"],
        {
          timeZone: "Asia/Jakarta",
          profileBlock: "Alamat: Jl. Mawar",
          hours: [],
          isFirstMessage: true,
        },
      );
    });

    it("passes the per-org language, accent colour and custom prompt through", async () => {
      setup(EXISTING_AI, []);
      m.cachedChatbot.mockResolvedValue({
        ...CHATBOT,
        language: "en",
        accentColor: "#ff0000",
        systemPrompt: "Be brief",
      });

      await send();

      expect(m.buildSystemPrompt).toHaveBeenCalledWith(
        {
          language: "en",
          accentColor: "#ff0000",
          systemPrompt: "Be brief",
          quickReplies: null,
        },
        expect.anything(),
        expect.anything(),
      );
    });

    it("uses the business timezone from the org, not a default", async () => {
      setup(EXISTING_AI, []);
      m.cachedOrg.mockResolvedValue({ ...ORG, timezone: "Asia/Makassar" });

      await send();

      expect(m.buildSystemPrompt).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ timeZone: "Asia/Makassar" }),
      );
    });

    it("passes the profile's opening hours through untouched", async () => {
      setup(EXISTING_AI, []);
      const hours = [
        {
          label: "Klinik",
          lines: [{ days: [1, 2], opens: "08:00", closes: "17:00" }],
        },
      ];
      m.cachedProfile.mockResolvedValueOnce({ block: "Profil", hours });

      await send();

      expect(m.buildSystemPrompt).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ profileBlock: "Profil", hours }),
      );
    });

    describe("isFirstMessage", () => {
      it("is true when the conversation has no stored messages (a new conversation)", async () => {
        state.conversationRows = [NEW_CONVERSATION];
        setup(null, []);

        await send();

        expect(m.buildSystemPrompt).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ isFirstMessage: true }),
        );
      });

      it("is false once the conversation has history", async () => {
        setup(EXISTING_AI, [{ role: "assistant", content: "Halo kak!" }]);

        await send();

        expect(m.buildSystemPrompt).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ isFirstMessage: false }),
        );
      });

      // CHARACTERIZATION — the flag is derived from the stored history only, so an existing
      // conversation whose messages were purged (90-day retention) greets as a first message again
      it("is true for an existing conversation whose messages were purged", async () => {
        setup(EXISTING_AI, []);

        await send();

        expect(m.buildSystemPrompt).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ isFirstMessage: true }),
        );
      });
    });

    describe("quick replies parsing", () => {
      it.each([
        [
          "a valid JSON array of strings",
          '["Jam buka?","Ada promo?"]',
          ["Jam buka?", "Ada promo?"],
        ],
        ["an empty array", "[]", []],
        ["invalid JSON", "not json", null],
        ["a JSON object", '{"a":1}', null],
        ["an array containing a non-string", '["ok",1]', null],
        ["an empty string", "", null],
      ] as Array<[string, string, string[] | null]>)(
        "%s → %j",
        async (_label, raw, expected) => {
          setup(EXISTING_AI, []);
          m.cachedChatbot.mockResolvedValue({ ...CHATBOT, quickReplies: raw });

          await send();

          expect(m.buildSystemPrompt).toHaveBeenCalledWith(
            expect.objectContaining({ quickReplies: expected }),
            expect.anything(),
            expect.anything(),
          );
        },
      );
    });
  });

  describe("order of work", () => {
    it("runs: create conversation → history → retrieval and profile → prompt → model call", async () => {
      state.conversationRows = [NEW_CONVERSATION];
      setup(null, []);

      await send();

      expectAscending([
        m.conversationValues.mock.invocationCallOrder[0],
        // The history is the third database read
        m.select.mock.invocationCallOrder[2],
        m.retrieveContext.mock.invocationCallOrder[0],
        m.cachedProfile.mock.invocationCallOrder[0],
        m.buildSystemPrompt.mock.invocationCallOrder[0],
        m.openaiCreate.mock.invocationCallOrder[0],
      ]);
    });
  });
});
