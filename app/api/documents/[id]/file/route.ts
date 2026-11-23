// Returns a short-lived link to the ORIGINAL file of a document, for preview or download
// Open to every org member (view only, like the rest of Documents)
// IDOR protection: AND org_id = $orgId

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { documents } from "@/lib/db/schema";
import { generatePresignedDownloadUrl, getS3ObjectSize } from "@/lib/aws/s3";
import { isMissingObjectError } from "@/helpers/storage-errors";
import type { ApiResponse } from "@/types/api";

// available=false means the file is gone (old AWS uploads) — not an error
type FileLinkData = { available: false } | { available: true; url: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { orgId } = await requireOrg();
  const { id } = await params;

  // Strict numeric validation, same as the delete route
  if (!/^\d+$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid document ID", status: 400 },
      { status: 400 },
    );
  }

  // "download" forces a save dialog; anything else opens inline
  const disposition =
    request.nextUrl.searchParams.get("mode") === "download"
      ? "attachment"
      : "inline";

  // Same error for missing or forbidden
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, Number(id)), eq(documents.orgId, orgId)))
    .limit(1);

  if (!document) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Document not found", status: 404 },
      { status: 404 },
    );
  }

  // Check the file really exists before making a link — old AWS files are gone
  try {
    await getS3ObjectSize(document.s3Key);
  } catch (err) {
    // Only a confirmed missing object means "not available" (old AWS uploads).
    // Timeouts, credential errors and storage outages are real errors.
    if (isMissingObjectError(err)) {
      return NextResponse.json<ApiResponse<FileLinkData>>({
        ok: true,
        data: { available: false },
      });
    }
    console.error(
      "[documents/file] Failed to check file:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Gagal memeriksa file", status: 500 },
      { status: 500 },
    );
  }

  try {
    const url = await generatePresignedDownloadUrl(
      document.s3Key,
      document.name,
      disposition,
    );
    // null = mock mode, no link exists
    if (!url) {
      return NextResponse.json<ApiResponse<FileLinkData>>({
        ok: true,
        data: { available: false },
      });
    }
    return NextResponse.json<ApiResponse<FileLinkData>>({
      ok: true,
      data: { available: true, url },
    });
  } catch (err) {
    // Log name + message only, never the link
    console.error(
      "[documents/file] Failed to create link:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Gagal membuat link file", status: 500 },
      { status: 500 },
    );
  }
}
