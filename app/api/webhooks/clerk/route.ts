import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { orgs, processedWebhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/lib/env";

// Clerk webhook event types we care about — typed, not free text
type ClerkOrgEvent =
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "organizationMembership.created";

// Shape of the org data Clerk sends inside the event payload
interface ClerkOrgData {
  id: string;
  name: string;
  slug: string | null;
  created_at: number;
  updated_at: number;
}

// Full webhook payload shape from Clerk
interface ClerkWebhookPayload {
  type: ClerkOrgEvent;
  data: ClerkOrgData;
}

export async function POST(req: Request) {
  // ── 1. Read raw body and Svix headers ──
  // Svix needs the raw body string — not parsed JSON — to verify signature
  const body = await req.text();
  const headersList = await headers();

  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  // Reject immediately if any Svix header is missing
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  // ── 2. Verify signature ──
  // Same concept as Midtrans — if the signature doesn't match, reject
  let payload: ClerkWebhookPayload;

  try {
    const wh = new Webhook(env.clerkWebhookSecret);
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookPayload;
  } catch {
    // Signature mismatch — not from Clerk, reject
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = payload;

  // ── 3. Idempotency check ──
  // Clerk retries webhooks on failure — never process the same event twice
  // svixId is the unique event ID Clerk sends with every delivery attempt
  const alreadyProcessed = await db
    .select()
    .from(processedWebhooks)
    .where(
      and(
        eq(processedWebhooks.source, "clerk"),
        eq(processedWebhooks.externalId, svixId),
      ),
    )
    .limit(1);

  if (alreadyProcessed.length > 0) {
    // Already handled — return 200 so Clerk stops retrying
    return new Response("Already processed", { status: 200 });
  }

  // ── 4. Handle each event type ──
  try {
    if (type === "organization.created" || type === "organization.updated") {
      // Upsert — insert if new, update if already exists
      // This handles both creation and any name/slug changes
      await db
        .insert(orgs)
        .values({
          id: data.id,
          name: data.name,
          // Clerk slug can be null if user didn't set one — fall back to org ID
          slug: data.slug ?? data.id,
          plan: "free",
          subscriptionStatus: "free",
          messagesUsed: 0,
          messagesLimit: 100,
        })
        .onConflictDoUpdate({
          target: orgs.id,
          set: {
            name: data.name,
            // Keep slug in sync if owner changes it in Clerk
            slug: data.slug ?? data.id,
          },
        });
    }

    if (type === "organization.deleted") {
      // Soft approach — we don't delete data, just mark subscription as cancelled
      // Hard delete would orphan all their documents and conversations
      await db
        .update(orgs)
        .set({ subscriptionStatus: "cancelled" })
        .where(eq(orgs.id, data.id));
    }

    // organizationMembership.created — no DB action needed yet
    // Clerk handles member access. We'll use this in Phase 7 for welcome emails.

    // ── 5. Mark as processed ──
    await db.insert(processedWebhooks).values({
      externalId: svixId,
      source: "clerk",
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    // Log the error but don't expose internals — Clerk will retry
    console.error("[clerk-webhook] Processing error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
