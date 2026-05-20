// Server Actions for org-level settings
// Separate from chatbot actions — settings touch the orgs table, not chatbots
// All actions: requireOrg() first → Zod validate → DB → revalidate

"use server";

import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { orgs } from "@/lib/db/schema";
import { requireOrg } from "@/lib/auth";
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
} | null> {
  const { orgId } = await requireOrg();

  const [org] = await db
    .select({
      name: orgs.name,
      slug: orgs.slug,
      ownerEmail: orgs.ownerEmail,
      plan: orgs.plan,
      subscriptionStatus: orgs.subscriptionStatus,
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
  const { orgId } = await requireOrg();

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

  await db.update(orgs).set({ name, slug }).where(eq(orgs.id, orgId));

  // Sync name change to Clerk org so org switcher stays in sync
  const client = await clerkClient();
  await client.organizations.updateOrganization(orgId, { name });

  // Revalidate all dashboard paths — name appears in sidebar and topbar
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");

  return { success: true, data: { slug } };
}

// ── Delete org ──
// Deletes Clerk organization → triggers Clerk webhook → our webhook handler
// deletes the orgs row → cascade deletes all tenant data (chatbots, docs, chunks, etc.)
// Client signs out after this returns success
export async function deleteOrg(): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  // Fetch org details before deletion — needed for the farewell email
  const [org] = await db
    .select({
      name: orgs.name,
      ownerEmail: orgs.ownerEmail,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!org) {
    return { success: false, error: "Organisasi tidak ditemukan" };
  }

  // Delete from Clerk first — this fires the org.deleted webhook
  // Our webhook handler will delete the orgs row and all cascaded data
  const client = await clerkClient();
  await client.organizations.deleteOrganization(orgId);

  // Send farewell email — best-effort, don't fail the action if email fails
  if (org.ownerEmail) {
    try {
      await sendOrgDeletionEmail(
        org.ownerEmail,
        org.name,
        `${env.appUrl}/images/logo_kundesk.png`,
      );
    } catch {
      // Email failure is non-fatal — org is already deleted
      console.error("[deleteOrg] Failed to send deletion email");
    }
  }

  return { success: true, data: undefined };
}
