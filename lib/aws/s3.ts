// AWS S3 file storage — document uploads from business owners
// Mock mode saves to /tmp/mock-uploads/ — processing pipeline still runs
// Real mode uses presigned URLs — client uploads directly to S3 (no server proxy)

import { env } from "@/lib/env";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MOCK_UPLOAD_ROOT = "/tmp/mock-uploads";

function resolveMockPath(s3Key: string): string {
  const root = path.resolve(MOCK_UPLOAD_ROOT);
  const resolved = path.resolve(root, s3Key);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Invalid mock upload key");
  }
  return resolved;
}

// Sanitizes a filename — removes special chars that cause S3 path issues
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Builds the S3 key for a document — namespaced by orgId for isolation
function buildS3Key(orgId: string, filename: string): string {
  const safeName = sanitizeFilename(filename);
  const timestamp = Date.now();
  return `orgs/${orgId}/documents/${timestamp}-${safeName}`;
}

// Generates a presigned URL for direct client-to-S3 upload
// In mock mode, returns a fake URL — the client still "uploads" but it's a no-op
export async function generatePresignedUploadUrl(
  orgId: string,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Key = buildS3Key(orgId, filename);

  // Mock mode — return a fake presigned URL, save file locally on upload complete
  if (env.storageMode === "mock") {
    return {
      uploadUrl: `/api/mock-upload?key=${encodeURIComponent(s3Key)}`,
      s3Key,
    };
  }

  // Real mode — generate actual S3 presigned PUT URL (5 min expiry)
  // AWS SDK imported dynamically — only loaded when mode=s3
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  if (!env.awsS3Bucket || !env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new Error("AWS credentials required when KUNDESK_STORAGE_MODE=s3");
  }

  const client = new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.awsS3Bucket,
    Key: s3Key,
    ContentType: contentType,
  });

  // Presigned URL expires in 5 minutes — client must upload within this window
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return { uploadUrl, s3Key };
}

// Downloads a file from S3 by key — used by the document processing pipeline
export async function downloadFromS3(
  s3Key: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  // Mock mode — read from local /tmp/mock-uploads/
  if (env.storageMode === "mock") {
    const { readFile } = await import("fs/promises");
    const localPath = resolveMockPath(s3Key);
    return readFile(localPath);
  }

  // Real mode — fetch from S3
  if (!env.awsS3Bucket || !env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new Error("AWS credentials required when KUNDESK_STORAGE_MODE=s3");
  }

  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: env.awsS3Bucket,
    Key: s3Key,
  });

  // Pass abort signal only when provided — AWS SDK requires definite AbortSignal, not undefined
  const response = await client.send(
    command,
    signal ? { abortSignal: signal } : undefined,
  );

  if (!response.Body)
    throw new Error(`No body in S3 response for key: ${s3Key}`);

  // Convert S3 stream to Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

// Saves a file to mock local storage — called by the mock upload API route
export async function saveMockUpload(
  s3Key: string,
  buffer: Buffer,
): Promise<void> {
  const localPath = resolveMockPath(s3Key);
  const dir = path.dirname(localPath);

  // Create directory structure if it doesn't exist
  await mkdir(dir, { recursive: true });
  await writeFile(localPath, buffer);
}

// Generates a unique session ID for file upload tracking
export function generateUploadId(): string {
  return randomUUID();
}
