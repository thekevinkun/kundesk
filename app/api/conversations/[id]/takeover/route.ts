// Sets conversation handoffStatus to "human" — staff takes over from AI
// Fires conversation:takeover Pusher event
// Only valid when current status is "ai" or "pending_handoff"

import { type NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { conversations, messages } from "@/lib/db/schema";
import {
  triggerConversationTakeover,
  triggerPublicConversationEvent,
  triggerConversationMessage,
} from "@/lib/pusher";
import { createNotification } from "@/lib/db/queries/dashboard";
import type { ApiResponse } from "@/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  // Guard — requireOrg() gives us userId for takenOverBy
  const { orgId, userId } = await requireOrg();

  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

  const conversationId = Number(id);

  // Fetch conversation with IDOR protection — orgId must match
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.orgId, orgId), // ← tenant isolation
      ),
    )
    .limit(1);

  // Same error whether missing or belongs to another org — no enumeration
  if (!conversation) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Conversation not found", status: 404 },
      { status: 404 },
    );
  }

  // Guard against invalid state transitions
  if (conversation.handoffStatus === "human") {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Conversation already in human handoff",
        status: 409,
      },
      { status: 409 },
    );
  }

  // Canned message — tells customer staff is now handling
  // Inserted as assistant so it renders as KUN-style bubble, not staff bubble
  const cannedMessage =
    "Halo, staff kami mengambil alih percakapan ini! 😊 Silakan lanjutkan pesanmu.";

  // Second bubble — natural greeting from staff, always sent after cannedMessage
  const cannedGreeting = "Ada yang bisa dibantu kak?";

  // Atomic: transition to human + insert canned message in one transaction
  const updated = await db.transaction(async (tx) => {
    const [result] = await tx
      .update(conversations)
      .set({
        handoffStatus: "human",
        takenOverAt: new Date(),
        takenOverBy: userId,
        wasHandedOff: true,
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, orgId),
          inArray(conversations.handoffStatus, ["ai", "pending_handoff"]),
        ),
      )
      .returning({ id: conversations.id });

    if (!result) return false;

    // Insert canned message as assistant — KUN identity preserved in DB
    await tx.insert(messages).values({
      orgId,
      conversationId,
      role: "assistant",
      content: cannedMessage,
    });

    // Insert second message — natural staff greeting, always after the first
    await tx.insert(messages).values({
      orgId,
      conversationId,
      role: "assistant",
      content: cannedGreeting,
    });

    return true;
  });

  if (!updated) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid handoff transition", status: 409 },
      { status: 409 },
    );
  }

  // Notify dashboard live — badge turns orange
  await triggerConversationTakeover(orgId, {
    conversationId,
    takenOverBy: userId,
  }).catch(console.error);

  // Notify customer widget — footer hint changes to "Kamu sedang terhubung dengan staff kami"
  await triggerPublicConversationEvent(
    conversation.channelToken,
    "conversation:takeover",
    { conversationId, handoffStatus: "human" },
  ).catch(console.error);

  // Fire first bubble — staff arrival announcement
  // Send canned message to customer widget — appears as bubble in chat
  // role: "human_agent" so ChatPage's handler picks it up and renders it
  await triggerConversationMessage(orgId, conversation.channelToken, {
    conversationId,
    role: "human_agent",
    content: cannedMessage,
    handoffStatus: "human",
  }).catch(console.error);

  // Fire second bubble after short delay — ensures order on customer's screen
  // Without delay, both events may arrive simultaneously and render out of order
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Send canned greeting as second message — appears as second bubble in chat
  await triggerConversationMessage(orgId, conversation.channelToken, {
    conversationId,
    role: "human_agent",
    content: cannedGreeting,
    handoffStatus: "human",
  }).catch(console.error);

  // Track when a staff member takes over a conversation
  trackEvent(orgId, "human_handoff_taken");

  // Insert notification — staff took over a conversation
  await createNotification(
    orgId,
    "conversation_takeover",
    "Percakapan diambil alih",
    `${conversation.sessionId.slice(0, 8)}|Percakapan sedang ditangani staff`,
    conversationId,
  ).catch(console.error);

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
