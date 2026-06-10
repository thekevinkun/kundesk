import { NextRequest } from "next/server";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { trackEvent } from "@/lib/posthog";
import { sendUsageWarningEmail } from "@/lib/email";
import { createNotification } from "@/lib/db/queries/dashboard";
import { retrieveContext, buildSystemPrompt } from "@/lib/ai/rag";
import {
  orgs,
  chatbots,
  conversations,
  messages,
  processedWebhooks,
} from "@/lib/db/schema";
import {
  checkChatRateLimit,
  checkOrgMessageLimit,
  getCachedOrg,
  getCachedChatbot,
} from "@/lib/redis";
import {
  triggerOrgEvent,
  triggerConversationMessage,
  triggerUsageUpdated,
} from "@/lib/pusher";
import { detectInjection, detectHandoffRequest } from "@/helpers/security";
import type { ConversationTurn } from "@/types/chat";

// ─── Input validation ───
const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  sessionId: z.string().min(1).max(100),
  orgSlug: z.string().min(1).max(100),
});

// ─── Mock streaming ───
function createMockStream(
  encoder: TextEncoder,
  conversationId: number,
  channelToken: string,
): ReadableStream {
  const mockResponse =
    "Halo! Saya adalah asisten virtual bisnis ini. " +
    "Saat ini sistem berjalan dalam mode pengembangan (mock). " +
    "Dalam mode produksi, saya akan menjawab berdasarkan dokumen bisnis yang telah diupload. " +
    "Ada yang bisa saya bantu?";

  const tokens = mockResponse.split(" ").map((word) => word + " ");

  return new ReadableStream({
    async start(controller) {
      for (const token of tokens) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
        );
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      // Carry conversationId + channelToken so widget can subscribe to correct channel
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ done: true, conversationId, channelToken })}\n\n`,
        ),
      );
      controller.close();
    },
  });
}

// ─── Real OpenAI streaming ───
function createOpenAIStream(
  systemPrompt: string,
  conversationHistory: ConversationTurn[],
  userMessage: string,
  encoder: TextEncoder,
  conversationId: number,
  channelToken: string,
  onComplete: (fullResponse: string, responseTimeMs?: number) => Promise<void>,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: env.openaiApiKey! });

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...conversationHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: userMessage },
      ];

      let fullResponse = "";
      // Record start time — used to calculate how long OpenAI took to respond
      const startTime = Date.now();

      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: apiMessages,
          stream: true,
          max_tokens: 600,
          temperature: 0.3,
        });

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content ?? "";
          if (token) {
            fullResponse += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
            );
          }
        }

        await onComplete(fullResponse, Date.now() - startTime);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, conversationId, channelToken })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        await onComplete("", undefined);

        // Use OpenAI SDK error classes — more reliable than string matching
        const { APIConnectionError, APIConnectionTimeoutError } =
          await import("openai");
        const isOpenAIError =
          err instanceof APIConnectionError ||
          err instanceof APIConnectionTimeoutError;

        const errorMessage = isOpenAIError
          ? "Mohon maaf, KUN sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi. 🙏"
          : "Terjadi gangguan saat memproses pesanmu. Silakan coba lagi.";

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`,
          ),
        );
        controller.close();
        console.error("[chat/stream] OpenAI stream error:", err);
      }
    },
  });
}

// Insert a quota webhook marker once per billing period.
// Returns true only when this request won the unique insert.
async function insertQuotaWebhookOnce(externalId: string): Promise<boolean> {
  const inserted = await db
    .insert(processedWebhooks)
    .values({
      externalId,
      source: "system",
    })
    .onConflictDoNothing()
    .returning({ id: processedWebhooks.id });

  return inserted.length > 0;
}

// Check quota thresholds and notify org if needed.
// Returns true only when the 80% warning is newly emitted for this billing period.
async function checkAndNotifyQuotaThresholds(
  orgId: string,
  messagesUsed: number,
  messagesLimit: number,
): Promise<boolean> {
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (messagesUsed >= messagesLimit) {
    const quotaFullKey = `QUOTA-FULL-${orgId}-${billingPeriod}`;
    const inserted = await insertQuotaWebhookOnce(quotaFullKey);
    if (inserted) {
      await createNotification(
        orgId,
        "quota_full",
        "Kuota pesan habis",
        `Pelanggan tidak dapat chat sampai kuota direset atau plan diupgrade`,
      ).catch(console.error);
    }
    return false;
  } else if (messagesUsed >= Math.floor(messagesLimit * 0.8)) {
    const warnKey = `QUOTA-WARN-${orgId}-${billingPeriod}`;
    const inserted = await insertQuotaWebhookOnce(warnKey);
    if (inserted) {
      await createNotification(
        orgId,
        "quota_warning",
        "Kuota pesan hampir habis",
        `${messagesUsed} dari ${messagesLimit} pesan telah digunakan bulan ini`,
      ).catch(console.error);
      return true;
    }
  }

  return false;
}

