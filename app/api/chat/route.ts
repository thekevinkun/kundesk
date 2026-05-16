import { NextRequest } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { trackEvent } from "@/lib/posthog";
import { sendUsageWarningEmail } from "@/lib/email";
import { createNotification } from "@/lib/db/queries/dashboard";
import { retrieveContext, buildSystemPrompt } from "@/lib/ai/rag";
import { checkChatRateLimit, checkOrgMessageLimit } from "@/lib/redis";
import { orgs, chatbots, conversations, messages } from "@/lib/db/schema";
import { triggerOrgEvent, triggerConversationMessage } from "@/lib/pusher";
import type { ConversationTurn } from "@/types/chat";

// ─── Input validation ───

const chatRequestSchema = z.object({
  message: z.string().min(1).max(500),
  sessionId: z.string().min(1).max(100),
  orgSlug: z.string().min(1).max(100),
});

// ─── Prompt injection detection ───

const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above|all)\s+instructions?/i,
  /forget\s+(everything|all|your|the)\s+(instructions?|rules?|context)/i,
  /you\s+are\s+now\s+(a\s+)?(?!the\s+assistant)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(?!a\s+helpful)/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /override\s+(your\s+)?(instructions?|rules?|guidelines?)/i,
  /system\s*prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|rules?)/i,
  /what\s+are\s+your\s+instructions/i,
  /disregard\s+(your\s+)?(previous|prior|all)/i,
  /bypass\s+(your\s+)?(restrictions?|filters?|rules?)/i,
  /<\s*script/i,
  /\{\{.*\}\}/i,
];

function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

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
  onComplete: (fullResponse: string) => void,
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

        onComplete(fullResponse);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, conversationId, channelToken })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        onComplete("");
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Stream failed" })}\n\n`,
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

  // ── 3. Resolve org ──
  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  if (!org) {
    return errorResponse("Not found", 404);
  }

  // ── 4. Fetch chatbot ──
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.orgId, org.id), eq(chatbots.isActive, true)))
    .limit(1);

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

  // ── 6. Prompt injection ──
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

  // ── 7. Resolve or create conversation ──
  let conversationId: number;
  let channelToken: string;

  const [existingConversation] = await db
    .select({ id: conversations.id, channelToken: conversations.channelToken })
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, org.id),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);

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

  // ── 8. Handoff check — bypass AI if staff is handling ──
  if (existingConversation) {
    const [convoStatus] = await db
      .select({ handoffStatus: conversations.handoffStatus })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, org.id),
        ),
      )
      .limit(1);

    if (convoStatus?.handoffStatus === "human") {
      // Save user message so staff sees it in the reply box
      await db.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "user",
        content: message,
      });

      // Notify staff — new customer message during handoff
      createNotification(
        org.id,
        "message_new",
        "Pesan baru dari pelanggan",
        `${sessionId.slice(0, 8)}|${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
        conversationId,
      ).catch(console.error);

      // Live update dashboard + customer widget
      triggerConversationMessage(org.id, channelToken, {
        conversationId,
        role: "user",
        content: message,
      }).catch(console.error);

      // Return holding message — don't hit OpenAI
      const holdingStream = new ReadableStream({
        start(controller) {
          const msg =
            "Terima kasih, pesan kamu sudah diterima. Staff kami sedang menangani percakapan ini dan akan membalas sebentar lagi. 🙏";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token: msg })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId, channelToken })}\n\n`,
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

  // ── 9. Plan limit check — only for AI responses, not handoff messages ──
  // Human handoff messages bypass OpenAI entirely — no cost, no quota consumed
  if (org.messagesUsed >= org.messagesLimit) {
    return errorResponse(
      "Batas pesan bulanan telah tercapai. Silakan upgrade plan Anda.",
      402,
    );
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

  const conversationHistory = recentMessages.reverse() as ConversationTurn[];

  // ── 11. RAG context ──
  const contextChunks = await retrieveContext(message, org.id);

  // ── 12. Build system prompt ──
  const systemPrompt = buildSystemPrompt(
    {
      name: chatbot.name,
      tone: chatbot.tone as "friendly" | "professional" | "formal",
      language: chatbot.language as "id" | "en" | "both",
      accentColor: chatbot.accentColor,
      greetingMessage: chatbot.greetingMessage,
      systemPrompt: chatbot.systemPrompt,
    },
    contextChunks,
  );

  // ── 13. Stream ──
  const handleStreamComplete = async (assistantResponse: string) => {
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
          sendUsageWarningEmail(
            org.ownerEmail ?? "",
            org.name ?? "",
            used,
            limit,
            env.logoUrl,
          ).catch((err) =>
            console.error("[chat] Failed to send usage warning email:", err),
          );
        }
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
