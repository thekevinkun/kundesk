import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ilike, eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkOrgMessageLimit } from "@/lib/redis";
import { messages, conversations, documents } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) return Response.json({ ok: false }, { status: 401 });

  const searchLimit = await checkOrgMessageLimit(orgId);
  if (!searchLimit.success) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const raw = request.nextUrl.searchParams.get("q")?.trim();
  if (!raw || raw.length < 2 || raw.length > 200) {
    return Response.json({
      ok: true,
      data: { conversations: [], documents: [] },
    });
  }

  // Strip leading # — staff copy session IDs as "#e55be1" from the notification panel
  const q = raw.startsWith("#") ? raw.slice(1) : raw;

  // Minimum 2 chars — prevents accidental full-table scans
  if (!q || q.length < 2) {
    return Response.json({
      ok: true,
      data: { conversations: [], documents: [] },
    });
  }

  // Run both searches in parallel — no dependency between them
  const [messageRows, documentRows] = await Promise.all([
    // Search messages content — return the conversation it belongs to
    // DISTINCT ON conversation_id — one result per conversation, most recent match
    db.execute<{
      conversation_id: number;
      session_id: string;
      content: string;
      handoff_status: string;
      created_at: Date;
    }>(sql`
        SELECT DISTINCT ON (m.conversation_id)
            m.conversation_id,
            c.session_id,
            m.content,
            c.handoff_status,
            m.created_at
        FROM ${messages} m
        JOIN ${conversations} c ON c.id = m.conversation_id
        WHERE
            m.org_id = ${orgId}
            AND (
            m.content ILIKE ${"%" + q + "%"}
            OR c.session_id ILIKE ${"%" + q + "%"}
            )
        ORDER BY m.conversation_id, m.created_at DESC
        LIMIT 5
    `),

    // Search document names
    db
      .select({
        id: documents.id,
        name: documents.name,
        status: documents.status,
        chunkCount: documents.chunkCount,
      })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), ilike(documents.name, `%${q}%`)))
      .orderBy(desc(documents.createdAt))
      .limit(5),
  ]);

  return Response.json({
    ok: true,
    data: {
      conversations: messageRows.rows.map((r) => ({
        conversationId: r.conversation_id,
        sessionId: r.session_id,
        // Highlight the matched portion — truncate around match for context
        preview:
          r.content.length > 80 ? r.content.slice(0, 80) + "..." : r.content,
        handoffStatus: r.handoff_status,
        createdAt: r.created_at,
      })),
      documents: documentRows,
    },
  });
}
