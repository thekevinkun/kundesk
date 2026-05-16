// PATCH /api/notifications/read-all — marks all notifications as read for the org
// Called when owner opens the notification panel

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/api";

export async function PATCH(): Promise<NextResponse> {
  const { orgId } = await requireOrg();

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.orgId, orgId));

  return NextResponse.json<ApiResponse>({ ok: true, data: undefined });
}
