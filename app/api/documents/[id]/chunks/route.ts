// Returns the text KUN learned from a document, 20 chunks per page
// Open to every org member (view only)
// IDOR protection: AND org_id = $orgId on both queries

import { type NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { chunks, documents } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/api";

const PAGE_SIZE = 20;

type ChunksPage = {
  chunks: { id: number; content: string }[];
  page: number;
  hasMore: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { orgId } = await requireOrg();
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid document ID", status: 400 },
      { status: 400 },
    );
  }

  // Page defaults to 1; only plain digits, 1 or higher
  const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
  if (!/^\d{1,4}$/.test(rawPage) || Number(rawPage) < 1) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid page", status: 400 },
      { status: 400 },
    );
  }
  const page = Number(rawPage);
  const documentId = Number(id);

  // Confirm the document belongs to this org first
  const [document] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)))
    .limit(1);

  if (!document) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Document not found", status: 404 },
      { status: 404 },
    );
  }

  // Ask for one extra row — if it exists, there is a next page
  const rows = await db
    .select({ id: chunks.id, content: chunks.content })
    .from(chunks)
    .where(and(eq(chunks.documentId, documentId), eq(chunks.orgId, orgId)))
    .orderBy(asc(chunks.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return NextResponse.json<ApiResponse<ChunksPage>>({
    ok: true,
    data: {
      chunks: rows.slice(0, PAGE_SIZE),
      page,
      hasMore: rows.length > PAGE_SIZE,
    },
  });
}
