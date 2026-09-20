// Unit tests for embedTexts (lib/ai/embed.ts)
// fetch is stubbed — no real network calls

import { describe, it, expect, vi, afterEach } from "vitest";

// Mutable env so a test can flip embeddingMode (vi.hoisted runs before the mock factory)
const mockEnv = vi.hoisted(() => ({
  embeddingMode: "mock" as "mock" | "openai",
  openaiApiKey: "sk-test" as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

import { embedTexts } from "./embed";

// Fake OpenAI: each text is a number string, so its "embedding" is [thatNumber] — order is checkable
// Returns items in REVERSE order on purpose to prove the code sorts by index
function makeFetchMock() {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const { input } = JSON.parse(String(init?.body)) as { input: string[] };
    const data = input.map((text, index) => ({
      index,
      embedding: [Number(text)],
    }));
    // New Response per call — a Response body can only be read once
    return new Response(JSON.stringify({ data: data.reverse() }), {
      status: 200,
    });
  });
}

describe("embedTexts", () => {
  afterEach(() => {
    mockEnv.embeddingMode = "mock";
    mockEnv.openaiApiKey = "sk-test";
    vi.unstubAllGlobals();
  });

  it("returns [] for empty input without touching the network", async () => {
    mockEnv.embeddingMode = "openai";
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    expect(await embedTexts([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns one 1536-dim vector per text in mock mode", async () => {
    const result = await embedTexts(["a", "b", "c"]);

    expect(result).toHaveLength(3);
    result.forEach((vector) => expect(vector).toHaveLength(1536));
  });

  it("splits 250 texts into 3 requests and keeps the original order", async () => {
    mockEnv.embeddingMode = "openai";
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const texts = Array.from({ length: 250 }, (_, i) => String(i));
    const result = await embedTexts(texts);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    expect(result).toEqual(texts.map((text) => [Number(text)]));
  });

  it("throws on an OpenAI error response", async () => {
    mockEnv.embeddingMode = "openai";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("boom", { status: 500, statusText: "Server Error" }),
      ),
    );

    await expect(embedTexts(["a"])).rejects.toThrow("OpenAI embeddings error");
  });

  it("throws when OpenAI returns fewer vectors than texts", async () => {
    mockEnv.embeddingMode = "openai";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: [{ index: 0, embedding: [1] }] }),
            {
              status: 200,
            },
          ),
      ),
    );

    await expect(embedTexts(["a", "b"])).rejects.toThrow(
      "unexpected result count",
    );
  });

  it("throws when the API key is missing in openai mode", async () => {
    mockEnv.embeddingMode = "openai";
    mockEnv.openaiApiKey = undefined;

    await expect(embedTexts(["a"])).rejects.toThrow("OPENAI_API_KEY");
  });
});
