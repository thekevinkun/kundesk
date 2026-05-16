// Returns all messages for a conversation — used by the inline conversation dialog
// Scoped to authenticated org — IDOR protected via orgId

import { type NextRequest, NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { conversations, messages } from "@/lib/db/schema";
import type { ApiResponse, ConversationMessage } from "@/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
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

  // IDOR protection — verify conversation belongs to this org
  const [conversation] = await db
    .select({
      id: conversations.id,
      handoffStatus: conversations.handoffStatus,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)),
    )
    .limit(1);

  if (!conversation) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Conversation not found", status: 404 },
      { status: 404 },
    );
  }

  // Fetch all messages — oldest first for chronological display
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.orgId, orgId),
      ),
    )
    .orderBy(asc(messages.createdAt));

  const data: ConversationMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role as ConversationMessage["role"],
    content: row.content,
    // Drizzle .select() returns createdAt as a proper Date object — just call toISOString()
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(String(row.createdAt).replace(" ", "T") + "Z").toISOString(),
  }));

  return NextResponse.json<ApiResponse<ConversationMessage[]>>({
    ok: true,
    data,
  });
}
