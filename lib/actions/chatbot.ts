// Server Actions for chatbot configuration
// All actions require active org — requireOrg() called at top of every action
// Input validated with Zod before touching DB

"use server";

import { z } from "zod/v4";
import { eq, gt, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { cacheDelete, CacheKeys } from "@/lib/redis";
import {
  chatbots,
  conversations,
  messages,
  documents,
  orgs,
} from "@/lib/db/schema";

// ── Validation schema — matches chatbots table constraints ──
const chatbotConfigSchema = z.object({
  // KUN owns name, tone, and greeting — only language, prompt, and color are configurable
  language: z.enum(["id", "en", "both"]),
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

  const { language, systemPrompt, accentColor } = result.data;

  await db
    .update(chatbots)
    .set({
      // KUN owns name, tone, and greeting — only these three are owner-configurable
      language,
      systemPrompt: systemPrompt?.trim() ? systemPrompt.trim() : null,
      accentColor,
    })
    .where(
      and(
        // IDOR protection — always scope to orgId
        eq(chatbots.orgId, orgId),
      ),
    );

  // Invalidate chatbot cache — next chat request fetches fresh config from Neon
  // Don't fail an already-committed write if Redis is down; TTL will expire stale data
  try {
    await cacheDelete(CacheKeys.chatbot(orgId));
  } catch (err) {
    console.error("Failed to invalidate chatbot cache", err);
  }

  // Track config saves — measures owner engagement with their chatbot setup
  // Never log systemPrompt content — could contain business-sensitive information
  trackEvent(orgId, "chatbot_configured", {
    language,
    has_custom_prompt: !!systemPrompt?.trim(),
    accent_color: accentColor,
  });

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

  // Invalidate chatbot cache — accent color change must reflect immediately
  // Don't fail an already-committed write if Redis is down; TTL will expire stale data
  try {
    await cacheDelete(CacheKeys.chatbot(orgId));
  } catch (err) {
    console.error("Failed to invalidate chatbot cache", err);
  }

  // Revalidate so BotStatusPanel and chatbot config page reflect new color
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/chatbot");

  return { ok: true };
}

// ── Save quick replies only ──
// Called immediately when chips are added or removed — no form submit needed
export async function saveQuickReplies(
  quickReplies: string[],
): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  // Validate array shape — same rules as full config
  const result = z
    .array(z.string().min(1).max(80))
    .max(5, "Maksimal 5 quick reply")
    .safeParse(quickReplies);

  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? "Input tidak valid",
    };
  }

  await db
    .update(chatbots)
    .set({
      // Empty array → null — keeps DB clean, widget shows no chips
      quickReplies: result.data.length > 0 ? JSON.stringify(result.data) : null,
    })
    .where(eq(chatbots.orgId, orgId));

  // Invalidate chatbot cache — next chat request fetches fresh config from Neon
  // Don't fail an already-committed write if Redis is down; TTL will expire stale data
  try {
    await cacheDelete(CacheKeys.chatbot(orgId));
  } catch (err) {
    console.error("Failed to invalidate chatbot cache", err);
  }

  revalidatePath("/dashboard/chatbot");

  return { ok: true };
}

// ── Get current chatbot config ──
// Called by the chatbot config page Server Component
export async function getChatbotConfig(): Promise<{
  language: string;
  systemPrompt: string | null;
  accentColor: string;
  isActive: boolean;
  quickReplies: string | null;
} | null> {
  const { orgId } = await requireOrg();

  const [chatbot] = await db
    .select({
      // KUN owns name, tone, and greeting — only fetch what owners can configure
      language: chatbots.language,
      systemPrompt: chatbots.systemPrompt,
      accentColor: chatbots.accentColor,
      isActive: chatbots.isActive,
      quickReplies: chatbots.quickReplies,
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
  try {
    const { orgId } = await requireOrg();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch pending conversations that have had message activity within 24h
    // groupBy + having filters out expired ones (no recent messages)
    const rows = await db
      .selectDistinct({ id: conversations.id })
      .from(conversations)
      .innerJoin(messages, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.handoffStatus, "pending_handoff"),
          // Only include conversations with at least one message after cutoff
          gt(messages.createdAt, cutoff),
        ),
      );

    // Count distinct conversation IDs — selectDistinct handles dedup at DB level
    return rows.length;
  } catch {
    return 0;
  }
}

// ── Get widget data — org slug + chatbot config for the widget page ──
// Returns everything needed to render embed code, QR, and live preview
export async function getWidgetData(): Promise<{
  orgSlug: string;
  accentColor: string;
} | null> {
  const { orgId } = await requireOrg();

  const [result] = await db
    .select({
      slug: orgs.slug,
      accentColor: chatbots.accentColor,
    })
    .from(chatbots)
    .innerJoin(orgs, eq(orgs.id, chatbots.orgId))
    .where(eq(chatbots.orgId, orgId))
    .limit(1);

  if (!result) return null;

  return {
    orgSlug: result.slug,
    accentColor: result.accentColor,
  };
}
