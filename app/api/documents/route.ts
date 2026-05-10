// Returns the list of documents for the authenticated org
// Called by TanStack Query on the documents page — useQuery("documents")

import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/api";
import type { DocumentSelect } from "@/types/db";

export async function GET(): Promise<NextResponse> {
  // Guard — scopes query to authenticated org
  const { orgId } = await requireOrg();

  // Fetch all documents for this org — newest first
  const orgDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt));

  return NextResponse.json<ApiResponse<DocumentSelect[]>>({
    ok: true,
    data: orgDocuments,
  });
}
