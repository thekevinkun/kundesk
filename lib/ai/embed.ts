// Text embedding — converts text into a vector for pgvector similarity search
// Mode switch happens here — callers never check the env variable directly
// text-embedding-3-small produces 1536-dimensional vectors

import { env } from "@/lib/env";

// Returns a 1536-dimensional embedding vector for the given text
export async function embedText(text: string): Promise<number[]> {
  // Mock mode — returns random float[] of correct shape (1536 dims)
  // Vector math and similarity search still work — values are just meaningless
  if (env.embeddingMode === "mock") {
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  }

  // Real mode — calls OpenAI text-embedding-3-small
  if (!env.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required when KUNDESK_EMBEDDING_MODE=openai",
    );
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  // Extract the embedding vector from the response
  const embedding = data.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned from OpenAI");

  return embedding;
}

// Max texts per OpenAI request — the API allows 2048, this keeps each request small and fast
const EMBED_BATCH_SIZE = 100;

// Embeds many texts with few requests — for bulk work like syncing a whole section
// Returns one vector per input text, in the same order
// signal is optional — combined with a 30s per-request timeout
export async function embedTexts(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  // Nothing to embed — skip the network entirely
  if (texts.length === 0) return [];

  // Mock mode — same shape as embedText: 1536 random floats per text
  if (env.embeddingMode === "mock") {
    return texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
    );
  }

  if (!env.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required when KUNDESK_EMBEDDING_MODE=openai",
    );
  }

  const results: number[][] = [];

  // Sequential batches — one request per EMBED_BATCH_SIZE texts
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const timeout = AbortSignal.timeout(30_000);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      body: JSON.stringify({ model: "text-embedding-3-small", input: batch }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };

    // A short answer would silently shift every later vector onto the wrong chunk
    if (data.data.length !== batch.length) {
      throw new Error("OpenAI embeddings error: unexpected result count");
    }

    // The API reports each item's position — sort by it instead of trusting response order
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) results.push(item.embedding);
  }

  return results;
}
