// Used by ConversationsPage to prepend new conversations live via Pusher
// IDOR protected — orgId from session, not from request

import { type NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth";
import { getConversationById } from "@/lib/db/queries/dashboard";
import type { ApiResponse } from "@/types/api";

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

  const conversation = await getConversationById(conversationId, orgId);

  if (!conversation) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Conversation not found", status: 404 },
      { status: 404 },
    );
  }

  return NextResponse.json<ApiResponse<typeof conversation>>({
    ok: true,
    data: conversation,
  });
}
