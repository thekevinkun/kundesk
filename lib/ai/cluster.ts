// Semantic clustering of top user questions using OpenAI
// Groups semantically similar questions into topic clusters with counts
// Falls back to mock grouping when KUNDESK_AI_MODE=mock

import OpenAI from "openai";
import { env } from "@/lib/env";

export interface QuestionCluster {
  topic: string; // Clean topic label — e.g. "Jadwal & Jam Buka"
  count: number; // Total occurrences across all questions in this cluster
  examples: string[]; // Up to 3 representative raw questions
}

// Mock grouping — simple keyword extraction, no OpenAI
// Groups by first meaningful noun/verb in the question
function mockCluster(
  questions: { question: string; count: number }[],
): QuestionCluster[] {
  // In mock mode — return questions as-is, each as its own "cluster"
  // Truncate topic to first 6 words for cleanliness
  return questions.slice(0, 8).map((q) => ({
    topic: q.question.split(" ").slice(0, 6).join(" "),
    count: q.count,
    examples: [q.question],
  }));
}

// Real AI clustering — sends raw questions to OpenAI, returns grouped topics
async function aiCluster(
  questions: { question: string; count: number }[],
): Promise<QuestionCluster[]> {
  const openai = new OpenAI({ apiKey: env.openaiApiKey! });
  const REQUEST_TIMEOUT_MS = 8000;

  // Format questions for the prompt — include counts so AI weighs them correctly
  const formatted = questions
    .map((q, i) => `${i + 1}. "${q.question}" (${q.count}x)`)
    .join("\n");

  const response = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.2, // Low temperature — we want consistent, factual grouping
      messages: [
        {
          role: "system",
          content: `Kamu adalah analis data untuk platform customer service Indonesia.
          Tugasmu: kelompokkan pertanyaan pelanggan yang memiliki makna serupa menjadi topik-topik.

          Aturan:
          - Gabungkan pertanyaan yang intinya sama (walau kata-katanya berbeda)
          - Buat label topik singkat dalam Bahasa Indonesia (2-4 kata, Title Case)
          - Jumlahkan count dari semua pertanyaan yang digabungkan
          - Sertakan maksimal 3 contoh pertanyaan asli per topik
          - Kembalikan maksimal 8 topik, urutkan dari count terbesar
          - HANYA kembalikan JSON, tanpa penjelasan apapun

          Format output (JSON array):
          [
            {
              "topic": "Label Topik",
              "count": 5,
              "examples": ["pertanyaan asli 1", "pertanyaan asli 2"]
            }
          ]`,
        },
        {
          role: "user",
          content: `Kelompokkan pertanyaan-pertanyaan ini:\n\n${formatted}`,
        },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("AI clustering request timed out")),
        REQUEST_TIMEOUT_MS,
      ),
    ),
  ]);

  const raw = response.choices[0]?.message?.content ?? "[]";

  // Strip markdown fences if model wraps in ```json
  const clean = raw.replace(/```json|```/g, "").trim();

  const parsed: unknown = JSON.parse(clean);
  if (!Array.isArray(parsed)) throw new Error("Invalid cluster payload");

  const normalized = parsed
    .filter(
      (item): item is QuestionCluster =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { topic?: unknown }).topic === "string" &&
        typeof (item as { count?: unknown }).count === "number" &&
        Array.isArray((item as { examples?: unknown }).examples),
    )
    .map((item) => ({
      topic: item.topic.trim(),
      count: item.count,
      examples: item.examples
        .filter((ex): ex is string => typeof ex === "string")
        .slice(0, 3),
    }))
    .filter((item) => item.topic.length > 0 && item.count >= 0);

  if (normalized.length === 0) throw new Error("No valid clusters returned");
  return normalized.slice(0, 8);
}

// Main export — called from analytics page server component
// Transparent mode switching — caller never checks env directly
export async function clusterTopQuestions(
  questions: { question: string; count: number }[],
): Promise<QuestionCluster[]> {
  // Nothing to cluster
  if (questions.length === 0) return [];

  if (env.aiMode === "mock") {
    return mockCluster(questions);
  }

  try {
    return await aiCluster(questions);
  } catch (err) {
    // Fallback to mock on any OpenAI error — analytics page still renders
    console.error("[clusterTopQuestions] OpenAI failed, falling back:", err);
    return mockCluster(questions);
  }
}