// ─── Shared helper — fire usage:updated immediately without a DB read ───
// All three message paths (AI, human, handoff) use this pattern.
// Uses an optimistic count derived from the cached org snapshot + 1.
// Accurate for single-tenant scenarios; dashboard corrects on next stat refetch
// if there is concurrent activity from other sessions.
async function fireUsageUpdated(
  orgId: string,
  currentMessagesUsed: number,
  messagesLimit: number,
): Promise<void> {
  const optimisticUsed = currentMessagesUsed + 1;

  // Fire Pusher immediately — no DB read, dashboard updates without delay
  triggerUsageUpdated(orgId, {
    messagesUsed: optimisticUsed,
    messagesLimit,
  }).catch(console.error);

  // Quota threshold checks run in background — non-blocking for the response
  checkAndNotifyQuotaThresholds(orgId, optimisticUsed, messagesLimit).catch(
    console.error,
  );
}

// ─── Main handler ───
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const errorResponse = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // ── 1. Parse and validate ──
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid request", 400);
  }

  const { message, sessionId, orgSlug } = parsed.data;

  // ── 2. IP rate limit ──
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";

  const ipLimit = await checkChatRateLimit(ip);
  if (!ipLimit.success) {
    return errorResponse(
      "Terlalu banyak permintaan. Coba lagi dalam 1 menit.",
      429,
    );
  }

  // ── 3. Resolve org — cache first, Neon on miss ──
  // Cached under both slug and orgId keys — TTL 5 minutes
  const org = await getCachedOrg(orgSlug, async () => {
    const [row] = await db
      .select({
        id: orgs.id,
        slug: orgs.slug,
        name: orgs.name,
        plan: orgs.plan,
        subscriptionStatus: orgs.subscriptionStatus,
        messagesUsed: orgs.messagesUsed,
        messagesLimit: orgs.messagesLimit,
        ownerEmail: orgs.ownerEmail,
      })
      .from(orgs)
      .where(eq(orgs.slug, orgSlug))
      .limit(1);
    return row ?? null;
  });

  if (!org) {
    return errorResponse("Not found", 404);
  }

  // ── 4. Fetch chatbot — cache first, Neon on miss ──
  // Cached under orgId — TTL 10 minutes
  const chatbot = await getCachedChatbot(org.id, async () => {
    const [row] = await db
      .select({
        id: chatbots.id,
        orgId: chatbots.orgId,
        language: chatbots.language,
        systemPrompt: chatbots.systemPrompt,
        accentColor: chatbots.accentColor,
        quickReplies: chatbots.quickReplies,
        isActive: chatbots.isActive,
      })
      .from(chatbots)
      .where(and(eq(chatbots.orgId, org.id), eq(chatbots.isActive, true)))
      .limit(1);
    return row ?? null;
  });

  if (!chatbot) {
    return errorResponse("Not found", 404);
  }

  // ── 5. Org rate limit ──
  const orgLimit = await checkOrgMessageLimit(org.id);
  if (!orgLimit.success) {
    return errorResponse(
      "Batas pesan organisasi tercapai. Coba lagi nanti.",
      429,
    );
  }

  // ── 6a. Prompt injection ──
  if (detectInjection(message)) {
    const deflectionStream = new ReadableStream({
      start(controller) {
        const deflection =
          "Maaf, saya hanya bisa membantu dengan pertanyaan seputar bisnis ini. " +
          "Ada yang bisa saya bantu?";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token: deflection })}\n\n`),
        );
        // Consistent done format — no conversationId/channelToken since
        // injection is detected before conversation creation
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
        );
        controller.close();
      },
    });

    return new Response(deflectionStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Fetch conversation + handoffStatus in one query — no second round trip
  const [existingConversation] = await db
    .select({
      id: conversations.id,
      channelToken: conversations.channelToken,
      handoffStatus: conversations.handoffStatus,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, org.id),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);

  // Derive handoff status directly from the single query above
  // null means no existing conversation yet
  const currentHandoffStatus = existingConversation?.handoffStatus ?? null;

  // ── 6b. Handoff request detection — runs before conversation creation ──
  // Handles both first-message and existing-conversation handoff requests
  // Creates conversation immediately with pending_handoff status if needed
  if (detectHandoffRequest(message)) {
    // Use already-fetched status — no second DB query
    if (currentHandoffStatus === "ai" || currentHandoffStatus === null) {
      let conversationId: number;
      let channelToken: string;

      if (existingConversation) {
        // Existing conversation — transition to pending_handoff
        conversationId = existingConversation.id;
        channelToken = existingConversation.channelToken;

        await db
          .update(conversations)
          .set({
            handoffStatus: "pending_handoff",
            // Permanent — customer expressed dissatisfaction, record it forever
            wasHandedOff: true,
          })
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.orgId, org.id),
              inArray(conversations.handoffStatus, ["ai", "pending_handoff"]),
            ),
          );
      } else {
        // First message — create conversation directly as pending_handoff
        // No quota check needed — no AI response will be generated
        const inserted = await db
          .insert(conversations)
          .values({
            orgId: org.id,
            sessionId,
            deliveryChannel: "web_widget",
            handoffStatus: "pending_handoff",
            // First message is already a handoff request — flag immediately
            wasHandedOff: true,
            channelToken: crypto.randomUUID(),
          })
          .returning({
            id: conversations.id,
            channelToken: conversations.channelToken,
          });

        if (!inserted[0]) {
          return errorResponse("Failed to create conversation", 500);
        }

        conversationId = inserted[0].id;
        channelToken = inserted[0].channelToken;
      }

      // Fire Pusher FIRST — before any DB writes
      // conversation:takeover drives the pending badge and sound on dashboard immediately
      // Neon cold start won't delay the dashboard update this way
      triggerOrgEvent(org.id, "conversation:takeover", {
        conversationId,
        handoffStatus: "pending_handoff",
      }).catch(console.error);

      triggerConversationMessage(org.id, channelToken, {
        conversationId,
        role: "user",
        content: message,
        handoffStatus: "pending_handoff",
      }).catch(console.error);

      // Notify dashboard — urgent, staff needs to act
      // Fires after Pusher so the badge appears before the notification panel updates
      createNotification(
        org.id,
        "pending_handoff",
        "Pelanggan meminta bantuan staff",
        `${sessionId.slice(0, 8)}|${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
        conversationId,
      ).catch(console.error);

      // Save customer message to DB — after Pusher so cold start doesn't block update
      // Staff will see this message when they open the conversation
      await db.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "user",
        content: message,
      });

      // Increment quota after message saved — Total Pesan and Kuota Pesan must match
      // Intentional: handoff requests are not quota-blocked even when limit is reached.
      // A customer asking for human help at the quota wall must still reach staff —
      // blocking them with a 402 at this moment is worse UX than the billing gap.
      // The atomic guard below still prevents the counter from exceeding the limit.
      await db
        .update(orgs)
        .set({ messagesUsed: sql`${orgs.messagesUsed} + 1` })
        .where(
          and(
            eq(orgs.id, org.id),
            // Same atomic guard as every other customer message path
            sql`${orgs.messagesUsed} < ${orgs.messagesLimit}`,
          ),
        );

      // Fire usage:updated after increment — optimistic count, no extra DB read needed
      await fireUsageUpdated(org.id, org.messagesUsed, org.messagesLimit);

      // Track handoff requests — measures how often AI fails to satisfy customers
      trackEvent(org.id, "handoff_requested", {
        delivery_channel: "web_widget",
        is_new_conversation: !existingConversation,
      });

      const pendingStream = new ReadableStream({
        start(controller) {
          const msg =
            "Oke, aku akan menghubungkan kakak dengan staff kami. " +
            "Mohon tunggu sebentar ya kak, staff akan segera membalas pesan kakak. 😊🙏";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token: msg })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId, channelToken, handoffStatus: "pending_handoff" })}\n\n`,
            ),
          );
          controller.close();
        },
      });

      return new Response(pendingStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // ── 7. Handoff check — must run before conversation creation and quota check ──
  // Human handoff messages bypass OpenAI entirely — no quota consumed, no phantom conversations
  if (existingConversation) {
    if (
      currentHandoffStatus === "human" ||
      currentHandoffStatus === "pending_handoff"
    ) {
      const conversationId = existingConversation.id;
      const channelToken = existingConversation.channelToken;

      // Fire Pusher FIRST — before DB writes so ConversationDialog updates without Neon cold start delay
      // Customer message appears in staff dialog immediately, DB write follows in background
      triggerConversationMessage(org.id, channelToken, {
        conversationId,
        role: "user",
        content: message,
        handoffStatus: currentHandoffStatus ?? "human",
      }).catch(console.error);

      // Fire usage:updated immediately — optimistic count, no DB read needed
      await fireUsageUpdated(org.id, org.messagesUsed, org.messagesLimit);

      // Save message to DB after Pusher — Neon cold start doesn't block dialog update
      await db.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "user",
        content: message,
      });

      // Intentional: human-mode messages increment quota but are never pre-blocked.
      // If quota is already full, the atomic guard silently does nothing — the
      // customer can still send messages to the staff member who took over.
      // This is a deliberate UX decision, not a gap.
      await db
        .update(orgs)
        .set({ messagesUsed: sql`${orgs.messagesUsed} + 1` })
        .where(
          and(
            eq(orgs.id, org.id),
            // Same atomic guard as AI mode — never exceed limit
            sql`${orgs.messagesUsed} < ${orgs.messagesLimit}`,
          ),
        );

      // Silent stream — no AI message, just done signal with handoff status
      // Customer sees their bubble, nothing else — like WhatsApp human handoff
      const holdingStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                conversationId,
                channelToken,
                handoffStatus: currentHandoffStatus,
              })}\n\n`,
            ),
          );
          controller.close();
        },
      });

      return new Response(holdingStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // ── 8. Plan limit check ──
  // Use fresh DB values instead of cached org snapshot — prevents race conditions
  // where the cached org.messagesUsed is stale after concurrent requests
  const [freshOrgQuota] = await db
    .select({
      messagesUsed: orgs.messagesUsed,
      messagesLimit: orgs.messagesLimit,
    })
    .from(orgs)
    .where(eq(orgs.id, org.id))
    .limit(1);

  if (!freshOrgQuota) {
    return errorResponse("Organization not found", 404);
  }

  if (freshOrgQuota.messagesUsed >= freshOrgQuota.messagesLimit) {
    // Fire quota-full notification once per billing period — not on every blocked request
    // Key includes year+month so it resets automatically after the monthly cron zeros usage
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const quotaFullKey = `QUOTA-FULL-${org.id}-${billingPeriod}`;

    // Await idempotency check — fire-and-forget risks losing the notification
    // if the serverless function exits before the promise resolves
    const inserted = await insertQuotaWebhookOnce(quotaFullKey);
    if (inserted) {
      await createNotification(
        org.id,
        "quota_full",
        "Kuota pesan habis",
        `Pelanggan tidak dapat chat sampai kuota direset atau plan diupgrade`,
      ).catch(console.error);
    }

    return errorResponse(
      "Batas pesan bulanan telah tercapai. Silakan upgrade plan Anda.",
      402,
    );
  }

  // ── 9. Resolve or create conversation ──
  let conversationId: number;
  let channelToken: string;

  if (existingConversation) {
    conversationId = existingConversation.id;
    channelToken = existingConversation.channelToken;
  } else {
    // First message — create new conversation with unguessable channel token
    const inserted = await db
      .insert(conversations)
      .values({
        orgId: org.id,
        sessionId,
        deliveryChannel: "web_widget",
        handoffStatus: "ai",
        // UUID token used as public Pusher channel — unguessable, prevents enumeration
        channelToken: crypto.randomUUID(),
      })
      .returning({
        id: conversations.id,
        channelToken: conversations.channelToken,
      });

    if (!inserted[0]) {
      return errorResponse("Failed to create conversation", 500);
    }

    conversationId = inserted[0].id;
    channelToken = inserted[0].channelToken;

    trackEvent(org.id, "conversation_started", {
      delivery_channel: "web_widget",
    });

    // Notify dashboard — bell increments live
    triggerOrgEvent(org.id, "conversation:new", {
      conversationId,
      sessionId,
    }).catch(console.error);

    // Notification — only on truly new conversations, shows customer's first message
    createNotification(
      org.id,
      "conversation_new",
      "Percakapan baru dimulai",
      `${sessionId.slice(0, 8)}|${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
      conversationId,
    ).catch(console.error);
  }

  // ── 10. Fetch conversation history ──
  const recentMessages = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.orgId, org.id),
        eq(messages.conversationId, conversationId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(6);

  // Remap human_agent → assistant before sending to OpenAI
  // OpenAI rejects any role outside "user" | "assistant" at runtime —
  // the TypeScript cast was hiding this bug. Staff replies become "assistant"
  // so KUN still has full context of what was said during the handoff period.
  const conversationHistory = recentMessages.reverse().map((m) => ({
    role: (m.role === "human_agent" ? "assistant" : m.role) as
      | "user"
      | "assistant",
    content: m.content,
  }));

  // ── 11. RAG context ──
  const contextChunks = await retrieveContext(message, org.id);

  // ── 12. Build system prompt ──
  // Build system prompt — KUN's identity is hardcoded in buildSystemPrompt
  // Only language, systemPrompt, and accentColor come from per-org config
  const systemPrompt = buildSystemPrompt(
    {
      language: chatbot.language as "id" | "en" | "both",
      accentColor: chatbot.accentColor,
      systemPrompt: chatbot.systemPrompt,
      quickReplies: (() => {
        try {
          if (!chatbot.quickReplies) return null;
          const parsed: unknown = JSON.parse(chatbot.quickReplies);
          return Array.isArray(parsed) &&
            parsed.every((v) => typeof v === "string")
            ? parsed
            : null;
        } catch {
          return null;
        }
      })(),
    },
    contextChunks,
  );

  // ── 13. Stream ──
  const handleStreamComplete = async (
    assistantResponse: string,
    responseTimeMs?: number,
  ) => {
    try {
      // freshOrgQuota fetched in step 8 — use it as the base for the optimistic count
      const newMessagesUsed = freshOrgQuota.messagesUsed + 1;

      // DB transaction first — fast, and ensures Pusher-triggered refetches read committed data
      await db.transaction(async (tx) => {
        await tx.insert(messages).values({
          orgId: org.id,
          conversationId,
          role: "user",
          content: message,
        });

        if (assistantResponse) {
          await tx.insert(messages).values({
            orgId: org.id,
            conversationId,
            role: "assistant",
            content: assistantResponse,
            responseTimeMs: responseTimeMs ?? null,
          });
        }

        // Atomic increment — SQL-level guard prevents exceeding limit under concurrency
        await tx
          .update(orgs)
          .set({ messagesUsed: sql`${orgs.messagesUsed} + 1` })
          .where(
            and(
              eq(orgs.id, org.id),
              sql`${orgs.messagesUsed} < ${orgs.messagesLimit}`,
            ),
          );
      });

      // Fire both AFTER transaction — refetches triggered by these events
      // read committed data, eliminating off-by-one and stale-read races
      triggerOrgEvent(org.id, "conversation:message", {
        conversationId,
        role: "assistant",
        handoffStatus: "ai",
      }).catch(console.error);

      triggerUsageUpdated(org.id, {
        messagesUsed: newMessagesUsed,
        messagesLimit: freshOrgQuota.messagesLimit,
      }).catch(console.error);

      trackEvent(org.id, "chat_message_sent", {
        delivery_channel: "web_widget",
        ai_mode: env.aiMode,
      });

      // Quota threshold checks and usage warning email — run in background, non-blocking
      checkAndNotifyQuotaThresholds(
        org.id,
        newMessagesUsed,
        freshOrgQuota.messagesLimit,
      )
        .then(async (shouldSendEmail) => {
          if (shouldSendEmail) {
            sendUsageWarningEmail(
              org.ownerEmail ?? "",
              org.name ?? "",
              newMessagesUsed,
              freshOrgQuota.messagesLimit,
              env.logoUrl,
            ).catch((err) =>
              console.error("[chat] Failed to send usage warning email:", err),
            );
          }
        })
        .catch(console.error);
    } catch (err) {
      console.error("[chat] Failed to save messages after stream:", err);
    }
  };

  const stream =
    env.aiMode === "mock"
      ? createMockStream(encoder, conversationId, channelToken)
      : createOpenAIStream(
          systemPrompt,
          conversationHistory,
          message,
          encoder,
          conversationId,
          channelToken,
          handleStreamComplete,
        );

  if (env.aiMode === "mock") {
    handleStreamComplete(
      "Mock response — AI mode is set to mock. Switch KUNDESK_AI_MODE=openai for real responses.",
    ).catch(console.error);
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
