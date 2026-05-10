// Receives raw file bytes from the client in mock storage mode
// Saves to /tmp/mock-uploads/ mirroring the S3 key path
// Only active when KUNDESK_STORAGE_MODE=mock — real S3 never hits this route

import { type NextRequest, NextResponse } from "next/server";
import { saveMockUpload } from "@/lib/aws/s3";
import { requireOrg } from "@/lib/auth";
import { env } from "@/lib/env";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // Add a mock-mode gate
  if (env.storageMode !== "mock") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { orgId } = await requireOrg();

  // Extract the S3 key from query params — set by generatePresignedUploadUrl()
  const { searchParams } = new URL(request.url);
  const s3Key = searchParams.get("key");

  if (!s3Key) {
    return NextResponse.json(
      { error: "Missing key parameter" },
      { status: 400 },
    );
  }

  // Ensure the key belongs to the authenticated org before saving.
  if (!s3Key.startsWith(`orgs/${orgId}/documents/`)) {
    return NextResponse.json({ error: "Forbidden key scope" }, { status: 403 });
  }

  // Read the raw file bytes from the request body
  const arrayBuffer = await request.arrayBuffer();
  if (!arrayBuffer.byteLength) {
    return NextResponse.json({ error: "Empty file body" }, { status: 400 });
  }

  const buffer = Buffer.from(arrayBuffer);

  // Save to /tmp/mock-uploads/{s3Key} — mirrors the S3 key path structure
  await saveMockUpload(s3Key, buffer);

  // Return 200 with empty body — matches real S3 presigned PUT response
  return new NextResponse(null, { status: 200 });
}
