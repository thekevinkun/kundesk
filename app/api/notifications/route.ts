// GET /api/notifications — returns last 20 notifications for the authenticated org
// Newest first — notification panel shows most recent at top

import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/api";
import { toDateSafe } from "@/helpers/format";
import type { NotificationItem } from "@/hooks/use-pusher-channel";

export async function GET(): Promise<NextResponse> {
  const { orgId } = await requireOrg();

  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.orgId, orgId))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    const data: NotificationItem[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      conversationId: row.conversationId ?? null,
      isRead: row.isRead,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : toDateSafe(row.createdAt).toISOString(),
    }));

    return NextResponse.json<ApiResponse<NotificationItem[]>>({
      ok: true,
      data,
    });
  } catch (err) {
    // Neon serverless occasionally times out on cold start — return empty list
    // Client will retry on next panel open — no user-visible error needed
    console.error(
      "[GET /api/notifications] DB timeout or connection error:",
      err,
    );
    return NextResponse.json<ApiResponse<NotificationItem[]>>({
      ok: true,
      data: [],
    });
  }
}
