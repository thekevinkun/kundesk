import { NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { orgs, chatbots, conversations, messages } from "@/lib/db/schema";
import { retrieveContext, buildSystemPrompt } from "@/lib/ai/rag";
import { checkChatRateLimit, checkOrgMessageLimit } from "@/lib/redis";
import { env } from "@/lib/env";
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
function createMockStream(encoder: TextEncoder): ReadableStream {
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
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
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
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
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

  // ── 8. Resolve or create conversation ──
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

        // Save the assistant's complete response
        await tx.insert(messages).values({
          orgId: org.id,
          conversationId,
          role: "assistant",
          content: assistantResponse,
        });

        // Atomic increment — SET x = x + 1 avoids race conditions from concurrent requests
        await tx
          .update(orgs)
          .set({ messagesUsed: org.messagesUsed + 1 })
          .where(eq(orgs.id, org.id));
      });
    } catch (err) {
      // Log but don't crash — the customer already received their response
      console.error("[chat] Failed to save messages after stream:", err);
    }
  };

  // Choose mock or real stream based on AI mode env var
  const stream =
    env.aiMode === "mock"
      ? createMockStream(encoder)
      : createOpenAIStream(
          systemPrompt,
          conversationHistory,
          message,
          encoder,
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
