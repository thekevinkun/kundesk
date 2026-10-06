// Tests for POST /api/chat — PART D: streaming and completion (step 13):
// tokens to the customer, the post-stream transaction, events after the commit, quota thresholds,
// OpenAI errors, client disconnects and mock mode.
// Parts A (front door + quota gate), B (handoff + human paths) and C (building the AI request)
// live in their own files. The mock block is duplicated on purpose.
// The route runs in "openai" mode against a mocked SDK whose stream each test controls.
// NOTE: SQL behaviour (the atomic increment guard) cannot be verified with mocks (rule 262) —
// these tests pin control flow, ordering and payloads.
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
  markerValues: vi.fn(),
  conversationValues: vi.fn(),
  txMessageValues: vi.fn(),
  txUpdateSet: vi.fn(),
  txUpdateWhere: vi.fn(),
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

const FRIENDLY_ERROR =
  "Mohon maaf, KUN sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi. 🙏";
const GENERIC_ERROR =
  "Terjadi gangguan saat memproses pesanmu. Silakan coba lagi.";

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

// The fake transaction handle: only the messages table and the orgs counter may be touched
const tx = {
  insert: (table: unknown) => {
    if (table !== messages) {
      throw new Error("unexpected table inserted into inside the transaction");
    }
    return {
      values: (values: Row) => {
        m.txMessageValues(values);
        return Promise.resolve(undefined);
      },
    };
  },
  update: (table: unknown) => ({
    set: (values: Row) => {
      m.txUpdateSet(table, values);
      return {
        where: (arg: unknown) => {
          m.txUpdateWhere(table, arg);
          return Promise.resolve(undefined);
        },
      };
    },
  }),
};

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
      where: () => ({
        orderBy: () => ({ limit: () => Promise.resolve(rows) }),
      }),
    }),
  });
}

// The three selects every request that reaches the AI path makes, in call order:
// conversation lookup, fresh quota re-read, history
function setup(
  conversation: Row,
  history: Row[],
  quota: Row[] = OK_QUOTA,
): void {
  queueSelect([conversation]);
  queueSelect(quota);
  queueHistory(history);
}

// ── Fake OpenAI streams ──
const tokenChunk = (content: string) => ({ choices: [{ delta: { content } }] });

// Yields the given tokens, then ends
function streamOf(tokens: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) yield tokenChunk(token);
    },
  };
}

// Yields raw chunks exactly as given (to cover empty and odd chunk shapes)
function rawStream(chunks: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

// Yields the tokens, then moves the clock forward — the route measures time around the stream
function timedStream(tokens: string[], elapsedMs: number) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) yield tokenChunk(token);
      vi.setSystemTime(new Date(Date.now() + elapsedMs));
    },
  };
}

// Yields the tokens, then throws — a stream that breaks halfway
function failingStream(tokens: string[], error: Error) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) yield tokenChunk(token);
      throw error;
    },
  };
}

// Yields one token, waits for the gate, then yields the next — lets a test act mid-stream
function gatedStream(first: string, second: string, gate: Promise<void>) {
  return {
    async *[Symbol.asyncIterator]() {
      yield tokenChunk(first);
      await gate;
      yield tokenChunk(second);
    },
  };
}

// A promise a test can resolve later
function makeGate(): { gate: Promise<void>; release: () => void } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
}

// An SSE body "data: {...}\n\ndata: {...}\n\n" → parsed events
async function readEvents(res: Response): Promise<Row[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((part) => JSON.parse(part.replace(/^data: /, "")) as Row);
}

// Lets fire-and-forget work (post-stream events, quota checks) finish
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Sends the request, reads the whole response, then lets the background work finish
async function sendAndSettle(
  overrides: Row = {},
): Promise<{ res: Response; events: Row[] }> {
  const res = await POST(chatReq(overrides));
  const events = await readEvents(res);
  await flush();
  return { res, events };
}

// Waits (without fake timers) until a condition holds — for tests that act mid-request
async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Everything saved inside the transaction, in order
function savedMessages(): Row[] {
  return m.txMessageValues.mock.calls.map((call) => call[0] as Row);
}
function savedWithRole(role: string): Row[] {
  return savedMessages().filter((row) => row.role === role);
}
// Guarded counter updates inside the transaction
function counterUpdates(): unknown[][] {
  return m.txUpdateSet.mock.calls.filter((call) => call[0] === orgs);
}

function expectAscending(orders: Array<number | undefined>): void {
  const defined = orders as number[];
  expect([...defined].sort((a, b) => a - b)).toEqual(defined);
}

