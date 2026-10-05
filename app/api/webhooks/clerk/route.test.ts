// Tests for the Clerk webhook — org sync (created / updated / deleted), signature check,
// idempotent claim, and the best-effort owner-email + welcome-email step after commit.
// NOTE: a mocked transaction cannot verify rollback — these tests check that the route
// THROWS out of the transaction callback (which is what triggers the rollback) and that it
// answers 500 so Clerk retries.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clerkClient } from "@clerk/nextjs/server";
import { sendWelcomeEmail } from "@/lib/email";
import { orgs, chatbots, processedWebhooks } from "@/lib/db/schema";
import { POST } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  clerkWebhookSecret: "whsec_test",
  logoUrl: "https://example.com/logo.png",
}));
const mockHeaders = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const webhookCtor = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({ transaction: vi.fn(), update: vi.fn() }));
// Transaction-level captures
const claimValues = vi.hoisted(() => vi.fn());
const claimReturning = vi.hoisted(() => vi.fn());
const orgValues = vi.hoisted(() => vi.fn());
const orgConflictArg = vi.hoisted(() => vi.fn());
const orgUpsert = vi.hoisted(() => vi.fn());
const chatbotValues = vi.hoisted(() => vi.fn());
const chatbotInsert = vi.hoisted(() => vi.fn());
const txUpdateSet = vi.hoisted(() => vi.fn());
// Top-level db.update (the post-commit ownerEmail write)
const updateSet = vi.hoisted(() => vi.fn());
const updateWhere = vi.hoisted(() => vi.fn());
// Which tables the transaction inserted into, in order
const insertedTables = vi.hoisted(() => [] as unknown[]);

