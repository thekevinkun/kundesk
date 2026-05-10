// Runs the full document processing pipeline after a successful upload
// parse → chunk → embed → bulk insert into pgvector → update status → Pusher event
// Called by the client immediately after the presigned URL PUT completes

import { type NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, chunks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { downloadFromS3 } from "@/lib/aws/s3";
import { chunkText } from "@/helpers/chunk";
import { embedText } from "@/lib/ai/embed";
import { triggerDocumentUpdated } from "@/lib/pusher";
import type { ApiResponse } from "@/types/api";

// Shape of the request body from the client
interface ProcessRequestBody {
  documentId?: unknown;
  s3Key?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard — requireOrg() also protects against IDOR via orgId scoping below
  const { orgId } = await requireOrg();

  const body = (await request.json()) as ProcessRequestBody;
  const { documentId, s3Key } = body;

  // Validate inputs
  if (typeof documentId !== "number" || typeof s3Key !== "string" || !s3Key) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "documentId and s3Key are required", status: 400 },
      { status: 400 },
    );
  }

  // IDOR protection — verify the document belongs to this org
  // Returns same error whether the doc is missing or belongs to another org
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.orgId, orgId), // ← tenant isolation
      ),
    )
    .limit(1);

  if (!document) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Document not found", status: 404 },
      { status: 404 },
    );
  }

  // Helper — marks document as failed and notifies dashboard via Pusher
  async function markFailed(): Promise<void> {
    await db
      .update(documents)
      .set({ status: "failed" })
      .where(
        and(eq(documents.id, documentId as number), eq(documents.orgId, orgId)),
      );

    await triggerDocumentUpdated(orgId, {
      documentId: documentId as number,
      status: "failed",
      chunkCount: 0,
    });
  }

  // ── Stage 1: Download ──

  let fileBuffer: Buffer;
  try {
    // Downloads from /tmp/mock-uploads/ (mock) or S3 (real)
    fileBuffer = await downloadFromS3(s3Key);
  } catch {
    await markFailed();
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Failed to download file", status: 500 },
      { status: 500 },
    );
  }

  // ── Stage 2: Parse ──

  let rawText: string;
  try {
    rawText = await parseFile(fileBuffer, document.name);
  } catch (err) {
    console.error("Parse error:", err);
    await markFailed();

    const errorMessage =
      err instanceof Error ? err.message : "Failed to parse file";

    return NextResponse.json<ApiResponse>(
      { ok: false, error: errorMessage, status: 422 },
      { status: 422 },
    );
  }

  // Reject empty documents — nothing to embed
  if (!rawText.trim()) {
    await markFailed();
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Document appears to be empty", status: 422 },
      { status: 422 },
    );
  }

  // ── Stage 3: Chunk ──

  const textChunks = chunkText(rawText);

  if (textChunks.length === 0) {
    await markFailed();
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "No chunks produced from document", status: 422 },
      { status: 422 },
    );
  }

  // ── Stage 4: Embed ──

  // Embed each chunk — in mock mode this is instant random vectors
  // In real mode this calls OpenAI for each chunk (batching in Phase 8)
  let embeddings: number[][];
  try {
    embeddings = await Promise.all(
      textChunks.map((chunk) => embedText(chunk.content)),
    );
  } catch {
    await markFailed();
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Failed to generate embeddings", status: 500 },
      { status: 500 },
    );
  }

  // ── Stage 5: Bulk insert chunks ──

  // Build insert rows — each chunk gets orgId for tenant isolation
  // Embedding stored as JSON string — cast to vector in pgvector queries
  const chunkRows = textChunks.map((chunk, i) => ({
    orgId,
    documentId: document.id,
    content: chunk.content,
    // Store as JSON string — cast to ::vector(1536) in similarity queries
    embedding: JSON.stringify(embeddings[i]),
  }));

  try {
    // Bulk insert — one round trip for all chunks
    await db.insert(chunks).values(chunkRows);
  } catch {
    await markFailed();
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Failed to store chunks", status: 500 },
      { status: 500 },
    );
  }

  // ── Stage 6: Update document status ──

  await db
    .update(documents)
    .set({
      status: "ready",
      chunkCount: textChunks.length,
    })
    .where(and(eq(documents.id, document.id), eq(documents.orgId, orgId)));

  // ── Stage 7: Notify dashboard via Pusher ──

  // Dashboard is subscribed to org-{orgId} channel — this updates the UI live
  await triggerDocumentUpdated(orgId, {
    documentId: document.id,
    status: "ready",
    chunkCount: textChunks.length,
  });

  return NextResponse.json<ApiResponse<{ chunkCount: number }>>({
    ok: true,
    data: { chunkCount: textChunks.length },
  });
}

// ── File parser ──

// Parses a file buffer into plain text based on the document name extension
async function parseFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    // Load the parser implementation directly. Importing the package root
    // can execute its debug entrypoint under Next's server runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      buffer: Buffer,
    ) => Promise<{ text: string }>;

    const result = await pdfParse(buffer);
    const text = result.text.trim();

    if (!text) {
      throw new Error(
        "PDF tidak mengandung teks yang bisa diekstrak. Jika ini PDF hasil scan/gambar, tambahkan OCR terlebih dulu.",
      );
    }

    return text;
  }

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  if (ext === "md") {
    return buffer.toString("utf-8");
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (!text) {
      throw new Error("DOCX tidak mengandung teks yang bisa diekstrak.");
    }

    return text;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}
