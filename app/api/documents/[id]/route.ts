// Deletes a document and all its chunks — scoped to the authenticated org
// IDOR protection: AND org_id = $orgId on every query

import { type NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, chunks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { ApiResponse } from "@/types/api";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { orgId } = await requireOrg();

  // Await params — Next.js 16 requires async params
  const { id } = await params;

  // Use strict numeric validation for route id
  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid document ID", status: 400 },
      { status: 400 },
    );
  }

  const documentId = Number(id);

  // Verify document belongs to this org — same error for missing or forbidden
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.orgId, orgId), // ← IDOR protection
      ),
    )
    .limit(1);

  if (!document) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Document not found", status: 404 },
      { status: 404 },
    );
  }

  // Perform two dependent deletes separately. If the second operation fails, data is left partially deleted.
  await db.transaction(async (tx) => {
    // Delete chunks first — FK constraint requires this order
    await tx
      .delete(chunks)
      .where(and(eq(chunks.documentId, documentId), eq(chunks.orgId, orgId)));

    // Delete the document record
    await tx
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));
  });

  // 204 No Content — correct HTTP response for successful DELETE with no body
  return new NextResponse(null, { status: 204 });
}
