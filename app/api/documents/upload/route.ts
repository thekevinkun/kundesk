// Issues a presigned URL for direct client-to-S3 upload
// Creates the document record (status: processing) before the upload happens
// The client calls /api/documents/process after the upload completes

import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth";
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
  // Upload is a mutation — Phase 16 decision: org:member is view-only on Documents
  const { orgId } = await requireOrgAdmin();

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
      { ok: false, error: "Format JSON tidak valid", status: 400 },
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
  // Safe to do before the lock — this is pure local signing, no network call,
  // even in real S3 mode (getSignedUrl never hits AWS over the wire)
  const { uploadUrl, s3Key } = await generatePresignedUploadUrl(
    orgId,
    safeFilename,
    typeof contentType === "string" && contentType
      ? contentType
      : "application/octet-stream",
  );

  // Plan limit check + document insert — one atomic unit.
  // CodeRabbit finding: a plain count-then-insert lets two concurrent uploads
  // both read the same pre-insert count, both pass the check, and both insert —
  // silently exceeding the plan limit. FOR UPDATE locks the org row so a second
  // concurrent request queues behind the first and re-reads the count only
  // after the first request's insert has committed.
  let documentId: number;
  try {
    documentId = await db.transaction(async (tx) => {
      // Lock the org row — serializes concurrent uploads from the same org.
      // Other orgs are unaffected; this only blocks requests for THIS orgId.
      const [lockedOrg] = await tx
        .select({ plan: orgs.plan })
        .from(orgs)
        .where(eq(orgs.id, orgId))
        .for("update");

      if (!lockedOrg) {
        throw new Error("ORG_NOT_FOUND");
      }

      // Count runs inside the lock — guaranteed to see any insert committed
      // by a prior request that held this same lock, not a stale pre-lock read
      const documentLimit = PLAN_LIMITS[lockedOrg.plan as PlanName].documents;
      const currentDocumentCount = await getOrgDocumentUsageCount(orgId, tx);

      if (currentDocumentCount >= documentLimit) {
        throw new Error("DOCUMENT_LIMIT_REACHED");
      }

      // Insert happens before the lock releases — the next queued request
      // (if any) will count this row
      const [document] = await tx
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
        throw new Error("INSERT_FAILED");
      }

      return document.id;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message === "ORG_NOT_FOUND") {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Organisasi tidak ditemukan", status: 404 },
        { status: 404 },
      );
    }
    if (message === "DOCUMENT_LIMIT_REACHED") {
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

    console.error("[documents/upload] Transaction failed:", err);
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Gagal membuat data dokumen", status: 500 },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiResponse<UploadUrlData>>({
    ok: true,
    data: {
      uploadUrl,
      s3Key,
      documentId,
    },
  });
}
