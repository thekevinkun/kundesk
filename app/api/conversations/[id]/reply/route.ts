// Inserts a human_agent message into a conversation in handoff mode
// Atomic transaction with row lock prevents TOCTOU race with /return route
// Fires conversation:message Pusher event so the chat widget updates live

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations, messages } from "@/lib/db/schema";
import { triggerConversationMessage } from "@/lib/pusher";
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
  const conversationId = parseInt(id, 10);

  if (isNaN(conversationId)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid conversation ID", status: 400 },
      { status: 400 },
    );
  }

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

  // Atomic check + insert — prevents TOCTOU where /return flips status between check and insert
  // Row lock ensures handoffStatus cannot change between our read and write
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
      .for("update"); // ← row-level lock — blocks concurrent /return until we commit

    if (!convo) return { error: "not_found", channelToken: null } as const;
    if (convo.handoffStatus !== "human")
      return { error: "not_human", channelToken: null } as const;

    await tx.insert(messages).values({
      orgId,
      conversationId,
      role: "human_agent",
      content,
    });

    return { error: null, channelToken: convo.channelToken } as const;
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

  // Notify dashboard (private channel) + customer widget (public UUID channel)
  // channelToken is the unguessable UUID — not the integer conversationId
  await triggerConversationMessage(orgId, result.channelToken, {
    conversationId,
    role: "human_agent",
    content,
  }).catch(console.error);

  return NextResponse.json<ApiResponse<{ conversationId: number }>>({
    ok: true,
    data: { conversationId },
  });
}
