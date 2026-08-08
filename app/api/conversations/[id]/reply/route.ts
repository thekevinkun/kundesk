// Inserts a human_agent message into a conversation in handoff mode
// Atomic transaction with row lock prevents TOCTOU race with /return route
// Fires conversation:message Pusher event so the chat widget updates live

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations, messages } from "@/lib/db/schema";
import { triggerConversationMessage, triggerOrgEvent } from "@/lib/pusher";
import type { ApiResponse } from "@/types/api";

const replySchema = z.object({
  content: z.string().min(1).max(500),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { orgId } = await requireOrg();

  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

  const conversationId = Number(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body", status: 400 },
      { status: 400 },
    );
  }

  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Content is required (max 500 chars)", status: 400 },
      { status: 400 },
    );
  }

  const { content } = parsed.data;

  // ⚠️ TOCTOU prevention (Time-Of-Check-Time-Of-Use):
  // Without row lock, a race condition is possible:
  //   1. This route (reply): SELECT handoffStatus = "pending_handoff"
  //   2. Concurrent request (return): UPDATE handoffStatus = "ai"
  //   3. This route: INSERT message, assuming handoffStatus still "pending_handoff"
  //   4. Result: message inserted into a conversation that's no longer in handoff mode
  //
  // Solution: FOR UPDATE lock within the transaction.
  // The lock is acquired BEFORE we read handoffStatus. The concurrent /return request
  // must wait for our transaction to commit before it can modify the row.
  // This guarantees that what we read is what we act on.
  //
  // Trade-off: if /return is waiting for the lock, it blocks momentarily. Acceptable
  // because staff messages are typically brief (< 1s), so the wait is short.
  const result = await db.transaction(async (tx) => {
    const [convo] = await tx
      .select({
        handoffStatus: conversations.handoffStatus,
        channelToken: conversations.channelToken,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, orgId),
        ),
      )
      .limit(1)
      .for("update"); // ← row-level lock — serializes concurrent /return or /dismiss

    if (!convo) return { error: "not_found", channelToken: null } as const;

    // ⚠️ Allow reply in BOTH "human" and "pending_handoff" states.
    // Why pending_handoff? A customer asks for help, staff immediately sees the request
    // and replies — they don't need to click a "Take Over" button first. The reply itself
    // IS the implicit takeover. This UX is better — staff action is one-step.
    //
    // Possible states:
    //   - "ai" (default): KUN handling, no staff reply allowed
    //   - "pending_handoff": customer asked for staff, first staff reply transitions to "human"
    //   - "human": staff already took over, continue replying
    //
    // All other states ("pending_handoff" is only new state allowed besides "human") are rejected.
    if (
      convo.handoffStatus !== "human" &&
      convo.handoffStatus !== "pending_handoff"
    )
      return { error: "not_human", channelToken: null } as const;

    // ⚠️ Implicit takeover: pending_handoff → human on first reply.
    // Staff clicking "reply" on a pending_handoff request is the act of takeover.
    // No need for a separate "Take Over" button click.
    //
    // State transition:
    //   pending_handoff (customer waiting) → human (staff replying)
    //
    // Side effect: takenOverAt timestamp is set — used in analytics to measure
    // "time to first staff response" and also used to display "Staff replied X minutes ago".
    //
    // Why check the previous state? If the conversation is already "human" (staff
    // already took over via explicit takeover button), we don't update takenOverAt again.
    // Only the FIRST staff action (implicit or explicit takeover) gets timestamped.
    if (convo.handoffStatus === "pending_handoff") {
      await tx
        .update(conversations)
        .set({
          handoffStatus: "human",
          takenOverAt: new Date(), // ← only set on first staff action
        })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.orgId, orgId),
          ),
        );
    }

    await tx.insert(messages).values({
      orgId,
      conversationId,
      role: "human_agent",
      content,
    });

    return {
      error: null,
      channelToken: convo.channelToken,
      wasTransitioned: convo.handoffStatus === "pending_handoff",
    } as const;
  });

  if (result.error === "not_found") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Conversation not found", status: 404 },
      { status: 404 },
    );
  }

  if (result.error === "not_human") {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Conversation is not in human handoff mode",
        status: 409,
      },
      { status: 409 },
    );
  }

  // ⚠️ Two Pusher channels for one conversation:
  // 1. Private org channel (org-{orgId}): staff dashboard sees all conversations
  // 2. Public customer channel (conversation-{channelToken}): customer sees ONLY their conversation
  //
  // Why channelToken (UUID) instead of conversationId (integer)?
  // If we used conversationId, an attacker could guess channel names:
  //   - Private channel is scoped by org_id, so no enumeration risk
  //   - Public channel MUST be unguessable — customer should only see their own
  // If public channels were "conversation-123", an attacker could subscribe to
  // "conversation-1", "conversation-2", etc. and eavesdrop on all conversations.
  //
  // channelToken is a crypto.randomUUID() generated at conversation creation.
  // It's unguessable, only shared with the specific customer (in the chat page URL),
  // and known ONLY to the customer whose conversation it is.
  //
  // Pusher enforces auth on private- channels (dashboard), but public- channels
  // allow anyone who knows the name to subscribe. So we MUST make the public
  // channel name cryptographically secure.
  // Notify dashboard (private channel) + customer widget (public UUID channel)

  // ⚠️ Pusher event: fire BEFORE DB write? NO — DB is already committed (tx done).
  // This is a small write (single message insert, single update), and staff is waiting
  // for the reply to show in ConversationDialog. Cold start risk exists.
  // But actually, we DO fire after the transaction here because the transaction is
  // already complete. The Pusher ordering rule is: for SMALL writes + user waiting,
  // fire before. But we can't fire before a transaction without committing first.
  // So: always fire after transaction (you can't Pusher before an uncommitted state).
  //
  // CRITICAL FIX (Phase 14): include `handoffStatus: "human"` in the payload.
  // This tells the customer's ChatPage to update the footer hint ("Staff is helping").
  // Without this, the UI doesn't know the status changed — customer still sees
  // "Menunggu staff kami" even after staff replied. Fixed in Phase 14.
  //
  // DB role vs Pusher role consistency: stored as "human_agent" in DB,
  // sent as "human_agent" to Pusher. Both must match (see Phase 14 Handoff, Section C3).
  await triggerConversationMessage(orgId, result.channelToken, {
    conversationId,
    role: "human_agent",
    content,
    handoffStatus: "human", // ← Phase 14 fix: tell customer's UI that status changed
  }).catch(console.error);

  // ⚠️ Second Pusher event: only fires if we transitioned pending_handoff → human.
  // This is the "takeover" event — it updates the dashboard row status badge
  // from "Pending" to "Human". Without it, the row stays "Pending" until refresh.
  //
  // Why separate event? conversation:message updates the chat content for both
  // dashboard and customer. conversation:takeover updates the status badge and
  // increments staff stats. By firing both:
  //   - Customer sees the new message in their chat + footer hint updates
  //   - Staff sees the row change from "Pending" to "Human" + star goes away
  //   - Analytics count a handoff when handoffStatus becomes "human"
  //
  // If we're already in "human" state (staff replying a second time), we don't
  // fire takeover — the status is already "Human".
  if (result.wasTransitioned) {
    triggerOrgEvent(orgId, "conversation:takeover", {
      conversationId,
      handoffStatus: "human",
    }).catch(console.error);
  }

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
