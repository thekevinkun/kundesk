// Issues a presigned URL for direct client-to-S3 upload
// Creates the document record (status: processing) before the upload happens
// The client calls /api/documents/process after the upload completes

import { type NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { generatePresignedUploadUrl } from "@/lib/aws/s3";
import type { ApiResponse } from "@/types/api";

// Allowed MIME types — enforced here and again in the processing route
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"] as const;

// Max file size: 10MB — matches the Project Bible spec
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Shape returned to the client on success
interface UploadUrlData {
  uploadUrl: string; // client PUTs the file here
  s3Key: string; // client sends this back when calling /process
  documentId: number; // client uses this to track status via Pusher
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard — requires both userId and orgId from Clerk session
  const { orgId } = await requireOrg();

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

  // Validate filename
  if (typeof filename !== "string" || !filename.trim()) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid filename", status: 400 },
      { status: 400 },
    );
  }

  const normalizedFilename = filename.trim().toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
    normalizedFilename.endsWith(ext),
  );
  const hasAllowedMimeType = ALLOWED_MIME_TYPES.includes(
    contentType as AllowedMimeType,
  );

  // Validate MIME type and extension together because browsers can report
  // empty or inconsistent MIME types for markdown/docx files.
  if (!hasAllowedMimeType && !hasAllowedExtension) {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: "Only PDF, TXT, MD, and DOCX files are allowed",
        status: 400,
      },
      { status: 400 },
    );
  }

  // Validate file size — reject before issuing URL to avoid wasted uploads
  // Tighten file-size validation for non-finite/negative values.
  if (
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_FILE_SIZE_BYTES
  ) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "File size must be under 10MB", status: 400 },
      { status: 400 },
    );
  }

  // Generate presigned URL — mock or real S3 depending on KUNDESK_STORAGE_MODE
  const { uploadUrl, s3Key } = await generatePresignedUploadUrl(
    orgId,
    filename.trim(),
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
      name: filename.trim(),
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