vi.mock("next/headers", () => ({ headers: mockHeaders }));
// Class-like mock must use the `function` keyword so `new` works (rule 20)
vi.mock("svix", () => ({
  Webhook: function (secret: string) {
    webhookCtor(secret);
    return { verify: mockVerify };
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));

const mockClerkClient = vi.mocked(clerkClient);
const mockSendWelcome = vi.mocked(sendWelcomeEmail);

const ORG_ID = "org_abcdefgh12345678"; // last 8 chars: 12345678
const SVIX_ID = "msg_1";
const RAW_BODY = '{"raw":"body"}';

type EventType =
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "organizationMembership.created";

type EventOverrides = Partial<{
  name: string;
  slug: string | null;
  created_by: string | null;
}>;

// What svix's verify() hands back after a valid signature
function event(type: EventType, overrides: EventOverrides = {}) {
  return {
    type,
    data: {
      id: ORG_ID,
      name: "Warung A",
      slug: "warung-a",
      created_at: 1,
      updated_at: 1,
      created_by: "user_1",
      ...overrides,
    },
  };
}

function arrange(type: EventType, overrides: EventOverrides = {}): void {
  mockVerify.mockReturnValue(event(type, overrides));
}

// All three Svix headers, optionally leaving one out
function setHeaders(omit?: string): void {
  const all: Record<string, string> = {
    "svix-id": SVIX_ID,
    "svix-timestamp": "1700000000",
    "svix-signature": "v1,sig",
  };
  if (omit) delete all[omit];
  mockHeaders.mockResolvedValue(new Headers(all));
}

// A Clerk user with the given addresses
function setUser(
  addresses: Array<{ id: string; emailAddress: string }>,
  primaryEmailAddressId: string | null,
): void {
  mockGetUser.mockResolvedValue({
    emailAddresses: addresses,
    primaryEmailAddressId,
  });
}

// The fake transaction: routes each insert by TABLE so each chain can be asserted separately
function makeTx() {
  return {
    insert: (table: unknown) => {
      insertedTables.push(table);

      // The idempotency claim: insert(...).values(...).onConflictDoNothing().returning(...)
      if (table === processedWebhooks) {
        return {
          values: (v: Record<string, unknown>) => {
            claimValues(v);
            return {
              onConflictDoNothing: () => ({ returning: claimReturning }),
            };
          },
        };
      }
      // The org upsert: insert(...).values(...).onConflictDoUpdate(...) — awaited
      if (table === orgs) {
        return {
          values: (v: Record<string, unknown>) => {
            orgValues(v);
            return {
              onConflictDoUpdate: (arg: Record<string, unknown>) => {
                orgConflictArg(arg);
                return orgUpsert();
              },
            };
          },
        };
      }
      // The chatbot seed: insert(...).values(...).onConflictDoNothing() — awaited
      if (table === chatbots) {
        return {
          values: (v: Record<string, unknown>) => {
            chatbotValues(v);
            return { onConflictDoNothing: () => chatbotInsert() };
          },
        };
      }
      throw new Error("unexpected table inserted into");
    },
    // tx.update(orgs).set(...).where(...) — used by organization.deleted
    update: () => ({
      set: (v: Record<string, unknown>) => {
        txUpdateSet(v);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  };
}

async function send(): Promise<{ status: number; text: string }> {
  const res = await POST(
    new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: RAW_BODY,
    }),
  );
  return { status: res.status, text: await res.text() };
}

// Lets a fire-and-forget `.catch()` handler run before we assert on it
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    // Reset also clears leftover once-queues from a previous test
    vi.resetAllMocks();
    insertedTables.length = 0;
    // Silence route logging
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Happy defaults: valid headers, valid signature, a fresh (not-yet-claimed) event
    setHeaders();
    arrange("organization.created");
    claimReturning.mockResolvedValue([{ id: 1 }]);
    orgUpsert.mockResolvedValue(undefined);
    chatbotInsert.mockResolvedValue(undefined);
    mockDb.transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(makeTx()),
    );
    // Post-commit: db.update(orgs).set({ownerEmail}).where(...)
    updateWhere.mockResolvedValue(undefined);
    updateSet.mockReturnValue({ where: updateWhere });
    mockDb.update.mockReturnValue({ set: updateSet });
    // Clerk client + a user with one primary email
    mockClerkClient.mockResolvedValue({
      users: { getUser: mockGetUser },
    } as unknown as Awaited<ReturnType<typeof clerkClient>>);
    setUser([{ id: "e1", emailAddress: "owner@example.com" }], "e1");
    // The route calls .catch() on this, so the default must be a real promise
    mockSendWelcome.mockResolvedValue(undefined);
  });

  describe("signature and headers", () => {
    it.each(["svix-id", "svix-timestamp", "svix-signature"])(
      "rejects a request missing %s with 400 and verifies nothing",
      async (header) => {
        setHeaders(header);
        const { status, text } = await send();
        expect(status).toBe(400);
        expect(text).toBe("Missing Svix headers");
        expect(mockVerify).not.toHaveBeenCalled();
        expect(mockDb.transaction).not.toHaveBeenCalled();
      },
    );

    it("rejects an invalid signature with 400 and touches no data", async () => {
      mockVerify.mockImplementation(() => {
        throw new Error("bad signature");
      });
      const { status, text } = await send();
      expect(status).toBe(400);
      expect(text).toBe("Invalid signature");
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("verifies the RAW body with the three Svix headers and the webhook secret", async () => {
      await send();
      expect(webhookCtor).toHaveBeenCalledWith("whsec_test");
      expect(mockVerify).toHaveBeenCalledWith(RAW_BODY, {
        "svix-id": SVIX_ID,
        "svix-timestamp": "1700000000",
        "svix-signature": "v1,sig",
      });
    });
  });

  describe("idempotent claim", () => {
    it("claims the Svix event id with source 'clerk' BEFORE any org write", async () => {
      await send();
      expect(claimValues).toHaveBeenCalledWith({
        externalId: SVIX_ID,
        source: "clerk",
      });
      expect(insertedTables[0]).toBe(processedWebhooks);
      expect(insertedTables[1]).toBe(orgs);
    });

    it("an already-processed event returns 200, writes nothing and skips the email step", async () => {
      claimReturning.mockResolvedValueOnce([]);
      const { status, text } = await send();
      expect(status).toBe(200);
      expect(text).toBe("Already processed");
      expect(orgValues).not.toHaveBeenCalled();
      expect(chatbotValues).not.toHaveBeenCalled();
      // A Clerk retry must never send a second welcome email
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockSendWelcome).not.toHaveBeenCalled();
    });
  });

  describe("organization.created", () => {
    it("upserts the org on the Free plan with the Free message limit", async () => {
      const { status, text } = await send();
      expect(status).toBe(200);
      expect(text).toBe("OK");
      expect(orgValues).toHaveBeenCalledWith({
        id: ORG_ID,
        name: "Warung A",
        slug: "warung-a-12345678",
        plan: "free",
        subscriptionStatus: "free",
        messagesUsed: 0,
        messagesLimit: 100,
        createdBy: "user_1",
      });
    });

    it("builds the slug from the Clerk slug plus the last 8 chars of the org id", async () => {
      await send();
      expect(orgValues).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "warung-a-12345678" }),
      );
    });

    it("falls back to the org id as the slug base when Clerk sends no slug", async () => {
      arrange("organization.created", { slug: null });
      await send();
      expect(orgValues).toHaveBeenCalledWith(
        expect.objectContaining({ slug: `${ORG_ID}-12345678` }),
      );
    });

    it("seeds a default chatbot for the new org", async () => {
      await send();
      expect(chatbotValues).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: ORG_ID,
          systemPrompt: null,
          language: "id",
          accentColor: "#069494",
          isActive: true,
        }),
      );
      const seeded = chatbotValues.mock.calls[0]?.[0] as {
        quickReplies: string;
      };
      expect(JSON.parse(seeded.quickReplies)).toHaveLength(5);
    });

    it("runs the inserts in order: claim → org → chatbot", async () => {
      await send();
      expect(insertedTables).toEqual([processedWebhooks, orgs, chatbots]);
    });
  });

  describe("organization.updated", () => {
    beforeEach(() => {
      arrange("organization.updated");
    });

    it("upserts the org but seeds no chatbot", async () => {
      const { status } = await send();
      expect(status).toBe(200);
      expect(orgValues).toHaveBeenCalledTimes(1);
      expect(chatbotValues).not.toHaveBeenCalled();
      expect(insertedTables).toEqual([processedWebhooks, orgs]);
    });

    // The conflict branch must touch the name ONLY — otherwise a re-sent event would
    // reset a paid org back to Free, or overwrite the owner's custom slug.
    it("on conflict updates ONLY the name, never the slug, plan or quota", async () => {
      await send();
      expect(orgConflictArg).toHaveBeenCalledWith({
        target: orgs.id,
        set: { name: "Warung A" },
      });
    });

    // Regression: a custom slug saved in Settings must survive Clerk's update events
    it("never overwrites the slug on an update event", async () => {
      arrange("organization.updated", { slug: "from-clerk" });
      await send();
      const arg = orgConflictArg.mock.calls[0]?.[0] as {
        set: Record<string, unknown>;
      };
      expect(arg.set).not.toHaveProperty("slug");
    });

    it("does not look up the owner email or send a welcome email", async () => {
      await send();
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockSendWelcome).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("organization.deleted", () => {
    beforeEach(() => {
      arrange("organization.deleted");
    });

    it("soft-cancels the org instead of deleting it", async () => {
      const { status } = await send();
      expect(status).toBe(200);
      expect(txUpdateSet).toHaveBeenCalledWith({
        subscriptionStatus: "cancelled",
      });
      expect(orgValues).not.toHaveBeenCalled();
      expect(chatbotValues).not.toHaveBeenCalled();
    });

    it("does not look up an owner email", async () => {
      await send();
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockSendWelcome).not.toHaveBeenCalled();
    });
  });

  describe("organizationMembership.created", () => {
    // CHARACTERIZATION — the type is in the union but has no handler: the event is claimed
    // and acknowledged, nothing else happens
    it("is claimed and acknowledged without any org or chatbot write", async () => {
      arrange("organizationMembership.created");
      const { status } = await send();
      expect(status).toBe(200);
      expect(insertedTables).toEqual([processedWebhooks]);
      expect(txUpdateSet).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe("owner email sync (after commit, best-effort)", () => {
    it("stores the PRIMARY email and sends the welcome email", async () => {
      setUser(
        [
          { id: "e1", emailAddress: "other@example.com" },
          { id: "e2", emailAddress: "primary@example.com" },
        ],
        "e2",
      );
      await send();
      expect(mockGetUser).toHaveBeenCalledWith("user_1");
      expect(updateSet).toHaveBeenCalledWith({
        ownerEmail: "primary@example.com",
      });
      expect(mockSendWelcome).toHaveBeenCalledWith(
        "primary@example.com",
        "Warung A",
        mockEnv.logoUrl,
      );
    });

    it("falls back to the first address when none is marked primary", async () => {
      setUser(
        [
          { id: "e1", emailAddress: "first@example.com" },
          { id: "e2", emailAddress: "second@example.com" },
        ],
        null,
      );
      await send();
      expect(updateSet).toHaveBeenCalledWith({
        ownerEmail: "first@example.com",
      });
    });

    it("runs only AFTER the transaction has committed", async () => {
      await send();
      const txOrder = mockDb.transaction.mock.invocationCallOrder[0] as number;
      const userOrder = mockGetUser.mock.invocationCallOrder[0] as number;
      expect(txOrder).toBeLessThan(userOrder);
    });

    it("skips the lookup entirely when Clerk sends no created_by", async () => {
      arrange("organization.created", { created_by: null });
      const { status } = await send();
      expect(status).toBe(200);
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockSendWelcome).not.toHaveBeenCalled();
    });

    it("stores nothing and sends nothing when the user has no email address", async () => {
      setUser([], null);
      const { status } = await send();
      expect(status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockSendWelcome).not.toHaveBeenCalled();
    });

    it("still answers 200 when the Clerk user lookup fails", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("clerk down"));
      const { status, text } = await send();
      expect(status).toBe(200);
      expect(text).toBe("OK");
      expect(mockSendWelcome).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("still answers 200 when saving ownerEmail fails, and sends no welcome email", async () => {
      updateWhere.mockRejectedValueOnce(new Error("neon timeout"));
      const { status } = await send();
      expect(status).toBe(200);
      expect(mockSendWelcome).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it("a failing welcome email never changes the 200 response", async () => {
      mockSendWelcome.mockRejectedValueOnce(new Error("resend down"));
      const { status } = await send();
      await flush();
      expect(status).toBe(200);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("answers 500 when the org upsert fails, so Clerk retries (the claim rolls back with it)", async () => {
      orgUpsert.mockRejectedValueOnce(new Error("neon timeout"));
      const { status, text } = await send();
      expect(status).toBe(500);
      expect(text).toBe("Internal error");
      expect(chatbotValues).not.toHaveBeenCalled();
      // No owner-email or welcome-email work for an org that was never created
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockSendWelcome).not.toHaveBeenCalled();
    });

    it("answers 500 when the chatbot seed fails", async () => {
      chatbotInsert.mockRejectedValueOnce(new Error("constraint"));
      const { status } = await send();
      expect(status).toBe(500);
      expect(mockSendWelcome).not.toHaveBeenCalled();
    });

    it("answers 500 when the claim insert itself fails", async () => {
      claimReturning.mockRejectedValueOnce(new Error("neon timeout"));
      const { status } = await send();
      expect(status).toBe(500);
      expect(orgValues).not.toHaveBeenCalled();
    });

    it("answers 500 when the whole transaction cannot start", async () => {
      mockDb.transaction.mockRejectedValueOnce(new Error("connection refused"));
      const { status } = await send();
      expect(status).toBe(500);
    });

    it("treats any thrown string other than 'already_processed' as a real error", async () => {
      mockDb.transaction.mockRejectedValueOnce("something_else");
      const { status, text } = await send();
      expect(status).toBe(500);
      expect(text).toBe("Internal error");
    });
  });
});
