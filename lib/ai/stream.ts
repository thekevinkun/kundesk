// SSE streaming — streams AI responses token by token to the browser
// Mock stream simulates real OpenAI streaming with realistic Bahasa Indonesia response
// Real stream calls OpenAI gpt-4o-mini with the RAG context

import { env } from "@/lib/env"
import type { ChatMessage } from "@/types/chat"

// Mock response in Bahasa Indonesia — realistic enough to test the full streaming UI
const MOCK_RESPONSE = `Terima kasih sudah menghubungi kami! Berdasarkan informasi yang kami miliki, saya dapat membantu menjawab pertanyaan Anda. Silakan tanyakan lebih lanjut mengenai produk atau layanan kami, dan saya akan berusaha memberikan jawaban yang akurat dan helpful. Apakah ada hal lain yang ingin Anda ketahui?`

// Creates a mock ReadableStream that simulates token-by-token SSE delivery
function createMockStream(): ReadableStream<Uint8Array> {
  const tokens = MOCK_RESPONSE.split(" ")
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      // Stream each word with a realistic delay between tokens
      for (const token of tokens) {
        const chunk = `data: ${JSON.stringify({ type: "token", content: token + " " })}\n\n`
        controller.enqueue(encoder.encode(chunk))

        // 50ms delay between tokens — matches real OpenAI streaming feel
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Signal stream completion
      const done = `data: ${JSON.stringify({ type: "done" })}\n\n`
      controller.enqueue(encoder.encode(done))
      controller.close()
    },
  })
}

// Creates a real OpenAI streaming response using the RAG context
async function createOpenAIStream(
  messages: ChatMessage[],
  context: string[],
  systemPrompt: string
): Promise<ReadableStream<Uint8Array>> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required when KUNDESK_AI_MODE=openai")
  }

  const encoder = new TextEncoder()

  // Build the system prompt with RAG context injected
  const contextBlock = context.length > 0
    ? `\n\nInformasi bisnis yang relevan:\n${context.join("\n\n")}`
    : ""

  const fullSystemPrompt = systemPrompt + contextBlock

  // Build message history for OpenAI — only last 6 messages to prevent context dilution
  const recentMessages = messages.slice(-6).map(m => ({
    role: m.role === "human_agent" ? "assistant" as const : m.role as "user" | "assistant",
    content: m.content,
  }))

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: fullSystemPrompt },
        ...recentMessages,
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI chat error: ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error("No response body from OpenAI")
  }

  // Transform OpenAI SSE format into our StreamEvent format
  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n").filter(line => line.startsWith("data: "))

          for (const line of lines) {
            const data = line.slice(6) // Remove "data: " prefix

            // OpenAI signals end of stream with [DONE]
            if (data === "[DONE]") {
              const done = `data: ${JSON.stringify({ type: "done" })}\n\n`
              controller.enqueue(encoder.encode(done))
              controller.close()
              return
            }

            try {
              const parsed = JSON.parse(data) as {
                choices: Array<{
                  delta: { content?: string }
                }>
              }

              const content = parsed.choices[0]?.delta?.content
              if (content) {
                const token = `data: ${JSON.stringify({ type: "token", content })}\n\n`
                controller.enqueue(encoder.encode(token))
              }
            } catch {
              // Skip malformed chunks — OpenAI occasionally sends partial JSON
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    },
  })
}

// Main export — callers never check env directly
export async function streamChatResponse(
  messages: ChatMessage[],
  context: string[],
  systemPrompt: string
): Promise<ReadableStream<Uint8Array>> {
  if (env.aiMode === "mock") {
    return createMockStream()
  }

  return createOpenAIStream(messages, context, systemPrompt)
}
