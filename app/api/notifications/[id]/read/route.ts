// PATCH /api/notifications/[id]/read — marks a single notification as read
// IDOR protected — orgId must match

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { orgId } = await requireOrg();

  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid notification ID", status: 400 },
      { status: 400 },
    );
  }

  const notificationId = Number(id);

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.orgId, orgId),
        ),
      );
  } catch (err) {
    // Non-critical — isRead is cosmetic, failing silently is acceptable
    console.error(
      `[PATCH /api/notifications/${notificationId}/read] DB error:`,
      err,
    );
  }

  return NextResponse.json<ApiResponse>({ ok: true, data: undefined });
}
