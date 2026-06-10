// Dismisses a pending_handoff request — staff declines to take over
// Returns conversation to AI mode and sends a canned apology message to customer
// Fires conversation:return on both dashboard and customer widget channels

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations, messages } from "@/lib/db/schema";
import {
  triggerConversationReturn,
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
  const { orgId } = await requireOrg();

  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

  const conversationId = Number(id);

  // Fetch conversation with IDOR protection
  const [conversation] = await db
    .select({
      id: conversations.id,
      handoffStatus: conversations.handoffStatus,
      sessionId: conversations.sessionId,
      channelToken: conversations.channelToken,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.orgId, orgId), // ← tenant isolation
      ),
    )
    .limit(1);

  if (!conversation) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Conversation not found", status: 404 },
      { status: 404 },
    );
  }

  // Only valid to dismiss when actually pending — not ai or human
  if (conversation.handoffStatus !== "pending_handoff") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Conversation is not pending handoff", status: 409 },
      { status: 409 },
    );
  }

  // Canned message — inserted as assistant so KUN identity is preserved
  // Customer sees this as a KUN bubble, not a staff message
  const cannedMessage =
    "Mohon maaf, admin tidak bisa membalas pesanmu sekarang. " +
    "Tetap bicara sama KUN ya, aku siap membantu! 😊";

  // Atomic: return to AI + insert canned message in one transaction
  const dismissed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(conversations)
      .set({
        handoffStatus: "ai",
        takenOverAt: null,
        takenOverBy: null,
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, orgId),
          eq(conversations.handoffStatus, "pending_handoff"),
        ),
      )
      .returning({ id: conversations.id });

    if (!updated) return false;

    await tx.insert(messages).values({
      orgId,
      conversationId,
      role: "assistant",
      content: cannedMessage,
    });

    return true;
  });

  if (!dismissed) {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Conversation is no longer pending handoff",
        status: 409,
      },
      { status: 409 },
    );
  }

  // Send canned message to customer widget via Pusher
  // role: "assistant" so ChatPage renders it with KUN avatar
  triggerConversationMessage(orgId, conversation.channelToken, {
    conversationId,
    role: "assistant",
    content: cannedMessage,
    handoffStatus: "ai",
  }).catch(console.error);

  // Fire conversation:return on both channels — PendingHandoffState disappears,
  // ChatInput unlocks, customer can talk to KUN again
  await triggerConversationReturn(
    orgId,
    { conversationId },
    conversation.channelToken,
  ).catch(console.error);

  // Notify dashboard — staff dismissed the request
  await createNotification(
    orgId,
    "conversation_return",
    "Permintaan staff diabaikan",
    `${conversation.sessionId.slice(0, 8)}|KUN kembali menangani percakapan`,
    conversationId,
  ).catch(console.error);

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
