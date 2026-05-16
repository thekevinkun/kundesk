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
  // The customer's message — capped at 500 chars to prevent prompt stuffing
  message: z.string().min(1).max(500),
  // Browser-generated session ID — groups messages into one conversation
  sessionId: z.string().min(1).max(100),
  // The org's public slug — used to identify which tenant this chat belongs to
  orgSlug: z.string().min(1).max(100),
});

// ─── Prompt injection detection ───

// Known injection pattern signatures — expanded from OWASP LLM top 10
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

// Returns true if the message contains a known injection pattern.
// We return HTTP 200 with a deflection response — never tip off the attacker with a 4xx.
function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── Mock streaming ───

// Simulates token-by-token SSE streaming without hitting OpenAI.
// The UI streaming experience is identical — only the content differs.
function createMockStream(
  encoder: TextEncoder,
  conversationId: number,
): ReadableStream {
  const mockResponse =
    "Halo! Saya adalah asisten virtual bisnis ini. " +
    "Saat ini sistem berjalan dalam mode pengembangan (mock). " +
    "Dalam mode produksi, saya akan menjawab berdasarkan dokumen bisnis yang telah diupload. " +
    "Ada yang bisa saya bantu?";

  // Split into word-level tokens to simulate realistic streaming behavior
  const tokens = mockResponse.split(" ").map((word) => word + " ");

  return new ReadableStream({
    async start(controller) {
      for (const token of tokens) {
        // Format each token as an SSE data event — matches the real OpenAI stream format
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
        );
        // Small delay between tokens so the UI streaming effect is visible
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      // Signal end of stream — client uses this to know the response is complete
      // carries conversationId so widget can filter Pusher events
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ done: true, conversationId })}\n\n`,
        ),
      );
      controller.close();
    },
  });
}

// ─── Real OpenAI streaming ───

// Streams OpenAI chat completions token by token via SSE.
// Collects the full response in a buffer so we can save it to DB after streaming.
function createOpenAIStream(
  systemPrompt: string,
  conversationHistory: ConversationTurn[],
  userMessage: string,
  encoder: TextEncoder,
  conversationId: number,
  onComplete: (fullResponse: string) => void,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: env.openaiApiKey! });

      // Build the messages array — system prompt + last 6 turns + current message
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
          // Cap tokens to control cost — enough for a thorough customer service reply
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

        // Notify caller with the complete response text for DB storage
        onComplete(fullResponse);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, conversationId })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        // Save the user's message even on failure — history shouldn't be silently lost
        // Pass empty string — handleStreamComplete skips saving assistant msg when empty
        onComplete("");
        // Send error event so the client can show an error state instead of hanging
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

  // Helper to send a non-streaming error response — used before the stream starts
  const errorResponse = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // ── 1. Parse and validate request body ──
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

  // ── 2. IP-level rate limit ──
  // Get real client IP — Next.js sets x-forwarded-for in production
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

  // ── 3. Resolve org from slug ──
  // We need the full org record to check plan limits and get orgId for tenant isolation
  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  // Whether slug doesn't exist or chatbot is inactive — same response, never enumerate
  if (!org) {
    return errorResponse("Not found", 404);
  }

  // ── 4. Fetch chatbot config ──
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.orgId, org.id), eq(chatbots.isActive, true)))
    .limit(1);

  // If no active chatbot exists, treat same as not found — no enumeration
  if (!chatbot) {
    return errorResponse("Not found", 404);
  }

  // ── 5. Org-level rate limit ──
  const orgLimit = await checkOrgMessageLimit(org.id);
  if (!orgLimit.success) {
    return errorResponse(
      "Batas pesan organisasi tercapai. Coba lagi nanti.",
      429,
    );
  }

  // ── 6. Plan limit check ──
  // Atomic check — actual increment happens after successful stream completion
  if (org.messagesUsed >= org.messagesLimit) {
    return errorResponse(
      "Batas pesan bulanan telah tercapai. Silakan upgrade plan Anda.",
      402,
    );
  }

  // ── 7. Prompt injection detection ──
  if (detectInjection(message)) {
    // Return 200 with a natural deflection — attacker gets no signal that we detected them
    const deflectionStream = new ReadableStream({
      start(controller) {
        const deflection =
          "Maaf, saya hanya bisa membantu dengan pertanyaan seputar bisnis ini. " +
          "Ada yang bisa saya bantu?";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token: deflection })}\n\n`),
        );
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
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

  // ── 8a. Resolve or create conversation ──
  // sessionId is browser-generated — same session = same conversation thread
  let conversationId: number;

  const [existingConversation] = await db
    .select({ id: conversations.id })
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
  } else {
    // First message in this session — create a new conversation record
    const inserted = await db
      .insert(conversations)
      .values({
        orgId: org.id,
        sessionId,
        // Track which channel this came from — web widget for now, WhatsApp in Phase 11
        deliveryChannel: "web_widget",
        handoffStatus: "ai",
      })
      .returning({ id: conversations.id });

    // Guard against unexpected empty result — should never happen but Drizzle returns an array
    if (!inserted[0]) {
      return errorResponse("Failed to create conversation", 500);
    }

    conversationId = inserted[0].id;

    // Track new conversation start
    trackEvent(org.id, "conversation_started", {
      delivery_channel: "web_widget",
    });

    // Fire Pusher event — dashboard bell increments in real time
    triggerOrgEvent(org.id, "conversation:new", {
      conversationId,
      sessionId,
    }).catch(console.error); // fire-and-forget — don't block the stream

    // Only notify on truly new conversations — first message in this session
    createNotification(
      org.id,
      "conversation_new",
      "Percakapan baru dimulai",
      `${sessionId.slice(0, 8)}|${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
      conversationId,
    ).catch(console.error);
  }

  // ── 8b. Handoff check — if human has taken over, don't stream AI response ──
  // Check handoffStatus on the existing conversation
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
      // Staff is handling this — return a holding message, don't hit OpenAI
      const holdingStream = new ReadableStream({
        start(controller) {
          const msg =
            "Terima kasih, pesan kamu sudah diterima. Staff kami sedang menangani percakapan ini dan akan membalas sebentar lagi. 🙏";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token: msg })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId })}\n\n`,
            ),
          );
          controller.close();
        },
      });

      // Still save the user's message so staff can see it in the reply box
      await db.insert(messages).values({
        orgId: org.id,
        conversationId,
        role: "user",
        content: message,
      });

      // Notify staff — new customer message arrived during handoff
      createNotification(
        org.id,
        "message_new",
        "Pesan baru dari pelanggan",
        `${sessionId.slice(0, 8)}|${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
        conversationId,
      ).catch(console.error);

      // Notify dashboard — staff sees new customer message appear live
      triggerConversationMessage(org.id, {
        conversationId,
        role: "user",
        content: message,
      }).catch(console.error);

      return new Response(holdingStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // ── 9. Fetch last 6 messages for conversation history ──
  // Limiting to 6 prevents context window bloat and prompt injection via history
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

  // Reverse to chronological order — we fetched newest-first for the LIMIT
  const conversationHistory = recentMessages.reverse() as ConversationTurn[];

  // ── 10. RAG — retrieve relevant context chunks ──
  const contextChunks = await retrieveContext(message, org.id);

  // ── 11. Build system prompt with injected context ──
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

  // ── 12. Build and return SSE stream ──
  // This callback fires when the stream completes — saves messages and increments usage
  const handleStreamComplete = async (assistantResponse: string) => {
    try {
      await db.transaction(async (tx) => {
        // Save the user's message
        await tx.insert(messages).values({
          orgId: org.id,
          conversationId,
          role: "user",
          content: message,
        });

        // Save assistant response only if non-empty — empty means stream failed
        if (assistantResponse) {
          await tx.insert(messages).values({
            orgId: org.id,
            conversationId,
            role: "assistant",
            content: assistantResponse,
          });
        }

        // True atomic increment with SQL-level limit enforcement —
        // WHERE clause prevents exceeding the limit even under concurrent load
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

      // Notify dashboard of new message — fire-and-forget outside transaction
      triggerOrgEvent(org.id, "conversation:message", {
        conversationId,
      }).catch(console.error);

      // Track chat message — gives us per-org volume in PostHog
      trackEvent(org.id, "chat_message_sent", {
        delivery_channel: "web_widget",
        ai_mode: env.aiMode,
      });

      // ── Usage warning email at 80% quota ──
      // Check after increment — fire once when they cross the threshold
      // Fire and forget — never block the chat response over an email
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

        // Fire at exactly 80% — the increment just crossed the threshold
        // Checking used === Math.floor(limit * 0.8) prevents repeat emails
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
      // Log but don't crash — the customer already received their response
      console.error("[chat] Failed to save messages after stream:", err);
    }
  };

  // Choose mock or real stream based on AI mode env var
  const stream =
    env.aiMode === "mock"
      ? createMockStream(encoder, conversationId)
      : createOpenAIStream(
          systemPrompt,
          conversationHistory,
          message,
          encoder,
          conversationId,
          handleStreamComplete,
        );

  // In mock mode, save messages with a placeholder response
  if (env.aiMode === "mock") {
    // Fire-and-forget — don't await, stream starts immediately
    handleStreamComplete(
      "Mock response — AI mode is set to mock. Switch KUNDESK_AI_MODE=openai for real responses.",
    ).catch(console.error);
  }

  return new Response(stream, {
    headers: {
      // text/event-stream is the SSE content type — browser keeps connection open
      "Content-Type": "text/event-stream",
      // no-cache prevents the browser or CDN from buffering the stream
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
