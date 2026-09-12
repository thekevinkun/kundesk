// Issues a presigned URL for direct client-to-S3 upload
// Creates the document record (status: processing) before the upload happens
// The client calls /api/documents/process after the upload completes

import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/auth";
import { documents, orgs } from "@/lib/db/schema";
import { checkUploadRateLimit } from "@/lib/redis";
import { generatePresignedUploadUrl } from "@/lib/aws/s3";
import { getOrgDocumentUsageCount } from "@/lib/db/queries/documents";
import { validateUploadRequest } from "@/helpers/security";
import type { ApiResponse } from "@/types/api";
import { PLAN_LIMITS, type PlanName } from "@/types/billing";

// Shape returned to the client on success
interface UploadUrlData {
  uploadUrl: string; // client PUTs the file here
  s3Key: string; // client sends this back when calling /process
  documentId: number; // client uses this to track status via Pusher
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard — requires both userId and orgId from Clerk session
  const { orgId } = await requireOrg();

  // Check upload rate limit — 10 uploads per hour per org
  // Prevents bulk upload abuse and runaway S3 + processing costs
  const uploadLimit = await checkUploadRateLimit(orgId);
  if (!uploadLimit.success) {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Terlalu banyak upload. Maksimal 10 file per jam.",
        status: 429,
      },
      { status: 429 },
    );
  }

  // Plan document limit check — fresh read, not the 5-min-stale org cache.
  // Same principle as the chat route's quota gate (Step 8): the resource-creation
  // gate must see current state, not a snapshot that may be minutes old.
  const [freshOrg] = await db
    .select({ plan: orgs.plan })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!freshOrg) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Organization not found", status: 404 },
      { status: 404 },
    );
  }

  const documentLimit = PLAN_LIMITS[freshOrg.plan as PlanName].documents;
  const currentDocumentCount = await getOrgDocumentUsageCount(orgId);

  if (currentDocumentCount >= documentLimit) {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error:
          "Batas dokumen tercapai. Upgrade plan untuk upload lebih banyak.",
        status: 403,
      },
      { status: 403 },
    );
  }

  // Parse and validate the request body
  let body: {
    filename?: unknown;
    contentType?: unknown;
    fileSize?: unknown;
  };

  // Handle malformed JSON as a client error (400)
  // This prevents crashes and gives the client a clear error message about the issue.
  try {
    body = (await request.json()) as {
      filename?: unknown;
      contentType?: unknown;
      fileSize?: unknown;
    };
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body", status: 400 },
      { status: 400 },
    );
  }

  const { filename, contentType, fileSize } = body;

  // Validate the upload parameters — filename, MIME type, and file size
  const validationError = validateUploadRequest({
    filename,
    contentType,
    fileSize,
  });
  if (validationError) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: validationError, status: 400 },
      { status: 400 },
    );
  }

  // Safe to cast — validateUploadRequest guarantees filename is a non-empty string
  const safeFilename = (filename as string).trim();

  // Generate presigned URL — mock or real S3 depending on KUNDESK_STORAGE_MODE
  const { uploadUrl, s3Key } = await generatePresignedUploadUrl(
    orgId,
    safeFilename,
    typeof contentType === "string" && contentType
      ? contentType
      : "application/octet-stream",
  );

  // Insert the document record — status starts as "processing"
  // We create the record BEFORE the upload so the UI can show it immediately
  const [document] = await db
    .insert(documents)
    .values({
      orgId,
      name: safeFilename,
      s3Key,
      status: "processing",
      chunkCount: 0,
    })
    .returning({ id: documents.id });

  if (!document) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Failed to create document record", status: 500 },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiResponse<UploadUrlData>>({
    ok: true,
    data: {
      uploadUrl,
      s3Key,
      documentId: document.id,
    },
  });
}
