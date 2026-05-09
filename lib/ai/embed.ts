// Text embedding — converts text into a vector for pgvector similarity search
// Mode switch happens here — callers never check the env variable directly
// text-embedding-3-small produces 1536-dimensional vectors

import { env } from "@/lib/env"

// Returns a 1536-dimensional embedding vector for the given text
export async function embedText(text: string): Promise<number[]> {
  // Mock mode — returns random float[] of correct shape (1536 dims)
  // Vector math and similarity search still work — values are just meaningless
  if (env.embeddingMode === "mock") {
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }

  // Real mode — calls OpenAI text-embedding-3-small
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required when KUNDESK_EMBEDDING_MODE=openai")
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${response.statusText}`)
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>
  }

  // Extract the embedding vector from the response
  const embedding = data.data[0]?.embedding
  if (!embedding) throw new Error("No embedding returned from OpenAI")

  return embedding
}
