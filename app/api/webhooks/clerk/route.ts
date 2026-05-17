import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email";
import { orgs, chatbots, processedWebhooks } from "@/lib/db/schema";

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
  created_by: string | null;
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

  // ── 3. Handle event + claim atomically in one transaction ──
  // Both the processedWebhooks insert and org mutation must succeed together
  // If org upsert fails → processedWebhooks rolls back → Clerk can retry safely
  try {
    await db.transaction(async (tx) => {
      // Claim the event inside the transaction — rolls back if org sync fails
      const inserted = await tx
        .insert(processedWebhooks)
        .values({
          externalId: svixId,
          source: "clerk",
        })
        .onConflictDoNothing()
        .returning({ id: processedWebhooks.id });

      if (inserted.length === 0) {
        // Already successfully processed — return early
        // Throwing a known string exits the transaction cleanly
        throw "already_processed";
      }

      // Handle org sync based on event type
      if (type === "organization.created" || type === "organization.updated") {
        // Upsert org — insert if new, update name/slug if already exists
        await tx
          .insert(orgs)
          .values({
            id: data.id,
            name: data.name,
            // Append last 8 chars of orgId — guarantees uniqueness even if name is same
            slug: `${data.slug ?? data.id}-${data.id.slice(-8)}`,
            plan: "free",
            subscriptionStatus: "free",
            messagesUsed: 0,
            messagesLimit: 100,
            createdBy: data.created_by,
          })
          .onConflictDoUpdate({
            target: orgs.id,
            set: {
              name: data.name,
              slug: `${data.slug ?? data.id}-${data.id.slice(-8)}`,
            },
          });

        // On new org creation — seed a default chatbot row automatically.
        // onConflictDoNothing — if org.updated fires again, existing chatbot is untouched.
        // Business owner customizes name/tone/color from dashboard in Phase 5.
        if (type === "organization.created") {
          await tx
            .insert(chatbots)
            .values({
              orgId: data.id,
              name: `${data.name}'s Assistant`,
              systemPrompt: null,
              language: "id",
              tone: "friendly",
              greetingMessage: `Halo! Saya adalah ${data.name}'s Assistant, asisten virtual bisnis ini. Saya siap menjawab pertanyaan seputar ${data.name} berdasarkan informasi yang telah disiapkan. Ada yang bisa saya bantu?`,
              accentColor: "#069494",
              isActive: true,
            })
            .onConflictDoNothing();
        }
      }

      if (type === "organization.deleted") {
        // Soft cancel — never hard delete, preserves all tenant data
        await tx
          .update(orgs)
          .set({ subscriptionStatus: "cancelled" })
          .where(eq(orgs.id, data.id));
      }
    });

    // NOTE: ownerEmail sync is best-effort after transaction commits.
    // If Clerk API call fails, createdBy column is already persisted as fallback.
    // Backfill any affected orgs with:
    // UPDATE orgs SET owner_email = ... WHERE owner_email IS NULL AND created_by IS NOT NULL
    // A proper retry queue is planned for Phase 9 infrastructure.
    if (type === "organization.created" && data.created_by) {
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(data.created_by);
        const email =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
            ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

        if (email) {
          // Update ownerEmail — if this fails, createdBy column allows manual backfill
          // via: SELECT id, created_by FROM orgs WHERE owner_email IS NULL
          await db
            .update(orgs)
            .set({ ownerEmail: email })
            .where(eq(orgs.id, data.id));

          sendWelcomeEmail(email, data.name, env.logoUrl).catch((err) =>
            console.error("[clerk-webhook] Failed to send welcome email:", err),
          );
        }
      } catch (err) {
        // Non-fatal — org created successfully, createdBy stored for backfill
        // Query to find affected orgs: SELECT id FROM orgs WHERE owner_email IS NULL AND created_by IS NOT NULL
        console.error(
          "[clerk-webhook] Failed to sync ownerEmail — backfill via createdBy column:",
          err,
        );
      }
    }

    // Transaction committed — both claim and org sync succeeded
    return new Response("OK", { status: 200 });
  } catch (err) {
    // Known early-exit: event already processed successfully before
    if (err === "already_processed") {
      return new Response("Already processed", { status: 200 });
    }

    // Unexpected error — transaction rolled back, Clerk will retry
    console.error("[clerk-webhook] Processing error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