// The SDK's error classes, as the (mocked) route sees them
async function openaiErrors(): Promise<{
  APIConnectionError: new (message: string) => Error;
  APIConnectionTimeoutError: new (message: string) => Error;
}> {
  return (await import("openai")) as unknown as {
    APIConnectionError: new (message: string) => Error;
    APIConnectionTimeoutError: new (message: string) => Error;
  };
}

describe("POST /api/chat — streaming and completion", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    // Only fake Date (quota marker keys use the billing month) — real timers keep promises flowing
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
    m.sendUsageWarningEmail.mockResolvedValue(undefined);
    // The AI collaborators; the default model answer is "Halo kak"
    m.retrieveContext.mockResolvedValue([]);
    m.cachedProfile.mockResolvedValue({ block: null, hours: [] });
    m.buildSystemPrompt.mockReturnValue("SYSTEM PROMPT");
    m.openaiCreate.mockResolvedValue(streamOf(["Halo", " kak"]));

    // The post-stream transaction runs its callback with the fake handle
    m.transaction.mockImplementation(
      async (callback: (handle: typeof tx) => Promise<unknown>) => callback(tx),
    );

    // Outside the transaction only the quota marker is ever inserted on this path
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
        throw new Error("a conversation must not be created on these paths");
      }
      throw new Error("unexpected table inserted into");
    });

    setup(EXISTING_AI, []);
  });

  afterEach(async () => {
    // Drain background work (quota checks, events) so it cannot leak into the next test's mocks
    await flush();
    vi.useRealTimers();
  });

  describe("the OpenAI request", () => {
    it("builds the client with the API key and asks for a streamed, capped, low-temperature answer", async () => {
      await sendAndSettle();

      expect(m.openaiCtor).toHaveBeenCalledWith({ apiKey: "sk-test" });
      expect(m.openaiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          stream: true,
          max_tokens: 600,
          temperature: 0.3,
        }),
      );
    });
  });

  describe("tokens to the customer", () => {
    it("streams each token as its own event, then a done event with the conversation id and token", async () => {
      const { res, events } = await sendAndSettle();

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
      expect(events).toEqual([
        { token: "Halo" },
        { token: " kak" },
        { done: true, conversationId: 7, channelToken: "tok-7" },
      ]);
    });

    it("skips empty tokens and chunks without content", async () => {
      m.openaiCreate.mockResolvedValue(
        rawStream([
          { choices: [{ delta: {} }] },
          { choices: [{ delta: { content: "" } }] },
          { choices: [] },
          tokenChunk("Halo"),
        ]),
      );

      const { events } = await sendAndSettle();

      expect(events).toEqual([
        { token: "Halo" },
        { done: true, conversationId: 7, channelToken: "tok-7" },
      ]);
      expect(savedWithRole("assistant")[0]?.content).toBe("Halo");
    });

    it("saves nothing until the answer is complete", async () => {
      const { gate, release } = makeGate();
      m.openaiCreate.mockResolvedValue(gatedStream("Halo", " kak", gate));

      const res = await POST(chatReq());
      const reader = res.body!.getReader();
      await reader.read(); // the first token reaches the customer

      expect(m.transaction).not.toHaveBeenCalled();

      release();
      let chunk = await reader.read();
      while (!chunk.done) chunk = await reader.read();

      expect(m.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("saving after the stream (one transaction)", () => {
    it("saves the customer's message and the answer with its response time, and counts it with the atomic guard", async () => {
      m.openaiCreate.mockResolvedValue(timedStream(["Halo", " kak"], 1500));

      await sendAndSettle();

      expect(m.transaction).toHaveBeenCalledTimes(1);
      expect(m.txMessageValues).toHaveBeenCalledTimes(2);
      expect(savedWithRole("user")).toEqual([
        { orgId: "org_a", conversationId: 7, role: "user", content: MESSAGE },
      ]);
      expect(savedWithRole("assistant")).toEqual([
        {
          orgId: "org_a",
          conversationId: 7,
          role: "assistant",
          content: "Halo kak",
          responseTimeMs: 1500,
        },
      ]);
      expect(m.txUpdateSet).toHaveBeenCalledWith(orgs, INCREMENT_SET);
      expect(m.txUpdateWhere).toHaveBeenCalledWith(orgs, INCREMENT_WHERE);
    });

    it("runs in the safe order: customer message → answer → counter", async () => {
      await sendAndSettle();

      expectAscending([
        m.txMessageValues.mock.invocationCallOrder[0],
        m.txMessageValues.mock.invocationCallOrder[1],
        m.txUpdateSet.mock.invocationCallOrder[0],
      ]);
      expect(m.txMessageValues.mock.calls[0]?.[0]).toMatchObject({
        role: "user",
      });
      expect(m.txMessageValues.mock.calls[1]?.[0]).toMatchObject({
        role: "assistant",
      });
    });

    it("starts saving only after the model call", async () => {
      await sendAndSettle();

      expectAscending([
        m.openaiCreate.mock.invocationCallOrder[0],
        m.transaction.mock.invocationCallOrder[0],
      ]);
    });

    it("an empty answer still saves and counts the customer's message, with no assistant row", async () => {
      m.openaiCreate.mockResolvedValue(streamOf([]));

      const { events } = await sendAndSettle();

      expect(events).toEqual([
        { done: true, conversationId: 7, channelToken: "tok-7" },
      ]);
      expect(savedWithRole("user")).toHaveLength(1);
      expect(savedWithRole("assistant")).toHaveLength(0);
      expect(counterUpdates()).toHaveLength(1);
    });

    // CHARACTERIZATION — the save error is swallowed inside the completion handler: the customer
    // still gets the full answer and a done event, but nothing is stored or counted, and neither
    // the dashboard nor analytics hear about it
    it("a failing save is swallowed: the customer still gets the answer, nothing is counted or announced", async () => {
      const boom = new Error("neon timeout");
      m.transaction.mockRejectedValueOnce(boom);

      const { events } = await sendAndSettle();

      expect(events).toEqual([
        { token: "Halo" },
        { token: " kak" },
        { done: true, conversationId: 7, channelToken: "tok-7" },
      ]);
      expect(console.error).toHaveBeenCalledWith(
        "[chat] Failed to save messages after stream:",
        boom,
      );
      expect(m.triggerOrgEvent).not.toHaveBeenCalled();
      expect(m.triggerUsageUpdated).not.toHaveBeenCalled();
      expect(m.trackEvent).not.toHaveBeenCalled();
      expect(m.markerValues).not.toHaveBeenCalled();
    });
  });

  describe("after the commit", () => {
    it("tells the dashboard and tracks the message, using the FRESH quota count (not the cached one)", async () => {
      m.select.mockReset();
      m.cachedOrg.mockResolvedValue({
        ...ORG,
        messagesUsed: 0,
        messagesLimit: 100,
      });
      setup(EXISTING_AI, [], [{ messagesUsed: 50, messagesLimit: 100 }]);

      await sendAndSettle();

      expect(m.triggerOrgEvent).toHaveBeenCalledWith(
        "org_a",
        "conversation:message",
        {
          conversationId: 7,
          role: "assistant",
          handoffStatus: "ai",
        },
      );
      expect(m.triggerUsageUpdated).toHaveBeenCalledWith("org_a", {
        messagesUsed: 51,
        messagesLimit: 100,
      });
      expect(m.trackEvent).toHaveBeenCalledWith("org_a", "chat_message_sent", {
        delivery_channel: "web_widget",
        ai_mode: "openai",
      });
    });

    it("fires the dashboard events only AFTER the transaction commits", async () => {
      const { gate, release } = makeGate();
      m.transaction.mockImplementationOnce(
        async (callback: (handle: typeof tx) => Promise<unknown>) => {
          await gate;
          return callback(tx);
        },
      );

      const res = await POST(chatReq());
      await until(() => m.transaction.mock.calls.length >= 1);
      await flush();

      // The save is still in flight: nothing has been announced yet
      expect(m.triggerOrgEvent).not.toHaveBeenCalled();
      expect(m.triggerUsageUpdated).not.toHaveBeenCalled();

      release();
      await readEvents(res);
      await flush();

      expectAscending([
        m.transaction.mock.invocationCallOrder[0],
        m.triggerOrgEvent.mock.invocationCallOrder[0],
        m.triggerUsageUpdated.mock.invocationCallOrder[0],
        m.trackEvent.mock.invocationCallOrder[0],
      ]);
    });

    it("failing live events never change the response", async () => {
      m.triggerOrgEvent.mockRejectedValueOnce(new Error("pusher down"));
      m.triggerUsageUpdated.mockRejectedValueOnce(new Error("pusher down"));

      const { events } = await sendAndSettle();

      expect(events[events.length - 1]).toEqual({
        done: true,
        conversationId: 7,
        channelToken: "tok-7",
      });
    });
  });

  describe("quota thresholds after the answer", () => {
    function withFreshQuota(messagesUsed: number): void {
      m.select.mockReset();
      setup(EXISTING_AI, [], [{ messagesUsed, messagesLimit: 100 }]);
    }

    it("below 80% writes no marker, no notification and no email", async () => {
      withFreshQuota(10);

      await sendAndSettle();

      expect(m.markerValues).not.toHaveBeenCalled();
      expect(m.createNotification).not.toHaveBeenCalled();
      expect(m.sendUsageWarningEmail).not.toHaveBeenCalled();
    });

    it("reaching 80% sends the warning notification and the usage email once", async () => {
      withFreshQuota(79);

      await sendAndSettle();

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
      expect(m.sendUsageWarningEmail).toHaveBeenCalledTimes(1);
      expect(m.sendUsageWarningEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "Warung A",
        80,
        100,
        mockEnv.logoUrl,
      );
    });

    it("reaching the limit sends the quota-full notification but no usage email", async () => {
      withFreshQuota(99);

      await sendAndSettle();

      expect(m.markerValues).toHaveBeenCalledWith({
        externalId: "QUOTA-FULL-org_a-2026-10",
        source: "system",
      });
      expect(m.createNotification).toHaveBeenCalledWith(
        "org_a",
        "quota_full",
        "Kuota pesan habis",
        "Pelanggan tidak dapat chat sampai kuota direset atau plan diupgrade",
      );
      expect(m.sendUsageWarningEmail).not.toHaveBeenCalled();
    });

    it("a warning already sent this month (marker exists) sends no notification and no email", async () => {
      withFreshQuota(79);
      state.markerRows = [];

      await sendAndSettle();

      expect(m.markerValues).toHaveBeenCalledTimes(1);
      expect(m.createNotification).not.toHaveBeenCalled();
      expect(m.sendUsageWarningEmail).not.toHaveBeenCalled();
    });

    it("a failing usage email never changes the response", async () => {
      withFreshQuota(79);
      const boom = new Error("resend down");
      m.sendUsageWarningEmail.mockRejectedValueOnce(boom);

      const { events } = await sendAndSettle();

      expect(events[events.length - 1]).toMatchObject({ done: true });
      expect(console.error).toHaveBeenCalledWith(
        "[chat] Failed to send usage warning email:",
        boom,
      );
    });

    // CHARACTERIZATION — with no owner email the usage warning is still "sent", to an empty address
    it("an org with no owner email still calls the email sender, with an empty address", async () => {
      withFreshQuota(79);
      m.cachedOrg.mockResolvedValue({ ...ORG, ownerEmail: null });

      await sendAndSettle();

      expect(m.sendUsageWarningEmail).toHaveBeenCalledWith(
        "",
        "Warung A",
        80,
        100,
        mockEnv.logoUrl,
      );
    });
  });

  describe("OpenAI errors", () => {
    it.each([
      ["a connection error", "APIConnectionError", FRIENDLY_ERROR],
      ["a timeout", "APIConnectionTimeoutError", FRIENDLY_ERROR],
      ["any other error", null, GENERIC_ERROR],
    ] as Array<
      [
        string,
        "APIConnectionError" | "APIConnectionTimeoutError" | null,
        string,
      ]
    >)(
      "%s: the customer sees the matching message and the error is logged",
      async (_label, kind, expected) => {
        const classes = await openaiErrors();
        const error = kind ? new classes[kind]("boom") : new Error("boom");
        m.openaiCreate.mockRejectedValueOnce(error);

        const { res, events } = await sendAndSettle();

        expect(res.status).toBe(200);
        expect(events).toEqual([{ error: expected }]);
        expect(console.error).toHaveBeenCalledWith(
          "[chat/stream] OpenAI stream error:",
          error,
        );
      },
    );

    // CHARACTERIZATION — the failure path calls the same completion handler with an empty
    // answer, so a failed model call still saves AND COUNTS the customer's message
    it("a failed model call still saves and counts the customer's message, with no assistant row", async () => {
      m.openaiCreate.mockRejectedValueOnce(new Error("boom"));

      await sendAndSettle();

      expect(savedWithRole("user")).toEqual([
        { orgId: "org_a", conversationId: 7, role: "user", content: MESSAGE },
      ]);
      expect(savedWithRole("assistant")).toHaveLength(0);
      expect(counterUpdates()).toHaveLength(1);
    });

    // CHARACTERIZATION — the customer already saw the tokens, but the partial answer is discarded
    it("a stream that breaks halfway delivers the tokens, then the error, and saves no answer", async () => {
      m.openaiCreate.mockResolvedValue(
        failingStream(["Halo"], new Error("stream broke")),
      );

      const { events } = await sendAndSettle();

      expect(events).toEqual([{ token: "Halo" }, { error: GENERIC_ERROR }]);
      expect(savedWithRole("user")).toHaveLength(1);
      expect(savedWithRole("assistant")).toHaveLength(0);
    });

    // CHARACTERIZATION — the completion handler runs the same post-commit work after a failure:
    // the dashboard is told about an assistant message that was never saved, and analytics
    // counts a sent message
    it("after an error the dashboard is still told about an assistant message that was never saved", async () => {
      m.openaiCreate.mockRejectedValueOnce(new Error("boom"));

      await sendAndSettle();

      expect(m.triggerOrgEvent).toHaveBeenCalledWith(
        "org_a",
        "conversation:message",
        {
          conversationId: 7,
          role: "assistant",
          handoffStatus: "ai",
        },
      );
      expect(m.trackEvent).toHaveBeenCalledWith(
        "org_a",
        "chat_message_sent",
        expect.anything(),
      );
    });
  });

  describe("the client disconnects", () => {
    // CHARACTERIZATION — a client that goes away mid-stream makes the next enqueue throw, which
    // lands in the error path: the customer's message is saved and counted, the answer is lost
    it("mid-stream: the customer's message is saved and counted once, with no assistant row", async () => {
      const { gate, release } = makeGate();
      m.openaiCreate.mockResolvedValue(gatedStream("Halo", " kak", gate));

      const res = await POST(chatReq());
      const reader = res.body!.getReader();
      await reader.read(); // the first token
      await reader.cancel(); // the client goes away
      release();

      await until(() => m.transaction.mock.calls.length >= 1);
      await flush();

      expect(m.transaction).toHaveBeenCalledTimes(1);
      expect(savedWithRole("user")).toHaveLength(1);
      expect(savedWithRole("assistant")).toHaveLength(0);
      expect(counterUpdates()).toHaveLength(1);
    });

    // Regression: if the client goes away WHILE the save is running, the done event cannot be
    // enqueued and the stream's error path calls the completion handler again. The handler is
    // one-shot, so the customer's message is stored and counted exactly once.
    it("while the save is in flight: the message is stored and counted once", async () => {
      const { gate, release } = makeGate();
      m.transaction.mockImplementationOnce(
        async (callback: (handle: typeof tx) => Promise<unknown>) => {
          await gate;
          return callback(tx);
        },
      );

      const res = await POST(chatReq());
      const reader = res.body!.getReader();
      await reader.read(); // "Halo"
      await reader.read(); // " kak"
      await until(() => m.transaction.mock.calls.length >= 1);
      await reader.cancel(); // the client goes away while the save is running
      release();

      // Give the error path time to (not) run the handler a second time
      await flush();
      await flush();

      expect(m.transaction).toHaveBeenCalledTimes(1);
      expect(savedWithRole("user")).toHaveLength(1);
      expect(savedWithRole("assistant")).toHaveLength(1);
      expect(counterUpdates()).toHaveLength(1);
    });
  });

  describe("mock mode (KUNDESK_AI_MODE=mock)", () => {
    beforeEach(() => {
      mockEnv.aiMode = "mock";
    });

    it("streams the fixed mock answer word by word and never touches OpenAI", async () => {
      const { res, events } = await sendAndSettle();

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(m.openaiCtor).not.toHaveBeenCalled();
      expect(m.openaiCreate).not.toHaveBeenCalled();

      const tokens = events
        .filter((event) => "token" in event)
        .map((event) => event.token);
      const text = tokens.join("");
      expect(tokens.length).toBeGreaterThan(5);
      expect(text).toContain("Halo! Saya adalah asisten virtual");
      expect(text).toContain("Ada yang bisa saya bantu?");
      expect(events[events.length - 1]).toEqual({
        done: true,
        conversationId: 7,
        channelToken: "tok-7",
      });
    });

    // CHARACTERIZATION — in mock mode the completion handler is started right away with a fixed
    // answer, independent of the stream, and with no response time
    it("saves the customer's message and a fixed mock answer, with no response time", async () => {
      await sendAndSettle();

      expect(savedWithRole("user")).toEqual([
        { orgId: "org_a", conversationId: 7, role: "user", content: MESSAGE },
      ]);
      expect(savedWithRole("assistant")).toEqual([
        {
          orgId: "org_a",
          conversationId: 7,
          role: "assistant",
          content: expect.stringContaining("Mock response"),
          responseTimeMs: null,
        },
      ]);
      expect(counterUpdates()).toHaveLength(1);
      expect(m.trackEvent).toHaveBeenCalledWith("org_a", "chat_message_sent", {
        delivery_channel: "web_widget",
        ai_mode: "mock",
      });
    });
  });
});
