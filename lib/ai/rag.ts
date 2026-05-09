// RAG pipeline — retrieves relevant document chunks for a given query
// Uses pgvector cosine similarity search scoped strictly to the org
// This file is wired to the DB in Step 9 — stub for now

import { embedText } from "@/lib/ai/embed"

// Number of chunks to retrieve per query — top 5 is the sweet spot for context window
const CHUNK_LIMIT = 5

// Default system prompt — customized per org in Phase 5
const DEFAULT_SYSTEM_PROMPT = `Kamu adalah asisten customer service yang membantu dan ramah. 
Jawab pertanyaan pelanggan HANYA berdasarkan informasi yang diberikan dalam konteks bisnis.
Jika informasi tidak tersedia dalam konteks, katakan dengan sopan bahwa kamu tidak memiliki informasi tersebut dan sarankan pelanggan untuk menghubungi bisnis secara langsung.
Selalu gunakan Bahasa Indonesia yang sopan dan profesional.
Jangan pernah mengarang informasi yang tidak ada dalam konteks.`

// Retrieves the top K most relevant chunks for a query within an org
// Returns empty array in stub — filled in after DB setup in Step 9
export async function retrieveContext(
  query: string,
  orgId: string
): Promise<string[]> {
  // Embed the query to get its vector representation
  const _queryEmbedding = await embedText(query)
  const _orgId = orgId
  const _limit = CHUNK_LIMIT

  // DB query will go here after Drizzle + pgvector setup in Step 9
  // Pattern: SELECT content FROM chunks
  //          WHERE org_id = $orgId
  //          ORDER BY embedding <=> $queryEmbedding
  //          LIMIT $limit
  return []
}

// Builds the system prompt with retrieved context injected
export function buildSystemPrompt(
  customPrompt: string | null,
  context: string[]
): string {
  // Use org's custom prompt if configured, otherwise fall back to default
  const basePrompt = customPrompt ?? DEFAULT_SYSTEM_PROMPT

  if (context.length === 0) return basePrompt

  // Inject retrieved chunks as numbered context blocks
  const contextBlock = context
    .map((chunk, i) => `[${i + 1}] ${chunk}`)
    .join("\n\n")

  return `${basePrompt}\n\nKonteks bisnis yang relevan:\n${contextBlock}`
}
