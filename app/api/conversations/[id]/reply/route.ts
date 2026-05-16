// Inserts a human_agent message into a conversation in handoff mode
// Fires conversation:message Pusher event so the chat widget updates live
// Only valid when handoffStatus is "human"

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations, messages } from "@/lib/db/schema";
import { triggerConversationMessage } from "@/lib/pusher";
import type { ApiResponse } from "@/types/api";

const replySchema = z.object({
  // Staff reply content — same 500 char cap as customer messages
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
  const conversationId = parseInt(id, 10);

  if (isNaN(conversationId)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

  // Validate request body
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

  // Fetch conversation with IDOR protection
  const [conversation] = await db
    .select({
      id: conversations.id,
      handoffStatus: conversations.handoffStatus,
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

  // Only allow replies when the conversation is in human handoff mode
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

  // Insert the human_agent message — third role alongside user and assistant
  await db.insert(messages).values({
    orgId,
    conversationId,
    role: "human_agent",
    content,
  });

  // Notify chat widget — customer sees the reply appear live
  await triggerConversationMessage(orgId, {
    conversationId,
    role: "human_agent",
    content,
  }).catch(console.error);

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
