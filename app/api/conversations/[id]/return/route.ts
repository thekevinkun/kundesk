// Returns conversation control back to AI — clears takenOverBy and takenOverAt
// Fires conversation:return Pusher event so dashboard badge goes back to green
// Only valid when handoffStatus is "human"

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations, messages } from "@/lib/db/schema";
import { createNotification } from "@/lib/db/queries/dashboard";
import {
  triggerConversationReturn,
  triggerConversationMessage,
} from "@/lib/pusher";
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
      channelToken: conversations.channelToken, // ← needed to notify customer widget
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

  // Can only return to AI if currently in human mode
  if (conversation.handoffStatus !== "human") {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Conversation is not in human handoff mode",
        status: 409,
      },
      { status: 409 },
    );
  }

  // Canned message — tells customer KUN is back
  // Inserted as assistant so it renders as KUN bubble
  const cannedMessage =
    "Halo, Kak! KUN kembali menangani percakapan ini ya. Silahkan lanjutkan pesan kakak! 😊";

  // Atomic: transition back to AI + insert canned message in one transaction
  const updated = await db.transaction(async (tx) => {
    const [result] = await tx
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
          eq(conversations.handoffStatus, "human"),
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

    return true;
  });

  if (!updated) {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Conversation is not in human handoff mode",
        status: 409,
      },
      { status: 409 },
    );
  }

  // Send canned message to customer widget — appears as KUN bubble in chat
  // role: "human_agent" so ChatPage's existing handler picks it up
  // handoffStatus: "ai" so ChatPage does NOT set status to human
  await triggerConversationMessage(orgId, conversation.channelToken, {
    conversationId,
    role: "human_agent",
    content: cannedMessage,
    handoffStatus: "ai",
  }).catch(console.error);

  // Notify dashboard + customer widget — conversation badge goes back to green
  await triggerConversationReturn(
    orgId,
    { conversationId },
    conversation.channelToken,
  ).catch(console.error);

  // Notify owner — AI has resumed handling
  await createNotification(
    orgId,
    "conversation_return",
    "KUN kembali menangani percakapan",
    `${conversation.sessionId.slice(0, 8)}|KUN melanjutkan percakapan`,
    conversationId,
  ).catch(console.error);

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
