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

      // Save customer message so staff sees what triggered the request
      await db.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "user",
        content: message,
      });

      // Notify dashboard — urgent, staff needs to act
      createNotification(
        org.id,
        "pending_handoff",
        "Pelanggan meminta bantuan staff",
        `${sessionId.slice(0, 8)}|${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
        conversationId,
      ).catch(console.error);

      // Pusher — dashboard updates live
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

      const pendingStream = new ReadableStream({
        start(controller) {
          const msg =
            "Oke, saya akan menghubungkan kamu dengan staff kami. " +
            "Mohon tunggu sebentar — staff akan segera membalas pesanmu. 🙏";
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

      await db.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "user",
        content: message,
      });

      triggerConversationMessage(org.id, channelToken, {
        conversationId,
        role: "user",
        content: message,
        handoffStatus: currentHandoffStatus ?? "human",
      }).catch(console.error);

      // Increment messagesUsed for human-mode customer messages — quota counts
      // inbound customer demand regardless of who replies (AI or staff)
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

      // Fetch updated counts for Pusher payload
      const [orgAfterHuman] = await db
        .select({
          messagesUsed: orgs.messagesUsed,
          messagesLimit: orgs.messagesLimit,
        })
        .from(orgs)
        .where(eq(orgs.id, org.id))
        .limit(1);

      if (orgAfterHuman) {
        triggerUsageUpdated(org.id, {
          messagesUsed: orgAfterHuman.messagesUsed,
          messagesLimit: orgAfterHuman.messagesLimit,
        }).catch(console.error);

        // Mirror the same quota threshold notifications as AI mode
        const used = orgAfterHuman.messagesUsed;
        const limit = orgAfterHuman.messagesLimit;
        const now = new Date();
        const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        if (used >= limit) {
          const quotaFullKey = `QUOTA-FULL-${org.id}-${billingPeriod}`;
          const [alreadyFiredFull] = await db
            .select({ id: processedWebhooks.id })
            .from(processedWebhooks)
            .where(
              and(
                eq(processedWebhooks.source, "midtrans"),
                eq(processedWebhooks.externalId, quotaFullKey),
              ),
            );
          if (!alreadyFiredFull) {
            await db.insert(processedWebhooks).values({
              externalId: quotaFullKey,
              source: "midtrans",
            });
            await createNotification(
              org.id,
              "quota_full",
              "Kuota pesan habis",
              `Pelanggan tidak dapat chat sampai kuota direset atau plan diupgrade`,
            ).catch(console.error);
          }
        } else if (used === Math.floor(limit * 0.8)) {
          const warnKey = `QUOTA-WARN-${org.id}-${billingPeriod}`;
          const [alreadyFiredWarn] = await db
            .select({ id: processedWebhooks.id })
            .from(processedWebhooks)
            .where(
              and(
                eq(processedWebhooks.source, "midtrans"),
                eq(processedWebhooks.externalId, warnKey),
              ),
            );
          if (!alreadyFiredWarn) {
            await db.insert(processedWebhooks).values({
              externalId: warnKey,
              source: "midtrans",
            });
            await createNotification(
              org.id,
              "quota_warning",
              "Kuota pesan hampir habis",
              `${used} dari ${limit} pesan telah digunakan bulan ini`,
            ).catch(console.error);
          }
        }
      }

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
  // Use fresh DB values instead of cached org snapshot
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
    const [alreadyFiredFull] = await db
      .select({ id: processedWebhooks.id })
      .from(processedWebhooks)
      .where(
        and(
          eq(processedWebhooks.source, "midtrans"),
          eq(processedWebhooks.externalId, quotaFullKey),
        ),
      );

    if (!alreadyFiredFull) {
      await db.insert(processedWebhooks).values({
        externalId: quotaFullKey,
        source: "midtrans",
      });
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

      triggerOrgEvent(org.id, "conversation:message", {
        conversationId,
      }).catch(console.error);

      trackEvent(org.id, "chat_message_sent", {
        delivery_channel: "web_widget",
        ai_mode: env.aiMode,
      });

      // Usage warning at 80% quota
      const updatedOrg = await db
        .select({
          messagesUsed: orgs.messagesUsed,
          messagesLimit: orgs.messagesLimit,
        })
        .from(orgs)
        .where(eq(orgs.id, org.id))
        .limit(1);

      if (updatedOrg[0]) {
        const { messagesUsed: used, messagesLimit: limit } = updatedOrg[0];
        if (used === Math.floor(limit * 0.8)) {
          // Email — existing behavior
          sendUsageWarningEmail(
            org.ownerEmail ?? "",
            org.name ?? "",
            used,
            limit,
            env.logoUrl,
          ).catch((err) =>
            console.error("[chat] Failed to send usage warning email:", err),
          );

          // Dashboard notification — same idempotency pattern as quota_full
          // Key resets naturally each billing period (year-month changes)
          const now = new Date();
          const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const warnKey = `QUOTA-WARN-${org.id}-${billingPeriod}`;

          const [alreadyFiredWarn] = await db
            .select({ id: processedWebhooks.id })
            .from(processedWebhooks)
            .where(
              and(
                eq(processedWebhooks.source, "midtrans"),
                eq(processedWebhooks.externalId, warnKey),
              ),
            );

          if (!alreadyFiredWarn) {
            await db.insert(processedWebhooks).values({
              externalId: warnKey,
              source: "midtrans",
            });
            await createNotification(
              org.id,
              "quota_warning",
              "Kuota pesan hampir habis",
              `${used} dari ${limit} pesan telah digunakan bulan ini`,
            ).catch(console.error);
          }
        }

        // Fire usage:updated — dashboard stat cards and usage bar update live
        triggerUsageUpdated(org.id, {
          messagesUsed: updatedOrg[0].messagesUsed,
          messagesLimit: updatedOrg[0].messagesLimit,
        }).catch(console.error);
      }
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
