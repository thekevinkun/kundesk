// Unit tests for helpers/chunk.ts
// Pure function — no mocks needed
// Covers: single chunk short text, multi-chunk long text, overlap, sentence boundary, whitespace normalization

import { describe, it, expect } from "vitest";
import { chunkText, estimateTokenCount } from "./chunk";

// Constants mirrored from chunk.ts — tests should not import private constants
const CHARS_PER_TOKEN = 3;
const TARGET_CHUNK_CHARS = 300 * CHARS_PER_TOKEN; // 900 chars

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const text = "Halo, ini adalah teks pendek.";
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(text);
    expect(chunks[0]?.index).toBe(0);
  });

  it("returns correct index values for each chunk", () => {
    // Generate text long enough to produce multiple chunks
    const longText = "Kalimat ini diulang terus. ".repeat(200);
    const chunks = chunkText(longText);

    // Indexes must be sequential starting from 0
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it("produces multiple chunks for text longer than target size", () => {
    // 200 repetitions × ~26 chars = ~5200 chars — well above 900 char target
    const longText = "Ini adalah kalimat panjang untuk pengujian. ".repeat(200);
    const chunks = chunkText(longText);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it("no chunk exceeds the target character limit", () => {
    const longText = "Kata ".repeat(1000);
    const chunks = chunkText(longText);

    chunks.forEach((chunk) => {
      // Allow small overage from sentence boundary adjustment
      expect(chunk.content.length).toBeLessThanOrEqual(TARGET_CHUNK_CHARS + 50);
    });
  });

  it("consecutive chunks overlap — end of one appears in start of next", () => {
    // Use a text with clear repeating sentences so overlap is detectable
    const sentence =
      "Ini adalah kalimat yang cukup panjang untuk pengujian overlap antar chunk. ";
    const longText = sentence.repeat(100);
    const chunks = chunkText(longText);

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // Last 100 chars of chunk[0] should appear somewhere in chunk[1]
    const endOfFirst = chunks[0]?.content.slice(-100).trim() ?? "";
    expect(chunks[1]?.content).toContain(endOfFirst.slice(0, 50));
  });

  it("normalizes Windows line endings to Unix", () => {
    const text = "Baris pertama.\r\nBaris kedua.\r\nBaris ketiga.";
    const chunks = chunkText(text);

    // \r\n should be gone
    chunks.forEach((chunk) => {
      expect(chunk.content).not.toContain("\r");
    });
  });

  it("collapses excessive blank lines to maximum two newlines", () => {
    const text = "Paragraf satu.\n\n\n\n\nParagraf dua.";
    const chunks = chunkText(text);

    chunks.forEach((chunk) => {
      expect(chunk.content).not.toMatch(/\n{3,}/);
    });
  });

  it("collapses multiple spaces into one", () => {
    const text = "Kata   pertama    kata   kedua.";
    const chunks = chunkText(text);

    chunks.forEach((chunk) => {
      expect(chunk.content).not.toMatch(/[ \t]{2,}/);
    });
  });

  it("trims leading and trailing whitespace from the whole text", () => {
    const text = "   \n  Teks dengan spasi di sekitarnya.  \n  ";
    const chunks = chunkText(text);

    expect(chunks[0]?.content).toBe("Teks dengan spasi di sekitarnya.");
  });

  it("returns a single chunk for empty string", () => {
    // Empty string normalizes to "" — early return fires, returns one chunk with empty content
    const chunks = chunkText("");
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.content).toBe("");
  });

  it("returns a single chunk for whitespace-only string", () => {
    // Whitespace normalizes to "" — same early return behaviour as empty string
    const chunks = chunkText("   \n\n   ");
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.content).toBe("");
  });

  it("prefers sentence boundaries over hard character limits", () => {
    // Build a text where a ". " exists near the target boundary
    // 800 chars + period + more text — boundary should land at the period
    const firstPart = "A".repeat(800) + ". ";
    const secondPart = "B".repeat(800) + ". ";
    const text = firstPart + secondPart;

    const chunks = chunkText(text);

    if (chunks.length >= 2) {
      // First chunk should end with ". " boundary, not mid-word
      expect(chunks[0]?.content.endsWith(".")).toBe(true);
    }
  });

  it("all chunk content is non-empty", () => {
    const longText = "Pengujian konten. ".repeat(300);
    const chunks = chunkText(longText);

    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });
});

describe("estimateTokenCount", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokenCount("")).toBe(0);
  });

  it("estimates correctly using 3 chars per token", () => {
    // 9 chars / 3 = 3 tokens
    expect(estimateTokenCount("abcdefghi")).toBe(3);
  });

  it("rounds up for non-divisible lengths", () => {
    // 10 chars / 3 = 3.33 → ceil → 4
    expect(estimateTokenCount("abcdefghij")).toBe(4);
  });

  it("scales linearly with text length", () => {
    const short = estimateTokenCount("abc"); // 1
    const long = estimateTokenCount("abc".repeat(10)); // 10

    expect(long).toBe(short * 10);
  });
});
