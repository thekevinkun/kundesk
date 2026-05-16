// Sets conversation handoffStatus to "human" — staff takes over from AI
// Fires conversation:takeover Pusher event
// Only valid when current status is "ai" or "pending_handoff"

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations } from "@/lib/db/schema";
import { triggerConversationTakeover } from "@/lib/pusher";
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
  const conversationId = parseInt(id, 10);

  if (isNaN(conversationId)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

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

  // Transition to human — record who took over and when
  await db
    .update(conversations)
    .set({
      handoffStatus: "human",
      takenOverAt: new Date(),
      takenOverBy: userId,
    })
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)),
    );

  // Notify dashboard live — badge turns orange
  await triggerConversationTakeover(orgId, {
    conversationId,
    takenOverBy: userId,
  }).catch(console.error);

  // Insert notification — staff took over a conversation
  createNotification(
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
