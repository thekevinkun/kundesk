// Returns conversation control back to AI — clears takenOverBy and takenOverAt
// Fires conversation:return Pusher event so dashboard badge goes back to green
// Only valid when handoffStatus is "human"

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations } from "@/lib/db/schema";
import { triggerConversationReturn } from "@/lib/pusher";
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
  const conversationId = parseInt(id, 10);

  if (isNaN(conversationId)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

  // Fetch conversation with IDOR protection
  const [conversation] = await db
    .select({
      id: conversations.id,
      handoffStatus: conversations.handoffStatus,
      sessionId: conversations.sessionId,
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

  // Transition back to AI — clear handoff fields
  await db
    .update(conversations)
    .set({
      handoffStatus: "ai",
      takenOverAt: null,
      takenOverBy: null,
    })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.orgId, orgId), // ← IDOR on update
      ),
    );

  // Notify dashboard — conversation badge goes back to green
  await triggerConversationReturn(orgId, { conversationId }).catch(
    console.error,
  );

  // Notify owner — AI has resumed handling
  createNotification(
    orgId,
    "conversation_return",
    "AI kembali menangani percakapan",
    `${conversation.sessionId.slice(0, 8)}|AI melanjutkan percakapan`,
    conversationId,
  ).catch(console.error);

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
