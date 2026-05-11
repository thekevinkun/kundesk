// Splits plain text into overlapping chunks for RAG embedding
// Pure function — no side effects, fully unit testable
// Target: ~500 tokens per chunk, 50 token overlap between consecutive chunks

// Approximate token count for Indonesian text — 1 token ≈ 3 characters
// Indonesian has longer words than English so the standard "4 chars" underestimates token count
// Using 3 produces chunks of ~600–900 chars which matches ~250–350 tokens — better retrieval precision
const CHARS_PER_TOKEN = 3;
const TARGET_CHUNK_TOKENS = 300; // was 500 — produces ~900 char chunks for Indonesian
const OVERLAP_TOKENS = 30; // was 50 — proportional to new target

const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN; // 2000 chars
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // 200 chars

// A single chunk ready for embedding and storage
export interface TextChunk {
  content: string; // the chunk text — stored in chunks.content
  index: number; // position in the document — useful for debugging
}

// Splits text into overlapping chunks
// Tries to break at sentence boundaries (". ") to avoid cutting mid-thought
// Falls back to hard character limit if no good break point found
export function chunkText(text: string): TextChunk[] {
  // Normalize whitespace — collapse multiple newlines and spaces
  const normalized = text
    .replace(/\r\n/g, "\n") // normalize line endings
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .replace(/[ \t]+/g, " ") // collapse horizontal whitespace
    .trim();

  // Short texts don't need chunking — return as single chunk
  if (normalized.length <= TARGET_CHUNK_CHARS) {
    return [{ content: normalized, index: 0 }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    // End of this chunk — either target size or end of text
    const end = Math.min(start + TARGET_CHUNK_CHARS, normalized.length);

    // If we're not at the end of the text, try to break at a sentence boundary
    // Look backwards from end for ". " — cleaner break than mid-sentence
    let breakPoint = end;
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const lastPeriod = slice.lastIndexOf(". ");

      // Only use sentence break if it's in the second half of the chunk
      // Prevents tiny chunks if the first sentence is very long
      if (lastPeriod > TARGET_CHUNK_CHARS / 2) {
        breakPoint = start + lastPeriod + 2; // +2 to include ". "
      }
    }

    const content = normalized.slice(start, breakPoint).trim();

    // Skip empty chunks (can happen with excessive whitespace at boundaries)
    if (content.length > 0) {
      chunks.push({ content, index });
      index++;
    }

    // Next chunk starts OVERLAP_CHARS before the end of this one
    // This is the sliding window — overlap preserves cross-boundary context
    // If we've reached the end of the text, exit the loop
    if (breakPoint >= normalized.length) {
      break;
    }
    start = Math.max(breakPoint - OVERLAP_CHARS, start + 1);
  }

  return chunks;
}

// Counts approximate tokens in a string — used for logging and diagnostics
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
