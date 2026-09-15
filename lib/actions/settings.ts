// Server Actions for org-level settings
// Separate from chatbot actions — settings touch the orgs table, not chatbots
// All actions: requireOrg() first → Zod validate → DB → revalidate

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { eq, and, isNull } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { orgs } from "@/lib/db/schema";
import { requireOrg, requireOrgAdmin } from "@/lib/auth";
import { sendOrgDeletionEmail } from "@/lib/email";
import type { ActionResult } from "@/types/api";

// ── Validation schema for org profile update ──
const orgProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Nama bisnis minimal 2 karakter")
    .max(80, "Nama bisnis terlalu panjang"),
  slug: z
    .string()
    .min(3, "Slug minimal 3 karakter")
    .max(50, "Slug terlalu panjang")
    // Lowercase alphanumeric + hyphens only — used in public URL
    .regex(
      /^[a-z0-9-]+$/,
      "Slug hanya boleh huruf kecil, angka, dan tanda hubung",
    ),
});

// ── Get current org settings ──
// Called by the settings page Server Component
// Returns only what the settings page needs — not the full orgs row
export async function getOrgSettings(): Promise<{
  name: string;
  slug: string;
  ownerEmail: string | null;
  plan: string;
  subscriptionStatus: string;
  deletionRequestedAt: Date | null;
} | null> {
  const { orgId } = await requireOrg();

  const [org] = await db
    .select({
      name: orgs.name,
      slug: orgs.slug,
      ownerEmail: orgs.ownerEmail,
      plan: orgs.plan,
      subscriptionStatus: orgs.subscriptionStatus,
      deletionRequestedAt: orgs.deletionRequestedAt,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return org ?? null;
}

// ── Update org name and slug ──
// Slug change is safe — dashboard URL is org-based (Clerk), not slug-based
// Public chat URL /chat/[slug] will change — user is warned via modal before submit
export async function updateOrgProfile(
  rawInput: unknown,
): Promise<ActionResult<{ slug: string }>> {
  // Mutation — admin only (Phase 16 decision)
  const { orgId } = await requireOrgAdmin();

  // Validate input before touching DB
  const result = orgProfileSchema.safeParse(rawInput);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? "Input tidak valid",
    };
  }

  const { name, slug } = result.data;

  // Check slug uniqueness — another org may already have this slug
  const [existing] = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.slug, slug))
    .limit(1);

  // Allow if it's the same org's current slug (no-op change)
  if (existing && existing.id !== orgId) {
    return {
      success: false,
      error: "Slug ini sudah digunakan oleh bisnis lain",
    };
  }

  // Final DB-level protection against race conditions
  try {
    await db.update(orgs).set({ name, slug }).where(eq(orgs.id, orgId));
  } catch (error) {
    // Neon/PostgreSQL unique constraint violation code is "23505"
    // Catches the race condition where two concurrent requests pick the same slug
    if (error instanceof Error && "code" in error && error.code === "23505") {
      return {
        success: false,
        error: "Slug ini sudah digunakan oleh bisnis lain",
      };
    }

    // Unknown DB error → rethrow
    throw error;
  }

  // Sync name change to Clerk org so org switcher stays in sync
  const client = await clerkClient();
  await client.organizations.updateOrganization(orgId, { name });

  // Revalidate all dashboard paths — name appears in sidebar and topbar
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");

  return { success: true, data: { slug } };
}

// ── Delete org (soft — starts 30-day grace period) ──
// No longer touches Clerk. Just stamps deletionRequestedAt — org keeps full
// access. The org-purge cron does the actual deletion after 30 days if this
// isn't reversed via cancelOrgDeletion().
export async function deleteOrg(): Promise<ActionResult> {
  // Mutation — admin only, same as every other Settings action (rule 129)
  const { orgId } = await requireOrgAdmin();

  const [org] = await db
    .select({ name: orgs.name, ownerEmail: orgs.ownerEmail })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!org) {
    return { success: false, error: "Organisasi tidak ditemukan" };
  }

  await db
    .update(orgs)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(orgs.id, orgId));

  // Email explains the 30-day window and how to cancel — replaces the old
  // farewell email, which no longer makes sense since nothing is deleted yet
  if (org.ownerEmail) {
    try {
      const purgeDate = new Date();
      purgeDate.setDate(purgeDate.getDate() + 30);

      await sendOrgDeletionEmail(
        org.ownerEmail,
        org.name,
        purgeDate,
        `${env.appUrl}/images/logo_kundesk.png`,
      );
    } catch {
      console.error("[deleteOrg] Failed to send deletion scheduled email");
    }
  }

  revalidatePath("/dashboard/settings");

  return { success: true, data: undefined };
}

// ── Cancel a pending org deletion ──
// Any point during the 30-day grace period. Admin only, same as deleteOrg.
export async function cancelOrgDeletion(): Promise<ActionResult> {
  const { orgId } = await requireOrgAdmin();

  // Only succeeds if a purge hasn't already claimed this org. If purgingAt
  // is set, the cron is already mid-deletion — too late to cancel.
  const result = await db
    .update(orgs)
    .set({ deletionRequestedAt: null })
    .where(and(eq(orgs.id, orgId), isNull(orgs.purgingAt)))
    .returning({ id: orgs.id });

  if (result.length === 0) {
    return {
      success: false,
      error: "Penghapusan sudah diproses dan tidak dapat dibatalkan lagi.",
    };
  }

  revalidatePath("/dashboard/settings");

  return { success: true, data: undefined };
}
