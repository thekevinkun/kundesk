// Server Actions for chatbot configuration
// All actions require active org — requireOrg() called at top of every action
// Input validated with Zod before touching DB

"use server";

import { z } from "zod/v4";
import { eq, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatbots, conversations, documents, orgs } from "@/lib/db/schema";

// ── Validation schema — matches chatbots table constraints ──
const chatbotConfigSchema = z.object({
  name: z
    .string()
    .min(1, "Nama bot wajib diisi")
    .max(50, "Nama terlalu panjang"),
  language: z.enum(["id", "en", "both"]),
  tone: z.enum(["friendly", "professional", "formal"]),
  greetingMessage: z
    .string()
    .max(300, "Pesan sambutan terlalu panjang")
    .optional(),
  systemPrompt: z
    .string()
    .max(2000, "System prompt terlalu panjang")
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format warna tidak valid"),
});

// ── Action result type — consistent with Project Bible ActionResult pattern ──
export type ActionResult = { ok: true } | { ok: false; error: string };

// ── Save full chatbot config ──
// Called by the chatbot config page form
export async function saveChatbotConfig(
  rawInput: unknown,
): Promise<ActionResult> {
  // Always get orgId from server session — never from client
  const { orgId } = await requireOrg();

  // Validate all fields before touching DB
  const result = chatbotConfigSchema.safeParse(rawInput);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? "Input tidak valid",
    };
  }

  const { name, language, tone, greetingMessage, systemPrompt, accentColor } =
    result.data;

  await db
    .update(chatbots)
    .set({
      name,
      language,
      tone,
      // Empty string → null — keeps DB clean
      greetingMessage: greetingMessage?.trim() ? greetingMessage.trim() : null,
      systemPrompt: systemPrompt?.trim() ? systemPrompt.trim() : null,
      accentColor,
    })
    .where(
      and(
        // IDOR protection — always scope to orgId
        eq(chatbots.orgId, orgId),
      ),
    );

  // Revalidate dashboard so stat cards and bot status panel reflect new config
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/chatbot");

  return { ok: true };
}

// ── Save accent color only ──
// Called by the Topbar color picker — lightweight, no form submit
export async function saveAccentColor(
  accentColor: string,
): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  // Validate hex color format
  const result = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format warna tidak valid")
    .safeParse(accentColor);

  if (!result.success) {
    return { ok: false, error: "Format warna tidak valid" };
  }

  await db
    .update(chatbots)
    .set({ accentColor: result.data })
    .where(eq(chatbots.orgId, orgId));

  // Revalidate so BotStatusPanel and chatbot config page reflect new color
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/chatbot");

  return { ok: true };
}

// ── Get current chatbot config ──
// Called by the chatbot config page Server Component
export async function getChatbotConfig(): Promise<{
  name: string;
  language: string;
  tone: string;
  greetingMessage: string | null;
  systemPrompt: string | null;
  accentColor: string;
  isActive: boolean;
} | null> {
  const { orgId } = await requireOrg();

  const [chatbot] = await db
    .select({
      name: chatbots.name,
      language: chatbots.language,
      tone: chatbots.tone,
      greetingMessage: chatbots.greetingMessage,
      systemPrompt: chatbots.systemPrompt,
      accentColor: chatbots.accentColor,
      isActive: chatbots.isActive,
    })
    .from(chatbots)
    .where(eq(chatbots.orgId, orgId))
    .limit(1);

  return chatbot ?? null;
}

// ── Get document count — for sidebar badge ──
// Separate from full dashboard queries — called independently by sidebar
export async function getDocumentCount(): Promise<number> {
  const { orgId } = await requireOrg();

  const [result] = await db
    .select({ total: count() })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        // Only count ready documents — processing ones aren't in knowledge base yet
        eq(documents.status, "ready"),
      ),
    );

  return result?.total ?? 0;
}

// ── Get pending handoff count — for conversations badge ──
// Counts conversations where human attention is needed
export async function getPendingHandoffCount(): Promise<number> {
  const { orgId } = await requireOrg();

  const [result] = await db
    .select({ total: count() })
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, orgId),
        // Only pending_handoff — these need the owner's attention right now
        eq(conversations.handoffStatus, "pending_handoff"),
      ),
    );

  return result?.total ?? 0;
}

// ── Get widget data — org slug + chatbot config for the widget page ──
// Returns everything needed to render embed code, QR, and live preview
export async function getWidgetData(): Promise<{
  orgSlug: string;
  chatbotName: string;
  accentColor: string;
  greetingMessage: string | null;
} | null> {
  const { orgId } = await requireOrg();

  const [result] = await db
    .select({
      slug: orgs.slug,
      name: chatbots.name,
      accentColor: chatbots.accentColor,
      greetingMessage: chatbots.greetingMessage,
    })
    .from(chatbots)
    .innerJoin(orgs, eq(orgs.id, chatbots.orgId))
    .where(eq(chatbots.orgId, orgId))
    .limit(1);

  if (!result) return null;

  return {
    orgSlug: result.slug,
    chatbotName: result.name,
    accentColor: result.accentColor,
    greetingMessage: result.greetingMessage,
  };
}
