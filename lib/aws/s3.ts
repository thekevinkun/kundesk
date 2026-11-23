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

// Builds the one storage client every function uses (Cloudflare R2 is S3-compatible)
// Checksums only "when required" — the SDK's default adds a checksum to presigned PUT URLs
// (x-amz-checksum-crc32) that R2 can reject
async function createStorageClient() {
  if (
    !env.awsS3Bucket ||
    !env.awsAccessKeyId ||
    !env.awsSecretAccessKey ||
    !env.s3Endpoint
  ) {
    throw new Error("AWS credentials required when KUNDESK_STORAGE_MODE=s3");
  }
  const { S3Client } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: env.awsRegion,
    endpoint: env.s3Endpoint,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: env.awsS3Bucket };
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
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const { client, bucket } = await createStorageClient();

  const command = new PutObjectCommand({
    Bucket: bucket,
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

  // Real mode — fetch from storage
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await createStorageClient();

  const command = new GetObjectCommand({
    Bucket: bucket,
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

// Generates a short-lived signed link so the browser can open or download a stored file.
// The caller MUST have already checked that the document belongs to the org.
// Returns null in mock mode — local files have no public link.
export async function generatePresignedDownloadUrl(
  s3Key: string,
  filename: string,
  disposition: "inline" | "attachment",
): Promise<string | null> {
  if (env.storageMode === "mock") return null;

  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const { client, bucket } = await createStorageClient();

  // ASCII-only name in the header — quotes or non-ASCII characters would break it
  const safeName = sanitizeFilename(filename);

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
  });

  // Link lives 60 seconds — long enough to open, too short to share around
  return getSignedUrl(client, command, { expiresIn: 60 });
}

// Returns the REAL size in bytes of a stored object WITHOUT downloading it.
// The size the browser sends at upload time is only a claim, and the presigned URL does not
// enforce it — so the process route asks the storage itself before it downloads anything.
export async function getS3ObjectSize(
  s3Key: string,
  signal?: AbortSignal,
): Promise<number> {
  // Mock mode — ask the filesystem
  if (env.storageMode === "mock") {
    const { stat } = await import("fs/promises");
    const info = await stat(resolveMockPath(s3Key));
    return info.size;
  }

  // Real mode — HeadObject returns the metadata only, no body
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await createStorageClient();

  const response = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: s3Key }),
    // Pass the abort signal only when provided, same as downloadFromS3
    signal ? { abortSignal: signal } : undefined,
  );

  if (typeof response.ContentLength !== "number") {
    throw new Error(`No size in S3 response for key: ${s3Key}`);
  }

  return response.ContentLength;
}

// Deletes a stored file. A file that is already gone counts as success.
export async function deleteFromStorage(s3Key: string): Promise<void> {
  // Mock mode — remove the local file
  if (env.storageMode === "mock") {
    const { unlink } = await import("fs/promises");
    try {
      await unlink(resolveMockPath(s3Key));
    } catch (err) {
      // Already gone is fine; anything else is a real error
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    return;
  }

  // Real mode — S3-style delete succeeds even when the key does not exist
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await createStorageClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
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
